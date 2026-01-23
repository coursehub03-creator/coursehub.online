// js/firebase-config.js
// ====================
// إعداد Firebase الأساسي لجميع الصفحات

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

// إعدادات Firebase لمشروعك
const firebaseConfig = {
  apiKey: "AIzaSyDV9DaGphy6cyNt1UEITkQDlTim1w8vm8M",
  authDomain: "coursehub-23ed2.firebaseapp.com",
  projectId: "coursehub-23ed2",
  storageBucket: "coursehub-23ed2.firebasestorage.app",
  messagingSenderId: "367073521017",
  appId: "1:367073521017:web:67f5fd3be4c6407247d3a8",
  measurementId: "G-NJ6E39V9NW"
};

// تهيئة Firebase
export const app = initializeApp(firebaseConfig);

// Authentication
export const auth = getAuth(app);

// Google Sign-In
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" }); // ✅ يفرض اختيار الحساب عند تسجيل الدخول

// Firestore
export const db = getFirestore(app);

// Analytics (اختياري)
export const analytics = getAnalytics(app);

// ✅ ملاحظة:
// - لا تضع مفاتيح API قديمة.
// - تأكد من أن Authorized domains تشمل:
//    http://localhost:5500 (للتطوير المحلي)
//    https://coursehub.online (للنشر)
// - Client ID الخاص بـ Google Sign-In يجب إضافته في Google Cloud Console.
