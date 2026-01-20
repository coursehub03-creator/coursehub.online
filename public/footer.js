import { initializeApp } from "https://www.gstatic.com/firebasejs/10.16.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.16.0/firebase-auth.js";

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
const adminEmails = ["kaleadsalous30@gmail.com"];
const adminDiv = document.getElementById("adminAddCourse");

// إظهار زر المسؤول إذا كان المستخدم مسؤول
onAuthStateChanged(auth, (user) => {
  if (user && adminEmails.includes(user.email)) {
    adminDiv.innerHTML = `
      <a href="add-course.html" class="btn admin-btn">
        إضافة دورة جديدة
      </a>
    `;
  } else {
    adminDiv.innerHTML = ""; // لا يظهر شيء إذا لم يكن المسؤول
  }
});

// تحديث السنة تلقائيًا
document.getElementById("year").textContent = new Date().getFullYear();
