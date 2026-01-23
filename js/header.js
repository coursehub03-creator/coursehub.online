// js/main.js
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.6.1/firebase-auth.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);

document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, (user) => {
    const loginBtn = document.getElementById("login-btn");
    const userBox = document.getElementById("user-box");
    const userName = document.getElementById("user-name");
    const userAvatar = document.getElementById("user-avatar");

    if (!loginBtn || !userBox) return;

    if (user) {
      // إخفاء زر تسجيل الدخول
      loginBtn.style.display = "none";

      // إظهار بيانات المستخدم
      userBox.style.display = "flex";
      userName.textContent = user.displayName || "مستخدم";
      userAvatar.src = user.photoURL || "img/default-avatar.png";
    } else {
      // العكس
      loginBtn.style.display = "inline-block";
      userBox.style.display = "none";
    }
  });
});
