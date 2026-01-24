// dashboard.js
import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

  await loadDashboardStats();
});

async function loadDashboardStats() {
  try {
    const usersSnap = await getDocs(collection(db, "users"));
    const usersCard = document.querySelector("#usersCard span");
    if (usersCard) usersCard.textContent = usersSnap.size;

    const coursesSnap = await getDocs(collection(db, "courses"));
    const coursesCard = document.querySelector("#coursesCard span");
    if (coursesCard) coursesCard.textContent = coursesSnap.size;

    const certSnap = await getDocs(collection(db, "certificates"));
    const certificatesCard = document.querySelector("#certificatesCard span");
    if (certificatesCard) certificatesCard.textContent = certSnap.size;

    const testsSnap = await getDocs(collection(db, "tests"));
    const testsCard = document.querySelector("#testsCard span");
    if (testsCard) testsCard.textContent = testsSnap.size;

  } catch (err) {
    console.error("فشل تحميل إحصاءات لوحة التحكم:", err);
  }
}
