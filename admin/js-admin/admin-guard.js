// js/admin-guard.js
// ====================
// حماية صفحات الأدمن باستخدام Google Auth فقط
// ====================

import { auth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "./firebase-config.js";

// قائمة البريد الإلكتروني للأدمن
const ADMIN_EMAILS = ["kaleadsalous30@gmail.com", "coursehub03@gmail.com"];

/**
 * حماية صفحة الأدمن.
 * @returns Promise<User> - يعيد كائن المستخدم إذا كان أدمن
 */
export async function protectAdmin() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      try {
        // إذا لم يكن المستخدم مسجّل دخول
        if (!user) {
          const provider = new GoogleAuthProvider();
          const result = await signInWithPopup(auth, provider);
          user = result.user;
        }

        // التحقق من أن البريد الإلكتروني للأدمن
        if (!ADMIN_EMAILS.includes(user.email)) {
          alert("غير مسموح بالدخول إلى هذه الصفحة!");
          window.location.href = "/index.html";
          return;
        }

        // إذا كل شيء تمام، المستخدم أدمن
        resolve(user);
      } catch (err) {
        console.error("خطأ أثناء التحقق من الأدمن:", err);
        alert("حدث خطأ أثناء التحقق من الأدمن.");
        window.location.href = "/login.html";
      }
    });
  });
}
