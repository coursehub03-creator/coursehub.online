import { db } from "/js/firebase-config.js";
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const pdfLibraryUrl =
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
const dataUrlPrefix = "data:";

const form = document.getElementById("verifyForm");
const input = document.getElementById("certificateCode");
const result = document.getElementById("verifyResult");

const params = new URLSearchParams(window.location.search);
const presetCode = params.get("code");
if (presetCode && input) {
  input.value = presetCode;
  verifyCode(presetCode);
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const code = input?.value?.trim() || "";
  if (!code) return;
  verifyCode(code);
});

const sanitizeFileName = (value) =>
  (value || "certificate")
    .toString()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

// ✅ حل التعارض بدون حذف ميزات:
// - يدعم script injection (لو dynamic import فشل أو بيئة ما تدعمه)
// - ويدعم dynamic import
// ويرجع دائمًا { jsPDF } بشكل موحد
const loadJsPdf = (() => {
  let cachedPromise;
  return async () => {
    if (cachedPromise) return cachedPromise;

    cachedPromise = (async () => {
      // 1) إذا موجود على window مسبقًا
      if (window.jspdf?.jsPDF) {
        return { jsPDF: window.jspdf.jsPDF };
      }

      // 2) جرّب dynamic import
      try {
        const mod = await import(pdfLibraryUrl);
        if (mod?.jsPDF) return { jsPDF: mod.jsPDF };
        if (mod?.default?.jsPDF) return { jsPDF: mod.default.jsPDF };
        return mod;
      } catch (e) {
        // 3) fallback: حقن سكربت
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = pdfLibraryUrl;
          script.async = true;
          script.onload = () => resolve(true);
          script.onerror = () => reject(new Error("Failed to load jsPDF."));
          document.head.appendChild(script);
        });

        if (window.jspdf?.jsPDF) {
          return { jsPDF: window.jspdf.jsPDF };
        }
        throw new Error("jsPDF not available after loading script.");
      }
    })();

    return cachedPromise;
  };
})();

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const fetchImageDataUrl = async (url) => {
  // ✅ الحفاظ على الميزة الجديدة: تحقق من url + دعم data:
  if (!url) throw new Error("Missing URL");
  if (url.startsWith(dataUrlPrefix)) return url;

  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to load certificate image.");
  const blob = await response.blob();
  return blobToDataUrl(blob);
};

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image."));
    img.src = src;
  });

// ✅ ميزة جديدة: جلب QR كـ DataURL
const fetchQrDataUrl = async (verifyUrl) => {
  if (!verifyUrl) return "";
  const qrResponse = await fetch(
    `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
      verifyUrl
    )}`
  );
  if (!qrResponse.ok) throw new Error("Failed to load QR code.");
  const qrBlob = await qrResponse.blob();
  return blobToDataUrl(qrBlob);
};

