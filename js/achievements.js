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

// --- دالة فتح الشهادة في نافذة جديدة ---
const dataUrlPrefix = "data:";

const createBlobUrlFromDataUrl = (dataUrl) => {
  const [header, base64Data] = dataUrl.split(",");
  if (!header || !base64Data) {
    return null;
  }

  const mimeMatch = header.match(/data:([^;]+);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
};

const openUrlInNewTab = (url) => {
  const win = window.open(url, "_blank");
  if (!win) {
    alert("تم حظر فتح الشهادة من المتصفح. يرجى السماح بالنوافذ المنبثقة.");
  }
};

const triggerDownload = (url, filename) => {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "certificate";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

window.openCertificate = function (url) {
  // ✅ الحفاظ على ميزة التحقق من الرابط + التعامل مع حظر النوافذ المنبثقة
  if (!url) {
    alert("رابط الشهادة غير متوفر حاليًا.");
    return;
  }

  if (url.startsWith(dataUrlPrefix)) {
    const blobUrl = createBlobUrlFromDataUrl(url);
    if (!blobUrl) {
      alert("تعذر فتح الشهادة بسبب صيغة الرابط.");
      return;
    }
    openUrlInNewTab(blobUrl);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    return;
  }

  openUrlInNewTab(url);
};

window.downloadCertificate = function (url, title) {
  if (!url) {
    alert("رابط الشهادة غير متوفر حاليًا.");
    return;
  }

  if (url.startsWith(dataUrlPrefix)) {
    const blobUrl = createBlobUrlFromDataUrl(url);
    if (!blobUrl) {
      alert("تعذر تنزيل الشهادة بسبب صيغة الرابط.");
      return;
    }
    triggerDownload(blobUrl, title);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    return;
  }

  triggerDownload(url, title);
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
          certList.innerHTML += `
            <div class="certificate-card">
              <button type="button" class="download-btn" data-download-certificate data-url="${safeUrl}" data-title="${safeTitle}">تحميل</button>
              <h4>${cert.title}</h4>
              <span>تاريخ الإصدار: ${cert.issuedAt}</span>
              ${
                cert.verificationCode
                  ? `<span class="certificate-code">رمز التحقق: ${cert.verificationCode}</span>`
                  : ""
              }
              <div class="certificate-actions">
                <button type="button" data-open-certificate data-url="${safeUrl}">
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

        certList.querySelectorAll("[data-open-certificate]").forEach((button) => {
          button.addEventListener("click", () => {
            const url = decodeURIComponent(button.getAttribute("data-url") || "");
            window.openCertificate(url);
          });
        });

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
