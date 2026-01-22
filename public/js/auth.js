// js/auth.js
import { auth, googleProvider } from "./firebase-config.js";
import { signInWithPopup, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.16.0/firebase-auth.js";

// =====================
// تسجيل الدخول بالبريد الإلكتروني
// =====================
const form = document.getElementById("loginForm");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const errorMsg = document.getElementById("errorMsg");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const cred = await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
      const user = cred.user;

      localStorage.setItem("coursehub_user", JSON.stringify({
        name: user.displayName || "",
        email: user.email,
        picture: user.photoURL || "",
        role: "student"
      }));

      window.location.href = "index.html";
    } catch (err) {
      console.error(err);
      errorMsg.textContent = "بيانات الدخول غير صحيحة";
    }
  });
}

// =====================
// تسجيل الدخول عبر Google
// =====================
const googleBtn = document.getElementById("googleLoginBtn");

if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      localStorage.setItem("coursehub_user", JSON.stringify({
        name: user.displayName,
        email: user.email,
        picture: user.photoURL,
        role: "student"
      }));

      window.location.href = "index.html";
    } catch (err) {
      console.error(err);
      alert("فشل تسجيل الدخول عبر Google: " + err.message);
    }
  });
}
