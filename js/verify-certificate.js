import { db } from "/js/firebase-config.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const pdfLibraryUrl = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
const dataUrlPrefix = "data:";

// ✅ i18n
const getLang = () => localStorage.getItem("coursehub_lang") || "ar";

const uiText = {
  ar: {
    verifying: "جاري التحقق من الشهادة...",
    notFound: "لم يتم العثور على شهادة بهذا الرمز.",
    validBadge: "شهادة معتمدة وصحيحة",
    completedAt: "تاريخ الإنجاز:",
    viewCertificate: "عرض الشهادة",
    downloadPdf: "تحميل PDF",
    downloadFailed: "تعذر تنزيل الشهادة كملف PDF. حاول مرة أخرى.",
    verifyError: "حدث خطأ أثناء التحقق. حاول مرة أخرى.",
    defaultTitle: "الشهادة",
    notSpecified: "غير محدد"
  },
  en: {
    verifying: "Verifying the certificate...",
    notFound: "No certificate found with this code.",
    validBadge: "Verified certificate",
    completedAt: "Completion date:",
    viewCertificate: "View certificate",
    downloadPdf: "Download PDF",
    downloadFailed: "Failed to download the certificate as PDF. Please try again.",
    verifyError: "An error occurred while verifying. Please try again.",
    defaultTitle: "Certificate",
    notSpecified: "Not specified"
  }
};

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

const resolveJsPdfConstructor = () => window.jspdf?.jsPDF || window.jsPDF || null;

