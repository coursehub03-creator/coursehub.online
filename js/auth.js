// js/auth.js
import { auth, googleProvider } from "./firebase-config.js";
import {
  signInWithPopup,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// تسجيل الدخول بالإيميل
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("emailInput").value;
    const password = document.getElementById("passwordInput").value;
    const errorMsg = document.getElementById("errorMsg");

    try {
      const res = await signInWithEmailAndPassword(auth, email, password);
      const user = res.user;

      localStorage.setItem("coursehub_user", JSON.stringify({
        name: user.displayName || "مستخدم",
        email: user.email,
        picture: user.photoURL || "",
        role: "student"
      }));

      window.location.href = "index.html";
    } catch (err) {
      errorMsg.textContent = "بيانات الدخول غير صحيحة";
    }
  });
}

// تسجيل الدخول عبر Google
const googleBtn = document.getElementById("googleLoginBtn");
if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const user = res.user;

      localStorage.setItem("coursehub_user", JSON.stringify({
        name: user.displayName,
        email: user.email,
        picture: user.photoURL,
        role: "student"
      }));

      window.location.href = "index.html";
    } catch (err) {
      alert("فشل تسجيل الدخول عبر Google");
      console.error(err);
    }
  });
}
