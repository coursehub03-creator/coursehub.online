import { db } from "/js/firebase-config.js";
import { collection, getDocs, addDoc, deleteDoc, doc, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { protectAdmin } from "./admin-guard.js";

document.addEventListener("adminLayoutLoaded", init);

let allCategories = [];
let courseUsageMap = new Map();

/* ===== Helpers ===== */
const isPermissionDenied = (error) => {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  return code.includes("permission-denied") || message.includes("insufficient permissions");
};

function formatDate(dateLike) {
  if (!dateLike) return "-";
  const date = dateLike?.toDate ? dateLike.toDate() : new Date(dateLike);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/* ===== Init ===== */
async function init() {
  try {
    await protectAdmin();
    document.getElementById("addCategoryBtn")?.addEventListener("click", addCategory);
    document.getElementById("categoriesSearch")?.addEventListener("input", renderCategories);
    await loadCategories();
  } catch (error) {
    console.error("فشل تهيئة صفحة التصنيفات:", error);
  }
}

/* ===== Load Data ===== */
async function loadCourseUsage() {
  try {
    const snap = await getDocs(collection(db, "courses"));
    courseUsageMap = new Map();

    snap.forEach((docSnap) => {
      const cat = String(docSnap.data()?.category || "").trim();
      if (!cat) return;
      courseUsageMap.set(cat, (courseUsageMap.get(cat) || 0) + 1);
    });
  } catch (error) {
    if (isPermissionDenied(error)) {
      courseUsageMap = new Map();
      return;
    }
    throw error;
  }
}

async function loadCategories() {
  const rows = document.getElementById("categoriesRows");

  try {
    await loadCourseUsage();

    const snap = await getDocs(collection(db, "courseCategories"));
    allCategories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    renderCategories();
  } catch (e) {
    console.error(e);

    rows.innerHTML = isPermissionDenied(e)
      ? "<tr><td colspan='5'>لا تملك صلاحية قراءة التصنيفات (courseCategories).</td></tr>"
      : "<tr><td colspan='5'>تعذر تحميل التصنيفات.</td></tr>";
  }
}

/* ===== Render ===== */
function renderCategories() {
  const rows = document.getElementById("categoriesRows");
  const q = (document.getElementById("categoriesSearch")?.value || "").toLowerCase().trim();

  const items = allCategories
    .filter((item) => {
      const name = String(item.name || "").toLowerCase();
      const desc = String(item.description || "").toLowerCase();
      return !q || name.includes(q) || desc.includes(q);
    })
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ar"));

  if (!items.length) {
    rows.innerHTML = "<tr><td colspan='5'>لا توجد تصنيفات مطابقة.</td></tr>";
    return;
  }

  rows.innerHTML = items.map((x) => {
    const usage = courseUsageMap.get(x.name) || 0;

    return `
      <tr>
        <td><strong>${x.name || "-"}</strong></td>
        <td>${x.description || "-"}</td>
        <td>${usage}</td>
        <td>${formatDate(x.updatedAt || x.createdAt)}</td>
        <td>
          <button class='btn outline small' data-edit='${x.id}'>تعديل</button>
          <button class='btn danger small' data-del='${x.id}'>حذف</button>
        </td>
      </tr>
    `;
  }).join("");

  rows.querySelectorAll("[data-del]").forEach((btn) => btn.addEventListener("click", onDelete));
  rows.querySelectorAll("[data-edit]").forEach((btn) => btn.addEventListener("click", onEdit));
}

/* ===== Actions ===== */
async function addCategory() {
  const nameInput = document.getElementById("newCategoryName");
  const descInput = document.getElementById("newCategoryDescription");

  const name = nameInput?.value?.trim();
  const description = descInput?.value?.trim() || "";

  if (!name) {
    alert("أدخل اسم التصنيف.");
    return;
  }

  const duplicate = allCategories.some(
    (item) => String(item.name || "").trim().toLowerCase() === name.toLowerCase()
  );

  if (duplicate) {
    alert("هذا التصنيف موجود مسبقًا.");
    return;
  }

  try {
    await addDoc(collection(db, "courseCategories"), {
      name,
      description,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    nameInput.value = "";
    if (descInput) descInput.value = "";

    await loadCategories();
  } catch (error) {
    console.error(error);
    alert(
      isPermissionDenied(error)
        ? "لا تملك صلاحية إضافة تصنيف. تحقق من قواعد Firestore."
        : "تعذر إضافة التصنيف."
    );
  }
}

async function onEdit(event) {
  const id = event.currentTarget.dataset.edit;
  const current = allCategories.find((item) => item.id === id);
  if (!current) return;

  const nextName = prompt("اسم التصنيف الجديد", current.name || "");
  if (nextName === null) return;

  const cleanedName = nextName.trim();
  if (!cleanedName) {
    alert("اسم التصنيف لا يمكن أن يكون فارغًا.");
    return;
  }

  const nextDescription = prompt("وصف مختصر", current.description || "");
  if (nextDescription === null) return;

  const duplicate = allCategories.some(
    (item) =>
      item.id !== id &&
      String(item.name || "").trim().toLowerCase() === cleanedName.toLowerCase()
  );

  if (duplicate) {
    alert("اسم التصنيف مستخدم بالفعل.");
    return;
  }

  try {
    await updateDoc(doc(db, "courseCategories", id), {
      name: cleanedName,
      description: nextDescription.trim(),
      updatedAt: serverTimestamp()
    });

    await loadCategories();
  } catch (error) {
    console.error(error);
    alert(
      isPermissionDenied(error)
        ? "لا تملك صلاحية تعديل التصنيف."
        : "تعذر تعديل التصنيف."
    );
  }
}

async function onDelete(event) {
  const id = event.currentTarget.dataset.del;
  const current = allCategories.find((item) => item.id === id);
  if (!current) return;

  const usage = courseUsageMap.get(current.name) || 0;

  if (usage > 0) {
    alert("لا يمكن حذف تصنيف مرتبط بدورات حالية. قم بتغيير التصنيف من الدورات أولاً.");
    return;
  }

  if (!confirm(`هل تريد حذف التصنيف "${current.name}"؟`)) return;

  try {
    await deleteDoc(doc(db, "courseCategories", id));
    await loadCategories();
  } catch (error) {
    console.error(error);
    alert(
      isPermissionDenied(error)
        ? "لا تملك صلاحية حذف التصنيف."
        : "تعذر حذف التصنيف."
    );
  }
}