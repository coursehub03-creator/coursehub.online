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

if (form) {
  form.addEventListener("submit", async e => {
    e.preventDefault();
    try {
      const email = document.getElementById("emailInput").value.trim();
      const password = document.getElementById("passwordInput").value.trim();

      const cred = await signInWithEmailAndPassword(auth, email, password);
      saveUser({ email: cred.user.email, uid: cred.user.uid, role: "student" });
      redirect("student");
    } catch (err) {
      console.error(err);
      if (errorMsg) errorMsg.textContent = "بيانات الدخول غير صحيحة";
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
        picture: user.photoURL,
        role: "student"
      });
      redirect("student");
    } catch (err) {
      console.error(err);
      alert("فشل تسجيل الدخول عبر Google: " + err.message);
    }
  });
}
