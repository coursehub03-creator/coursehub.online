// dashboard.js
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.16.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.16.0/firebase-auth.js";

const auth = getAuth();
const db = getFirestore();

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
    document.querySelector("#usersCard span").textContent = usersSnap.size;

    const coursesSnap = await getDocs(collection(db, "courses"));
    document.querySelector("#coursesCard span").textContent = coursesSnap.size;

    const certSnap = await getDocs(collection(db, "certificates"));
    document.querySelector("#certificatesCard span").textContent = certSnap.size;

    const testsSnap = await getDocs(collection(db, "tests"));
    document.querySelector("#testsCard span").textContent = testsSnap.size;
  } catch (err) {
    console.error("فشل تحميل إحصاءات لوحة التحكم:", err);
  }
}
