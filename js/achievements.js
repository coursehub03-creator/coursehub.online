import { auth, db, googleProvider } from "/js/firebase-config.js";
import {
  onAuthStateChanged,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- Certificate helpers ---
const dataUrlPrefix = "data:";
const pdfLibraryUrl =
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

const openUrlInNewTab = (url) => {
  const win = window.open(url, "_blank");
  if (!win) {
    alert("تم حظر فتح الشهادة من المتصفح. يرجى السماح بالنوافذ المنبثقة.");
  }
};

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

// ✅ تنزيل الشهادة كـ PDF (ميزة جديدة)
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

// ✅ فتح الشهادة داخل صفحة Viewer (ميزة جديدة)
const openCertificateViewer = (url, title) => {
  const viewerUrl = `/certificate-view.html?url=${encodeURIComponent(
    url
  )}&title=${encodeURIComponent(title || "certificate")}`;
  openUrlInNewTab(viewerUrl);
};

// ✅ فتح الشهادة (يحافظ على التحقق من الرابط + popup handling)
window.openCertificate = function (url, title) {
  if (!url) {
    alert("رابط الشهادة غير متوفر حاليًا.");
    return;
  }

  // استخدم الـ viewer دائما (الميزة الجديدة)
  openCertificateViewer(url, title);
};

// ✅ تنزيل الشهادة (PDF)
window.downloadCertificate = function (url, title) {
  if (!url) {
    alert("رابط الشهادة غير متوفر حاليًا.");
    return;
  }

  downloadPdfFromImage(url, title).catch(() => {
    alert("تعذر تنزيل الشهادة كملف PDF. حاول مرة أخرى.");
  });
};

// --- مراقبة حالة تسجيل الدخول ---
onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      const result = await signInWithPopup(auth, googleProvider);
      user = result.user;
    }

    const userDocRef = doc(db, "users", user.uid);
    const userDataSnap = await getDoc(userDocRef);

    let userData;
    if (!userDataSnap.exists()) {
      userData = { completedCourses: [], certificates: [] };
      await setDoc(userDocRef, userData);
    } else {
      userData = userDataSnap.data();
    }

    let completedCourses = [];
    let certificates = [];

    // ✅ القراءة من المجموعات الفرعية (الأسلوب الجديد)
    try {
      const completedSnap = await getDocs(
        collection(db, "users", user.uid, "completedCourses")
      );
      completedCourses = completedSnap.docs.map((docSnap) => docSnap.data());
    } catch (error) {
      console.error("خطأ أثناء جلب الدورات المكتملة من المجموعات الفرعية:", error);
    }

    try {
      const certificatesSnap = await getDocs(
        collection(db, "users", user.uid, "certificates")
      );
      certificates = certificatesSnap.docs.map((docSnap) => docSnap.data());
    } catch (error) {
      console.error("خطأ أثناء جلب الشهادات من المجموعات الفرعية:", error);
    }

    // ✅ Fallback للشهادات: إذا ما فيه شهادات بالمجموعة الفرعية، اجلبها من المجموعة العامة certificates
    if (!certificates.length) {
      try {
        const publicCertificatesSnap = await getDocs(
          query(collection(db, "certificates"), where("userId", "==", user.uid))
        );

        certificates = publicCertificatesSnap.docs.map((docSnap) => {
          const data = docSnap.data();

          // ✅ قراءة آمنة للتاريخ (Timestamp أو string)
          const completedAt = data.completedAt;
          const issuedAt =
            completedAt && typeof completedAt.toDate === "function"
              ? completedAt.toDate().toLocaleDateString("ar-EG")
              : (completedAt || "");

          return {
            title: data.courseTitle || data.title || "",
            issuedAt,
            certificateUrl: data.certificateUrl || "",
            verificationCode: data.verificationCode || ""
          };
        });
      } catch (error) {
        console.error("خطأ أثناء جلب الشهادات العامة:", error);
      }
    }

    // ✅ fallback قديم: إذا ما عندك subcollections رجّع للحقول داخل users doc (للتوافق مع البيانات القديمة)
    if (!completedCourses.length && Array.isArray(userData.completedCourses)) {
      completedCourses = userData.completedCourses;
    }

    if (!certificates.length && Array.isArray(userData.certificates)) {
      certificates = userData.certificates;
    }

    // --- ملخص الإنجازات ---
    const completedCoursesCount = document.getElementById("completedCourses");
    if (completedCoursesCount) {
      completedCoursesCount.textContent = completedCourses.length;
    }

    const certificatesCount = document.getElementById("certificatesCount");
    if (certificatesCount) {
      certificatesCount.textContent = certificates.length;
    }

    // --- عرض الشهادات ---
    const certList = document.getElementById("certificatesList");
    if (certList) {
      certList.innerHTML = "";
      if (certificates.length === 0) {
        certList.innerHTML = "<p>لم تحصل على أي شهادة بعد.</p>";
      } else {
        certificates.forEach((cert) => {
          const safeUrl = encodeURIComponent(cert.certificateUrl || "");
          const safeTitle = encodeURIComponent(cert.title || "certificate");

          // ✅ توليد رابط تحقق صحيح + QR (ميزة جديدة)
          const baseUrl =
            window.location.origin && window.location.origin !== "null"
              ? window.location.origin
              : "";
          const verifyUrl = cert.verificationCode
            ? `${baseUrl}/verify-certificate.html?code=${encodeURIComponent(
                cert.verificationCode
              )}`
            : "";

          certList.innerHTML += `
            <div class="certificate-card">
              <button type="button"
                class="download-btn"
                data-download-certificate
                data-url="${safeUrl}"
                data-title="${safeTitle}">
                تحميل PDF
              </button>

              <h4>${cert.title}</h4>
              <span>تاريخ الإصدار: ${cert.issuedAt}</span>

              ${
                cert.verificationCode
                  ? `<span class="certificate-code">رمز التحقق: ${cert.verificationCode}</span>`
                  : ""
              }

              ${
                cert.verificationCode
                  ? `<div class="certificate-qr">
                      <img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
                        verifyUrl
                      )}" alt="رمز QR للتحقق من الشهادة">
                      <span>امسح للتحقق</span>
                    </div>`
                  : ""
              }

              <div class="certificate-actions">
                <button type="button"
                  data-open-certificate
                  data-url="${safeUrl}"
                  data-title="${safeTitle}">
                  عرض الشهادة
                </button>

                ${
                  cert.verificationCode
                    ? `<a href="/verify-certificate.html?code=${cert.verificationCode}" class="verify-btn">تحقق من الشهادة</a>`
                    : ""
                }
              </div>
            </div>
          `;
        });

        // فتح الشهادة
        certList.querySelectorAll("[data-open-certificate]").forEach((button) => {
          button.addEventListener("click", () => {
            const url = decodeURIComponent(button.getAttribute("data-url") || "");
            const title = decodeURIComponent(button.getAttribute("data-title") || "");
            window.openCertificate(url, title);
          });
        });

        // تنزيل الشهادة PDF
        certList.querySelectorAll("[data-download-certificate]").forEach((button) => {
          button.addEventListener("click", () => {
            const url = decodeURIComponent(button.getAttribute("data-url") || "");
            const title = decodeURIComponent(button.getAttribute("data-title") || "");
            window.downloadCertificate(url, title);
          });
        });
      }
    }

    // --- عرض الدورات المكتملة ---
    const coursesList = document.getElementById("coursesList");
    if (coursesList) {
      coursesList.innerHTML = "";
      if (completedCourses.length === 0) {
        coursesList.innerHTML = "<p>لم تكمل أي دورة بعد.</p>";
      } else {
        completedCourses.forEach((course) => {
          coursesList.innerHTML += `
            <div class="course-card">
              <img src="${course.image}" alt="${course.title}">
              <div class="course-content">
                <h4>
                  <a href="course-detail.html?id=${course.id}" style="text-decoration:none;color:#1c3faa;">
                    ${course.title}
                  </a>
                </h4>
                <span>المدرب: ${course.instructor}</span><br>
                <span>أكملت في: ${course.completedAt}</span>
              </div>
            </div>
          `;
        });
      }
    }
  } catch (error) {
    console.error("Firebase Auth Error:", error);
    alert("حدث خطأ أثناء تسجيل الدخول أو جلب البيانات. حاول مرة أخرى.");
  }
});
