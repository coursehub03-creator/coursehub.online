import { auth, googleProvider } from './firebase-config.js';
import { signInWithPopup, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const loginForm = document.getElementById("loginForm");
const errorMsg = document.getElementById("errorMsg");

// تسجيل الدخول بالإيميل
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("emailInput").value;
    const password = document.getElementById("passwordInput").value;

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      localStorage.setItem("coursehub_user", JSON.stringify({
        name: user.displayName || user.email.split("@")[0],
        email: user.email,
        picture: user.photoURL,
        uid: user.uid,
        role: "user"
      }));

      window.location.href = "index.html";
    } catch (error) {
      console.error("Login Error:", error);
      if (errorMsg) errorMsg.textContent = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
    }
  });
}

// تسجيل الدخول بحساب Google
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
        uid: user.uid,
        role: "user"
      }));

      window.location.href = "index.html";
    } catch (error) {
      console.error("Google Login Error:", error);
      if (errorMsg) errorMsg.textContent = "فشل تسجيل الدخول بحساب Google.";
    }
  });
}

// مراقبة حالة تسجيل الدخول
onAuthStateChanged(auth, (user) => {
  if (user) {
    const storedUser = JSON.parse(localStorage.getItem("coursehub_user"));
    if (!storedUser) {
      localStorage.setItem("coursehub_user", JSON.stringify({
        name: user.displayName,
        email: user.email,
        picture: user.photoURL,
        uid: user.uid,
        role: "user"
      }));
    }
  }
});