const loadJsPdf = (() => {
  let cachedPromise;
  return async () => {
    if (!cachedPromise) {
      cachedPromise = new Promise((resolve, reject) => {
        const existing = resolveJsPdfConstructor();
        if (existing) return resolve(existing);

        const script = document.createElement("script");
        script.src = pdfLibraryUrl;
        script.async = true;

        script.onload = () => {
          const loaded = resolveJsPdfConstructor();
          if (loaded) resolve(loaded);
          else reject(new Error("jsPDF constructor not found."));
        };

        script.onerror = () => reject(new Error("Failed to load jsPDF."));
        document.head.appendChild(script);
      });
    }
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
  // ✅ دمج التعارض: تحقق من url + دعم data:
  if (!url) throw new Error("Missing URL");
  if (typeof url === "string" && url.startsWith(dataUrlPrefix)) return url;

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

const fetchQrDataUrl = async (verifyUrl) => {
  if (!verifyUrl) return "";

  const qrResponse = await fetch(
    `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(verifyUrl)}`
  );
  if (!qrResponse.ok) throw new Error("Failed to load QR code.");

  const qrBlob = await qrResponse.blob();
  return blobToDataUrl(qrBlob);
};

const composeCertificateWithQr = async (certificateUrl, verificationCode) => {
  const dataUrl = await fetchImageDataUrl(certificateUrl);
  if (!verificationCode) return dataUrl;

  const verifyUrl = new URL(
    `/verify-certificate.html?code=${encodeURIComponent(verificationCode)}`,
    window.location.href
  ).href;

  const qrDataUrl = await fetchQrDataUrl(verifyUrl);
  if (!qrDataUrl) return dataUrl;

  const [certImg, qrImg] = await Promise.all([loadImage(dataUrl), loadImage(qrDataUrl)]);

  const canvas = document.createElement("canvas");
  canvas.width = certImg.width;
  canvas.height = certImg.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;

  ctx.drawImage(certImg, 0, 0);

  const minSide = Math.min(canvas.width, canvas.height);

  // ✅ تصغير حجم الـ QR + مكان آمن أعلى اليسار
  const qrSize = Math.round(minSide * 0.14);
  const margin = Math.round(minSide * 0.04);

  const extraX = 40;
  const extraY = 40;
  const x = margin + extraX;
  const y = margin + extraY;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - 6, y - 6, qrSize + 12, qrSize + 12);
  ctx.drawImage(qrImg, x, y, qrSize, qrSize);

  return canvas.toDataURL("image/png");
};

const downloadPdfFromImage = async (url, title, verificationCode) => {
  const dataUrl = await composeCertificateWithQr(url, verificationCode);
  const imageType = dataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";

  const jsPDF = await loadJsPdf();
  if (!jsPDF) throw new Error("jsPDF constructor not available.");

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

  const t = uiText[getLang()];

  result.className = "verify-result";
  result.style.display = "none";
  result.innerHTML = "";
  result.classList.remove("error", "success");

  try {
    result.style.display = "block";
    result.textContent = t.verifying;

    const qy = query(collection(db, "certificates"), where("verificationCode", "==", code));
    const snapshot = await getDocs(qy);

    if (snapshot.empty) {
      result.classList.add("error");
      result.textContent = t.notFound;
      return;
    }

    const cert = snapshot.docs[0].data();

    const title = cert.courseTitle || cert.courseId || t.defaultTitle;
    const completedAt = formatDate(cert.completedAt);
    const certificateUrl = cert.certificateUrl || "";
    const verificationCode = cert.verificationCode || code;

    result.classList.add("success");
    result.innerHTML = `
      <div class="result-header">
        <span class="result-badge">${t.validBadge}</span>
      </div>
      <h3 class="result-title">${title}</h3>
      <p class="result-meta">${t.completedAt} ${completedAt || t.notSpecified}</p>

      <div class="result-actions">
        ${
          certificateUrl
            ? `<button type="button" class="btn"
                data-view-url="${encodeURIComponent(certificateUrl)}"
                data-view-title="${encodeURIComponent(title)}"
                data-view-code="${encodeURIComponent(verificationCode)}"
              >${t.viewCertificate}</button>`
            : ""
        }
        ${
          certificateUrl
            ? `<button type="button" class="btn secondary"
                data-download-url="${encodeURIComponent(certificateUrl)}"
                data-download-title="${encodeURIComponent(title)}"
                data-download-code="${encodeURIComponent(verificationCode)}"
              >${t.downloadPdf}</button>`
            : ""
        }
      </div>
    `;

    // ✅ فتح عبر viewer + دعم DataURL عبر sessionStorage (dataKey)
    const viewButton = result.querySelector("[data-view-url]");
    if (viewButton) {
      viewButton.addEventListener("click", () => {
        const url = decodeURIComponent(viewButton.getAttribute("data-view-url") || "");
        const viewTitle = decodeURIComponent(viewButton.getAttribute("data-view-title") || "");
        const viewCode = decodeURIComponent(viewButton.getAttribute("data-view-code") || "");

        let dataKey = "";
        let targetUrl = url;

        if (typeof url === "string" && url.startsWith(dataUrlPrefix)) {
          dataKey = `certificate-data-${Date.now()}`;
          try {
            sessionStorage.setItem(dataKey, url);
            targetUrl = "";
          } catch (e) {
            targetUrl = url;
            dataKey = "";
          }
        }

        const viewerUrl =
          `/certificate-view.html?url=${encodeURIComponent(targetUrl)}` +
          `&title=${encodeURIComponent(viewTitle || "certificate")}` +
          `&code=${encodeURIComponent(viewCode || "")}` +
          `&dataKey=${encodeURIComponent(dataKey)}`;

        window.open(viewerUrl, "_blank");
      });
    }

    const downloadButtonEl = result.querySelector("[data-download-url]");
    if (downloadButtonEl) {
      downloadButtonEl.addEventListener("click", () => {
        const url = decodeURIComponent(downloadButtonEl.getAttribute("data-download-url") || "");
        const downloadTitle = decodeURIComponent(downloadButtonEl.getAttribute("data-download-title") || "");
        const downloadCode = decodeURIComponent(downloadButtonEl.getAttribute("data-download-code") || "");

        downloadPdfFromImage(url, downloadTitle, downloadCode).catch(() => {
          result.classList.add("error");
          result.textContent = t.downloadFailed;
        });
      });
    }
  } catch (error) {
    console.error(error);
    result.classList.add("error");
    result.textContent = uiText[getLang()].verifyError;
  }
}

function formatDate(dateValue) {
  const date = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  const locale = getLang() === "en" ? "en-US" : "ar-EG";
  return date.toLocaleDateString(locale);
}
