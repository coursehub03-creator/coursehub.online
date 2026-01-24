// courses-admin.js
import { db } from "/js/firebase-config.js";
import { protectAdmin } from "./admin-guard.js";
import {
  collection,
  getDocs,
  doc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", async () => {
  // التحقق من الأدمن
  const adminUser = await protectAdmin();
  console.log("المستخدم الأدمن:", adminUser.email);

  const pageContent = document.getElementById("page-content");
  if (!pageContent) return;

  // ⚠️ تحديد type="button" مهم جدًا
  pageContent.innerHTML = `
    <button
      type="button"
      id="add-course-btn"
      class="admin-btn"
    >
      إضافة دورة جديدة
    </button>

    <table class="admin-table">
      <thead>
        <tr>
          <th>عنوان الدورة</th>
          <th>الوصف</th>
          <th>إجراءات</th>
        </tr>
      </thead>
      <tbody id="courses-table-body"></tbody>
    </table>
  `;

  const tbody = document.getElementById("courses-table-body");
  const addBtn = document.getElementById("add-course-btn");

  // ✅ الانتقال الصحيح
  if (addBtn) {
    addBtn.addEventListener("click", (e) => {
      e.preventDefault(); // 🔥 مهم
      console.log("زر إضافة الدورة انضغط ✅");
      window.location.href = "/admin/add-course.html";
    });
  }

  // -----------------------------
  // تحميل الدورات
  // -----------------------------
  async function loadCourses() {
    tbody.innerHTML = "<tr><td colspan='3'>جارٍ التحميل...</td></tr>";

    try {
      const snapshot = await getDocs(collection(db, "courses"));
      tbody.innerHTML = "";

      if (snapshot.empty) {
        tbody.innerHTML =
          "<tr><td colspan='3'>لا توجد دورات حالياً.</td></tr>";
        return;
      }

      snapshot.forEach((docSnap) => {
        const course = { id: docSnap.id, ...docSnap.data() };

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${course.title}</td>
          <td>${course.description}</td>
          <td>
            <button
              type="button"
              class="delete-btn"
              data-id="${course.id}"
            >
              حذف
            </button>
          </td>
        `;

        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error("فشل تحميل الدورات:", err);
      tbody.innerHTML =
        "<tr><td colspan='3'>حدث خطأ أثناء تحميل الدورات.</td></tr>";
    }
  }

  // -----------------------------
  // حذف دورة
  // -----------------------------
  tbody.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("delete-btn")) return;

    const id = e.target.dataset.id;

    if (!confirm("هل تريد حذف هذه الدورة؟")) return;

    try {
      await deleteDoc(doc(db, "courses", id));
      await loadCourses();
    } catch (err) {
      console.error("فشل حذف الدورة:", err);
      alert("حدث خطأ أثناء الحذف.");
    }
  });

  await loadCourses();
});
