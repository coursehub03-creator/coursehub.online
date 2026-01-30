// --- Firebase Imports ---
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.6.1/firebase-firestore.js";

// افتراضياً: firebase-config.js يستورد Firebase App ويهيئه
import { app } from "../js/firebase-config.js"; // تأكد أن ملفك firebase-config.js يصدّر "app"

const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- دالة فتح الشهادة في نافذة جديدة ---
window.openCertificate = function(url) {
  window.open(url, "_blank");
};

// --- مراقبة حالة تسجيل الدخول ---
onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) {
      // تسجيل الدخول بحساب Google
      const result = await signInWithPopup(auth, provider);
      user = result.user;
    }

    // جلب مستند المستخدم من Firestore
    const userDocRef = doc(db, "users", user.uid);
    let userDataSnap = await getDoc(userDocRef);

    let userData;
    if (!userDataSnap.exists()) {
      // إنشاء مستند جديد إذا لم يكن موجودًا
      userData = {
        completedCourses: [],
        certificates: []
      };
      await setDoc(userDocRef, userData);
    } else {
      userData = userDataSnap.data();
    }

    // --- ملخص الإنجازات ---
    document.getElementById("completedCourses").textContent = userData.completedCourses.length;
    document.getElementById("certificatesCount").textContent = userData.certificates.length;

    // --- عرض الشهادات ---
    const certList = document.getElementById("certificatesList");
    certList.innerHTML = "";
    if (userData.certificates.length === 0) {
      certList.innerHTML = "<p>لم تحصل على أي شهادة بعد.</p>";
    } else {
      userData.certificates.forEach(cert => {
        certList.innerHTML += `
          <div class="certificate-card">
            <a href="${cert.certificateUrl}" download class="download-btn">تحميل</a>
            <h4>${cert.title}</h4>
            <span>تاريخ الإصدار: ${cert.issuedAt}</span>
            <button onclick="openCertificate('${cert.certificateUrl}')">
              عرض الشهادة
            </button>
          </div>
        `;
      });
    }

    // --- عرض الدورات المكتملة ---
    const coursesList = document.getElementById("coursesList");
    coursesList.innerHTML = "";
    if (userData.completedCourses.length === 0) {
      coursesList.innerHTML = "<p>لم تكمل أي دورة بعد.</p>";
    } else {
      userData.completedCourses.forEach(course => {
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

  } catch (error) {
    console.error("Firebase Auth Error:", error);
    alert("حدث خطأ أثناء تسجيل الدخول أو جلب البيانات. حاول مرة أخرى.");
  }
});
