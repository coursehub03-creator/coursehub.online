const pdfLibraryUrl =
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
const dataUrlPrefix = "data:";

const params = new URLSearchParams(window.location.search);
const encodedUrl = params.get("url");
const encodedTitle = params.get("title");

const certificateImage = document.getElementById("certificateImage");
const certificateTitle = document.getElementById("certificateTitle");
const downloadButton = document.getElementById("downloadPdf");
const errorText = document.getElementById("certificateError");

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

const showError = (message) => {
  if (errorText) {
    errorText.textContent = message;
  }
};

if (!encodedUrl) {
  showError("لا يوجد رابط شهادة لعرضه.");
} else {
  const certificateUrl = decodeURIComponent(encodedUrl);
  const title = encodedTitle ? decodeURIComponent(encodedTitle) : "الشهادة";

  if (certificateImage) {
    certificateImage.src = certificateUrl;
  }

  if (certificateTitle) {
    certificateTitle.textContent = title;
  }

  downloadButton?.addEventListener("click", () => {
    downloadPdfFromImage(certificateUrl, title).catch(() => {
      showError("تعذر تنزيل الشهادة كملف PDF. حاول مرة أخرى.");
    });
  });
}
