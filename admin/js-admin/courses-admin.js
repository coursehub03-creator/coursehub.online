// js-admin/courses-admin.js

import { db } from "/js/firebase-config.js";
import { protectAdmin } from "./admin-guard.js";
import {
  collection,
  getDocs,
  doc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", async () => {
  // 🔐 حماية الأدمن
  const adminUser = await protectAdmin();
  console.log("أدمن مسجل:", adminUser.email);

  const addBtn = document.getElementById("add-course-btn");
  const tbody = document.getElementById("courses-list");

  if (!addBtn || !tbody) {
    console.error("عناصر الصفحة غير موجودة");
    return;
  }

  // ✅ زر إضافة دورة
  addBtn.addEventListener("click", (e) => {
    e.preventDefault();
    console.log("تم الضغط على زر إضافة دورة");
    window.location.href = "/admin/add-course.html";
  });

  // -----------------------------
  // تحميل الدورات
  // -----------------------------
  async function loadCourses() {
    tbody.innerHTML =
      "<tr><td colspan='4'>جارٍ تحميل الدورات...</td></tr>";

    try {
      const snapshot = await getDocs(collection(db, "courses"));
      tbody.innerHTML = "";

      if (snapshot.empty) {
        tbody.innerHTML =
          "<tr><td colspan='4'>لا توجد دورات حالياً</td></tr>";
        return;
      }

      snapshot.forEach((docSnap) => {
        const course = docSnap.data();

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${course.title || "-"}</td>
          <td>${course.description || "-"}</td>
          <td>${course.studentsCount || 0}</td>
          <td>
            <button
              type="button"
              class="delete-btn"
              data-id="${docSnap.id}"
            >
              حذف
            </button>
          </td>
        `;

        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error("خطأ في تحميل الدورات:", err);
      tbody.innerHTML =
        "<tr><td colspan='4'>حدث خطأ أثناء التحميل</td></tr>";
    }
  }

  // -----------------------------
  // حذف دورة
  // -----------------------------
  tbody.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("delete-btn")) return;

    const courseId = e.target.dataset.id;

    if (!confirm("هل أنت متأكد من حذف الدورة؟")) return;

    try {
      await deleteDoc(doc(db, "courses", courseId));
      await loadCourses();
    } catch (err) {
      console.error("فشل حذف الدورة:", err);
      alert("حدث خطأ أثناء الحذف");
    }
  });

  await loadCourses();
});
