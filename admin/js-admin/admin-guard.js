// js/admin-guard.js
// ====================
// حماية صفحات الأدمن (Google Auth فقط)
// ====================

import { auth, db } from "/js/firebase-config.js";
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ADMIN_EMAILS = [
  "kaleadsalous30@gmail.com",
  "coursehub03@gmail.com"
];

export function protectAdmin() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      try {
        // غير مسجل دخول → تسجيل دخول Google
        if (!user) {
          const provider = new GoogleAuthProvider();
          const result = await signInWithPopup(auth, provider);
          user = result.user;
        }

        const normalizedEmail = String(user?.email || "").toLowerCase();

        // سماح مباشر للأدمنات المعروفين
        if (ADMIN_EMAILS.includes(normalizedEmail)) {
          resolve(user);
          return;
        }

        let role = "";

        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          role = userDoc.exists() ? String(userDoc.data()?.role || "") : "";
        } catch (error) {
          const cached = JSON.parse(localStorage.getItem("coursehub_user") || "null");
          role = String(cached?.role || "");
          console.warn(
            "تعذر قراءة users/{uid} أثناء التحقق من الأدمن. تم استخدام localStorage كحل بديل.",
            error
          );
        }

        if (role !== "admin") {
          alert("غير مسموح بالدخول إلى هذه الصفحة");
          window.location.href = "/index.html";
          return;
        }

        resolve(user);
      } catch (err) {
        console.error("خطأ في التحقق من الأدمن:", err);
        alert("حدث خطأ أثناء التحقق من الصلاحيات");
        window.location.href = "/login.html";
      }
    });
  });
}