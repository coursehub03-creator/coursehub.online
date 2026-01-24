// dashboard.js
import { db, auth } from "/js/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ==============================
// التحقق من الأدمن
// ==============================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("يرجى تسجيل الدخول أولاً");
    window.location.href = "/login.html";
    return;
  }

  let userData = null;
  try {
    const rawData = localStorage.getItem("coursehub_user");
    if (rawData) userData = JSON.parse(rawData);
  } catch (err) {
    console.error("خطأ في قراءة بيانات المستخدم من localStorage:", err);
  }

  if (!userData || userData.role !== "admin") {
    alert("غير مسموح بالدخول إلى هذه الصفحة");
    window.location.href = "/index.html";
    return;
  }

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
