// dashboard.js
import { db } from "/js/firebase-config.js";
import { protectAdmin } from "./admin-guard.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", async () => {
  // ✅ التحقق من الأدمن باستخدام Google Auth فقط
  const adminUser = await protectAdmin();
  console.log("المستخدم الأدمن:", adminUser.email);

  // بعد التأكد من الأدمن، تحميل الإحصاءات
  await loadDashboardStats();
});

// ==============================
// تحميل إحصاءات لوحة التحكم
// ==============================
async function loadDashboardStats() {
  try {
    // عدد المستخدمين
    const usersSnap = await getDocs(collection(db, "users"));
    const usersCard = document.querySelector("#usersCard span");
    if (usersCard) usersCard.textContent = usersSnap.size;

    // عدد الدورات
    const coursesSnap = await getDocs(collection(db, "courses"));
    const coursesCard = document.querySelector("#coursesCard span");
    if (coursesCard) coursesCard.textContent = coursesSnap.size;

    // عدد الشهادات
    const certSnap = await getDocs(collection(db, "certificates"));
    const certificatesCard = document.querySelector("#certificatesCard span");
    if (certificatesCard) certificatesCard.textContent = certSnap.size;

    // عدد الاختبارات
    const testsSnap = await getDocs(collection(db, "tests"));
    const testsCard = document.querySelector("#testsCard span");
    if (testsCard) testsCard.textContent = testsSnap.size;

  } catch (err) {
    console.error("فشل تحميل إحصاءات لوحة التحكم:", err);
  }
}
