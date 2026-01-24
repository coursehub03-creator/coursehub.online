// ====================
// إعداد Firebase لجميع الصفحات والدورات
// ====================

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

// ===== إعدادات Firebase لمشروعك =====
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

// ====================
// Firebase Services
// ====================

// Authentication
export const auth = getAuth(app);

// Google Sign-In
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// Firestore
export const db = getFirestore(app);

// Storage (لرفع الفيديوهات / الصور / ملفات PDF / الموارد)
export const storage = getStorage(app);

// Analytics (اختياري)
export const analytics = getAnalytics(app);

// ====================
// ملاحظات مهمة:
// 1. تأكد من إضافة Authorized domains:
//    - http://localhost:5500 (التطوير المحلي)
//    - https://coursehub.online (النشر)
// 2. يمكن استخدام هذا الملف مباشرة في:
//    dashboard.js, courses-admin.js, add-course.js, course-detail.js
// 3. التخزين (Storage) يستخدم مسارات:
//    - courses/cover-images/
//    - lessons/videos/
//    - lessons/slides/
//    - lessons/resources/
// ====================
