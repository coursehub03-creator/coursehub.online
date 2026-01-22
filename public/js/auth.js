// js/auth.js
import { auth, googleProvider } from "./firebase-config.js";
import { signInWithEmailAndPassword, signInWithPopup, createUserWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.16.0/firebase-auth.js";

// --------- Helpers ---------
function saveUser(user) {
  localStorage.setItem("coursehub_user", JSON.stringify(user));
}

// --------- Email Login ---------
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const errorMsg = document.getElementById("errorMsg");

if (loginForm) {
  loginForm.addEventListener("submit", async e => {
    e.preventDefault();
    try {
      const cred = await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
      const user = cred.user;

      saveUser({
        name: user.displayName || "",
        email: user.email,
        picture: user.photoURL || "",
        role: "student"
      });

      window.location.href = "index.html";
    } catch (err) {
      console.error(err);
      errorMsg.textContent = "بيانات الدخول غير صحيحة";
    }
  });
}

// --------- Google Login ---------
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

      window.location.href = "index.html";
    } catch (err) {
      console.error(err);
      alert("فشل تسجيل الدخول عبر Google: " + err.message);
    }
  });
}

// --------- Register ---------
const registerForm = document.getElementById("registerForm");
const regEmail = document.getElementById("regEmail");
const regPassword = document.getElementById("regPassword");

if (registerForm) {
  registerForm.addEventListener("submit", async e => {
    e.preventDefault();
    try {
      const cred = await createUserWithEmailAndPassword(auth, regEmail.value, regPassword.value);
      const user = cred.user;

      saveUser({
        name: user.displayName || "",
        email: user.email,
        picture: user.photoURL || "",
        role: "student"
      });

      window.location.href = "index.html";
    } catch (err) {
      console.error(err);
      alert("فشل إنشاء الحساب: " + err.message);
    }
  });
}

// --------- Forgot Password ---------
const forgotForm = document.getElementById("forgotForm");
const forgotEmail = document.getElementById("forgotEmail");

if (forgotForm) {
  forgotForm.addEventListener("submit", async e => {
    e.preventDefault();
    try {
      await sendPasswordResetEmail(auth, forgotEmail.value);
      alert("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.");
    } catch (err) {
      console.error(err);
      alert("حدث خطأ: " + err.message);
    }
  });
}
