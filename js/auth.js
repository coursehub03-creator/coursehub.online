import { auth, googleProvider } from "./firebase-config.js";
import {
  signInWithPopup,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// دالة لحفظ بيانات المستخدم في localStorage
function saveUserAndRedirect(user) {
  localStorage.setItem("coursehub_user", JSON.stringify({
    name: user.displayName || "مستخدم",
    email: user.email,
    picture: user.photoURL || "",
    role: "student"
  }));
  window.location.href = "index.html";
}

// تسجيل الدخول بالإيميل
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const emailInput = document.getElementById("emailInput");
    const passwordInput = document.getElementById("passwordInput");
    const errorMsg = document.getElementById("errorMsg");

    if (!emailInput || !passwordInput) return;

    try {
      const res = await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
      saveUserAndRedirect(res.user);
    } catch (err) {
      if (errorMsg) errorMsg.textContent = "بيانات الدخول غير صحيحة";
      console.error("Login Error:", err);
    }
  });
}

// تسجيل الدخول عبر Google
const googleBtn = document.getElementById("googleLoginBtn");
if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    const errorMsg = document.getElementById("errorMsg");
    if (errorMsg) errorMsg.textContent = "";

    try {
      const res = await signInWithPopup(auth, googleProvider);
      saveUserAndRedirect(res.user);
    } catch (err) {
      if (errorMsg) errorMsg.textContent = "فشل تسجيل الدخول عبر Google";
      console.error("Google Login Error:", err);
    }
  });
}
