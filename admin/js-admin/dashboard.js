// dashboard.js
import { db } from "/js/firebase-config.js";
import { protectAdmin } from "./admin-guard.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// =====================================
// تشغيل Dashboard بعد تحميل Layout
// =====================================
document.addEventListener("adminLayoutLoaded", initDashboard);

async function initDashboard() {
  try {
    // ✅ التحقق من الأدمن
    const adminUser = await protectAdmin();
    console.log("المستخدم الأدمن:", adminUser.email);

    // تحميل الإحصاءات
    await loadDashboardStats();

  } catch (err) {
    console.error("❌ خطأ في تهيئة لوحة التحكم:", err);
  }
}

// =====================================
// تحميل إحصاءات لوحة التحكم
// =====================================
async function loadDashboardStats() {
  try {
    // عدد المستخدمين
    const usersSnap = await getDocs(collection(db, "users"));
    updateCard("#usersCard span", usersSnap.size);

    // عدد الدورات
    const coursesSnap = await getDocs(collection(db, "courses"));
    updateCard("#coursesCard span", coursesSnap.size);

    // عدد الشهادات
    const certSnap = await getDocs(collection(db, "certificates"));
    updateCard("#certificatesCard span", certSnap.size);

    // عدد الاختبارات
    const testsSnap = await getDocs(collection(db, "tests"));
    updateCard("#testsCard span", testsSnap.size);

  } catch (err) {
    console.error("❌ فشل تحميل إحصاءات لوحة التحكم:", err);
  }
}

// =====================================
// أداة مساعدة لتحديث البطاقات
// =====================================
function updateCard(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}
