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
window.openCertificate = function (url) {
  window.open(url, "_blank");
};

// --- مراقبة حالة تسجيل الدخول ---
onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      const result = await signInWithPopup(auth, googleProvider);
      user = result.user;
    }

    const userDocRef = doc(db, "users", user.uid);
    let userDataSnap = await getDoc(userDocRef);

    let userData;
    if (!userDataSnap.exists()) {
      userData = { completedCourses: [], certificates: [] };
      await setDoc(userDocRef, userData);
    } else {
      userData = userDataSnap.data();
    }

    let completedCourses = [];
    let certificates = [];

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

    if (!certificates.length) {
      try {
        const publicCertificatesSnap = await getDocs(
          query(collection(db, "certificates"), where("userId", "==", user.uid))
        );
        certificates = publicCertificatesSnap.docs.map((docSnap) => {
          const data = docSnap.data();
          const issuedAt = data.completedAt?.toDate
            ? data.completedAt.toDate().toLocaleDateString("ar-EG")
            : data.completedAt || "";
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

    if (!completedCourses.length && Array.isArray(userData.completedCourses)) {
      completedCourses = userData.completedCourses;
    }
    if (!certificates.length && Array.isArray(userData.certificates)) {
      certificates = userData.certificates;
    }

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
          certList.innerHTML += `
            <div class="certificate-card">
              <a href="${cert.certificateUrl}" download class="download-btn">تحميل</a>
              <h4>${cert.title}</h4>
              <span>تاريخ الإصدار: ${cert.issuedAt}</span>
              ${
                cert.verificationCode
                  ? `<span class="certificate-code">رمز التحقق: ${cert.verificationCode}</span>`
                  : ""
              }
              <div class="certificate-actions">
                <button onclick="openCertificate('${cert.certificateUrl}')">
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
