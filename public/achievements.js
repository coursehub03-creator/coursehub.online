// achievements.js
import "./firebase-config.js";

const {
  auth,
  db,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc
} = window.firebaseAuth;

// تسجيل الدخول مرة واحدة فقط
async function ensureLogin() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        resolve(user);
      } else {
        const result = await signInWithPopup(auth, new GoogleAuthProvider());
        resolve(result.user);
      }
    });
  });
}

async function loadAchievements() {
  const user = await ensureLogin();

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  let data;
  if (!snap.exists()) {
    data = {
      completedCourses: [],
      certificates: []
    };
    await setDoc(userRef, data);
  } else {
    data = snap.data();
  }

  // Summary
  document.getElementById("completedCourses").textContent =
    data.completedCourses.length;

  document.getElementById("certificatesCount").textContent =
    data.certificates.length;

  // Certificates
  const certList = document.getElementById("certificatesList");
  certList.innerHTML = "";

  if (data.certificates.length === 0) {
    certList.innerHTML = "<p>لم تحصل على أي شهادة بعد.</p>";
  } else {
    data.certificates.forEach(cert => {
      certList.innerHTML += `
        <div class="certificate-card">
          <a href="${cert.certificateUrl}" download class="download-btn">تحميل</a>
          <h4>${cert.title}</h4>
          <span>تاريخ الإصدار: ${cert.issuedAt}</span>
          <button onclick="window.open('${cert.certificateUrl}', '_blank')">
            عرض الشهادة
          </button>
        </div>
      `;
    });
  }

  // Completed Courses
  const coursesList = document.getElementById("coursesList");
  coursesList.innerHTML = "";

  if (data.completedCourses.length === 0) {
    coursesList.innerHTML = "<p>لم تكمل أي دورة بعد.</p>";
  } else {
    data.completedCourses.forEach(course => {
      coursesList.innerHTML += `
        <div class="course-card">
          <img src="${course.image}" alt="${course.title}">
          <div class="course-content">
            <h4>
              <a href="course.html?id=${course.id}" style="text-decoration:none;color:#1c3faa;">
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

loadAchievements();