// ✅ ميزة جديدة: دمج QR داخل صورة الشهادة (للعرض + الـ PDF)
const composeCertificateWithQr = async (certificateUrl, verificationCode) => {
  const dataUrl = await fetchImageDataUrl(certificateUrl);
  if (!verificationCode) return dataUrl;

  const verifyUrl = new URL(
    `/verify-certificate.html?code=${encodeURIComponent(verificationCode)}`,
    window.location.href
  ).href;

  const qrDataUrl = await fetchQrDataUrl(verifyUrl);
  if (!qrDataUrl) return dataUrl;

  const [certImg, qrImg] = await Promise.all([
    loadImage(dataUrl),
    loadImage(qrDataUrl)
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = certImg.width;
  canvas.height = certImg.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;

  ctx.drawImage(certImg, 0, 0);

  const minSide = Math.min(canvas.width, canvas.height);
  const qrSize = Math.round(minSide * 0.18);
  const margin = Math.round(minSide * 0.04);

  const x = canvas.width - qrSize - margin;
  const y = canvas.height - qrSize - margin;

  // خلفية بيضاء للـ QR حتى يكون واضح فوق التصميم
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - 6, y - 6, qrSize + 12, qrSize + 12);

  ctx.drawImage(qrImg, x, y, qrSize, qrSize);

  return canvas.toDataURL("image/png");
};

// ✅ تنزيل PDF مع QR (ميزة جديدة)
const downloadPdfFromImage = async (url, title, verificationCode) => {
  const dataUrl = await composeCertificateWithQr(url, verificationCode);
  const imageType = dataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";

  const { jsPDF } = await loadJsPdf();
  const img = await loadImage(dataUrl);

  const orientation = img.width > img.height ? "landscape" : "portrait";
  const pdf = new jsPDF({
    orientation,
    unit: "pt",
    format: [img.width, img.height]
  });

  pdf.addImage(dataUrl, imageType, 0, 0, img.width, img.height);
  pdf.save(`${sanitizeFileName(title)}.pdf`);
};

async function verifyCode(code) {
  if (!result) return;

  result.className = "verify-result";
  result.style.display = "none";
  result.innerHTML = "";
  result.classList.remove("error", "success");

  try {
    result.style.display = "block";
    result.textContent = "جاري التحقق من الشهادة...";

    const q = query(
      collection(db, "certificates"),
      where("verificationCode", "==", code)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      result.classList.add("error");
      result.textContent = "لم يتم العثور على شهادة بهذا الرمز.";
      return;
    }

    const cert = snapshot.docs[0].data();
    const title = cert.courseTitle || cert.courseId || "الشهادة";
    const completedAt = formatDate(cert.completedAt);
    const certificateUrl = cert.certificateUrl || "";
    const verificationCode = cert.verificationCode || code;

    // ✅ ميزة جديدة: تمرير code للـ viewer حتى يعرض QR
    const viewUrl = certificateUrl
      ? `/certificate-view.html?url=${encodeURIComponent(
          certificateUrl
        )}&title=${encodeURIComponent(title)}&code=${encodeURIComponent(
          verificationCode
        )}`
      : "";

    result.classList.add("success");
    result.innerHTML = `
      <div class="result-header">
        <span class="result-badge">شهادة معتمدة وصحيحة</span>
      </div>
      <h3 class="result-title">${title}</h3>
      <p class="result-meta">تاريخ الإنجاز: ${completedAt || "غير محدد"}</p>
      <div class="result-actions">
        ${
          viewUrl
            ? `<a href="${viewUrl}" class="btn" target="_blank" rel="noopener">عرض الشهادة</a>`
            : ""
        }
        ${
          certificateUrl
            ? `<button
                type="button"
                class="btn secondary"
                data-download-url="${encodeURIComponent(certificateUrl)}"
                data-download-title="${encodeURIComponent(title)}"
                data-download-code="${encodeURIComponent(verificationCode)}"
              >تحميل PDF</button>`
            : ""
        }
      </div>
    `;

    const downloadButton = result.querySelector("[data-download-url]");
    if (downloadButton) {
      downloadButton.addEventListener("click", () => {
        const url = decodeURIComponent(
          downloadButton.getAttribute("data-download-url") || ""
        );
        const downloadTitle = decodeURIComponent(
          downloadButton.getAttribute("data-download-title") || ""
        );
        const downloadCode = decodeURIComponent(
          downloadButton.getAttribute("data-download-code") || ""
        );

        downloadPdfFromImage(url, downloadTitle, downloadCode).catch((err) => {
          console.error(err);
          result.classList.add("error");
          result.textContent = "تعذر تنزيل الشهادة كملف PDF. حاول مرة أخرى.";
        });
      });
    }
  } catch (error) {
    console.error(error);
    result.classList.add("error");
    result.textContent = "حدث خطأ أثناء التحقق. حاول مرة أخرى.";
  }
}

function formatDate(dateValue) {
  const date = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ar-EG");
}
