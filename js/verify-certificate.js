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
  const code = input.value.trim();
  if (!code) return;
  verifyCode(code);
});

const sanitizeFileName = (value) =>
  (value || "certificate")
    .toString()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

const loadJsPdf = (() => {
  let cachedModule;
  return async () => {
    if (!cachedModule) {
      cachedModule = import(pdfLibraryUrl);
    }
    return cachedModule;
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
  if (url.startsWith(dataUrlPrefix)) {
    return url;
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to load certificate image.");
  }
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

const downloadPdfFromImage = async (url, title) => {
  const dataUrl = await fetchImageDataUrl(url);
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

  try {
    const q = query(collection(db, "certificates"), where("verificationCode", "==", code));
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
    const viewUrl = certificateUrl
      ? `/certificate-view.html?url=${encodeURIComponent(
          certificateUrl
        )}&title=${encodeURIComponent(title)}`
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
            ? `<button type="button" class="btn secondary" data-download-url="${encodeURIComponent(
                certificateUrl
              )}" data-download-title="${encodeURIComponent(title)}">تحميل PDF</button>`
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
        downloadPdfFromImage(url, downloadTitle).catch(() => {
          result.classList.add("error");
          result.textContent = "تعذر تنزيل الشهادة كملف PDF. حاول مرة أخرى.";
        });
      });
    }
  } catch (error) {
    result.classList.add("error");
    result.textContent = "حدث خطأ أثناء التحقق. حاول مرة أخرى.";
  }
}

function formatDate(dateValue) {
  const date = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ar-EG");
}
