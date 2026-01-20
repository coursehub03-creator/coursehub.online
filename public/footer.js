import { initializeApp } from "https://www.gstatic.com/firebasejs/10.16.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.16.0/firebase-auth.js";

// تكوين Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCagdZU_eAHebBGCmG5W4FFTcDZIH4wOp0",
  authDomain: "coursehub-23ed2.firebaseapp.com",
  projectId: "coursehub-23ed2",
  storageBucket: "coursehub-23ed2.appspot.com",
  messagingSenderId: "367073521017",
  appId: "1:367073521017:web:67f5fd3be4c6407247d3a8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// البريد المسؤول
const adminEmails = ["kaleadsalous30@gmail.com"]; // ضع البريد/البريدات هنا
const adminDiv = document.getElementById("adminAddCourse");

// التحقق من المستخدم وعرض زر المسؤول إذا كان مصرح له
onAuthStateChanged(auth, (user) => {
  if (user && adminEmails.includes(user.email)) {
    adminDiv.innerHTML = `<a href="add-course.html" class="btn admin-btn">إضافة دورة جديدة</a>`;
  }
});

// تحديث السنة تلقائيًا
const yearSpan = document.getElementById("year");
if (yearSpan) {
  yearSpan.textContent = new Date().getFullYear();
}
