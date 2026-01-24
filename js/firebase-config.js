// js/firebase-config.js
// ====================
// إعداد Firebase الأساسي لجميع الصفحات
// ====================

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

// إعدادات Firebase لمشروعك
const firebaseConfig = {
  apiKey: "AIzaSyDa84fRquyZah629wkTZACFVVZ7Gmnk1MY",
  authDomain: "coursehub-23ed2.firebaseapp.com",
  projectId: "coursehub-23ed2",
  storageBucket: "coursehub-23ed2.firebasestorage.app",
  messagingSenderId: "367073521017",
  appId: "1:367073521017:web:67f5fd3be4c6407247d3a8",
  measurementId: "G-NJ6E39V9NW"
};

// تهيئة التطبيق إذا لم يتم تهيئته مسبقاً
export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Authentication
export const auth = getAuth(app);

// Google Sign-In
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" }); // يفرض اختيار الحساب عند تسجيل الدخول

// Firestore
export const db = getFirestore(app);

// Analytics (اختياري)
export const analytics = getAnalytics(app);

// ✅ ملاحظات:
// - تأكد أن Authorized domains تشمل:
//    http://localhost:5500 (للتطوير المحلي)
//    https://coursehub.online (للنشر)
// - هذا الملف الآن جاهز للاستخدام في dashboard.js, courses-admin.js, add-course.js
