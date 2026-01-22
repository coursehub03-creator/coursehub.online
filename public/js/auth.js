// js/auth.js
import { auth, googleProvider } from "./firebase-config.js";
import { signInWithEmailAndPassword, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.16.0/firebase-auth.js";

/* ===== Helpers ===== */
function saveUser(user) {
  localStorage.setItem("coursehub_user", JSON.stringify(user));
}

function redirect(role) {
  window.location.href = role === "admin" ? "admin/dashboard.html" : "index.html";
}

/* ===== Email Login ===== */
const form = document.getElementById("loginForm");
const errorMsg = document.getElementById("errorMsg");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");

if (form) {
  form.addEventListener("submit", async e => {
    e.preventDefault();

    try {
      const email = emailInput.value.trim();
      const password = passwordInput.value.trim();

      const cred = await signInWithEmailAndPassword(auth, email, password);

      // بيانات المستخدم
      const user = cred.user;
      saveUser({
        name: user.displayName || "طالب جديد",
        email: user.email,
        uid: user.uid,
        role: "student" // يمكن تغييره حسب الحاجة
      });

      redirect("student");

    } catch (err) {
      console.error(err);
      errorMsg.textContent = "بيانات الدخول غير صحيحة";
    }
  });
}

/* ===== Google Login ===== */
const googleBtn = document.getElementById("googleLoginBtn");

if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      saveUser({
        name: user.displayName,
        email: user.email,
        uid: user.uid,
        role: "student"
      });

      redirect("student");
    } catch (err) {
      console.error(err);
      alert("فشل تسجيل الدخول عبر Google");
    }
  });
}
