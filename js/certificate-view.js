const pdfLibraryUrl =
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
const dataUrlPrefix = "data:";

const params = new URLSearchParams(window.location.search);
const encodedUrl = params.get("url");
const encodedTitle = params.get("title");
const encodedCode = params.get("code");
const encodedDataKey = params.get("dataKey");

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

const resolveJsPdfConstructor = () =>
  window.jspdf?.jsPDF || window.jsPDF || null;

const loadJsPdf = (() => {
  let cachedPromise;
  return async () => {
    if (!cachedPromise) {
      cachedPromise = new Promise((resolve, reject) => {
        const existing = resolveJsPdfConstructor();
        if (existing) {
          resolve(existing);
          return;
        }
        const script = document.createElement("script");
        script.src = pdfLibraryUrl;
        script.async = true;
        script.onload = () => {
          const loaded = resolveJsPdfConstructor();
          if (loaded) {
            resolve(loaded);
          } else {
            reject(new Error("jsPDF constructor not found."));
          }
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
  if (!url) throw new Error("Missing URL");
  if (url.startsWith(dataUrlPrefix)) return url;

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

const fetchQrDataUrl = async (verifyUrl) => {
  if (!verifyUrl) return "";
  const qrResponse = await fetch(
    `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
      verifyUrl
    )}`
  );
  if (!qrResponse.ok) {
    throw new Error("Failed to load QR code.");
  }
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

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x - 6, y - 6, qrSize + 12, qrSize + 12);
  ctx.drawImage(qrImg, x, y, qrSize, qrSize);

  return canvas.toDataURL("image/png");
};

const downloadPdfFromImage = async (url, title, verificationCode) => {
  const dataUrl = await composeCertificateWithQr(url, verificationCode);
  const imageType = dataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG";

  const jsPDF = await loadJsPdf();
  if (!jsPDF) {
    throw new Error("jsPDF constructor not available.");
  }

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

// ✅ دمج التعارض: إذا ما في url ولا dataKey نوقف
if (!encodedUrl && !encodedDataKey) {
  showError("لا يوجد رابط شهادة لعرضه.");
  if (downloadButton) downloadButton.disabled = true;
} else {
  const storageKey = encodedDataKey ? decodeURIComponent(encodedDataKey) : "";
  const storedDataUrl = storageKey ? sessionStorage.getItem(storageKey) : "";

  const certificateUrl = storedDataUrl || decodeURIComponent(encodedUrl || "");
  const title = encodedTitle ? decodeURIComponent(encodedTitle) : "الشهادة";
  const verificationCode = encodedCode ? decodeURIComponent(encodedCode) : "";

  if (!certificateUrl) {
    showError("لا يوجد رابط شهادة لعرضه.");
    if (downloadButton) downloadButton.disabled = true;
  } else {
    if (certificateTitle) {
      certificateTitle.textContent = title;
    }

    const renderCertificate = async () => {
      try {
        const composedUrl = await composeCertificateWithQr(
          certificateUrl,
          verificationCode
        );
        if (certificateImage) {
          certificateImage.src = composedUrl;
        }
      } catch (error) {
        showError("تعذر عرض الشهادة. حاول مرة أخرى.");
      }
    };

    renderCertificate();

    downloadButton?.addEventListener("click", () => {
      downloadPdfFromImage(certificateUrl, title, verificationCode).catch(() => {
        showError("تعذر تنزيل الشهادة كملف PDF. حاول مرة أخرى.");
      });
    });
  }
}
