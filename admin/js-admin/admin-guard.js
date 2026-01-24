// js/admin-guard.js
// ====================
// حماية صفحات الأدمن (Google Auth فقط)
// ====================

import { auth } from "/js/firebase-config.js";
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// الإيميلات المسموح لها بالدخول كأدمن
const ADMIN_EMAILS = [
  "kaleadsalous30@gmail.com",
  "coursehub03@gmail.com"
];

export function protectAdmin() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      try {
        // ❌ غير مسجل دخول → تسجيل دخول Google
        if (!user) {
          const provider = new GoogleAuthProvider();
          const result = await signInWithPopup(auth, provider);
          user = result.user;
        }

        // ❌ ليس أدمن
        if (!ADMIN_EMAILS.includes(user.email)) {
          alert("غير مسموح بالدخول إلى هذه الصفحة");
          window.location.href = "/index.html";
          return;
        }

        // ✅ أدمن
        resolve(user);

      } catch (err) {
        console.error("خطأ في التحقق من الأدمن:", err);
        alert("حدث خطأ أثناء التحقق من الصلاحيات");
        window.location.href = "/login.html";
      }
    });
  });
}
