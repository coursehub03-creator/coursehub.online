import { db } from "/js/firebase-config.js";
import { protectAdmin } from "./admin-guard.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener("adminLayoutLoaded", initDashboard);

async function initDashboard() {
  try {
    await protectAdmin();
    await loadDashboardStats();
  } catch (err) {
    console.error("❌ خطأ في تهيئة لوحة التحكم:", err);
  }
}

async function loadDashboardStats() {
  try {
    const usersSnap = await getDocs(collection(db, "users"));
    updateCard("usersCard", usersSnap.size);

    const coursesSnap = await getDocs(collection(db, "courses"));
    updateCard("coursesCard", coursesSnap.size);

    const certSnap = await getDocs(collection(db, "certificates"));
    updateCard("certificatesCard", certSnap.size);

    const testsSnap = await getDocs(collection(db, "tests"));
    updateCard("testsCard", testsSnap.size);
  } catch (err) {
    console.error("❌ فشل تحميل إحصاءات لوحة التحكم:", err);
  }
}

function updateCard(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}
