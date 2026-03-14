import { db } from "/js/firebase-config.js";
import { collection, getDocs, addDoc, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { protectAdmin } from "./admin-guard.js";

document.addEventListener("adminLayoutLoaded", init);

async function init() {
  await protectAdmin();
  document.getElementById("addCategoryBtn")?.addEventListener("click", addCategory);
  await loadCategories();
}

async function loadCategories() {
  const rows = document.getElementById("categoriesRows");
  try {
    const snap = await getDocs(collection(db, "courseCategories"));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (!items.length) {
      rows.innerHTML = "<tr><td colspan='2'>لا توجد تصنيفات بعد.</td></tr>";
      return;
    }
    rows.innerHTML = items.map((x) => `<tr><td>${x.name || "-"}</td><td><button class='btn danger small' data-del='${x.id}'>حذف</button></td></tr>`).join("");
    rows.querySelectorAll("[data-del]").forEach((btn) => btn.addEventListener("click", async () => {
      await deleteDoc(doc(db, "courseCategories", btn.dataset.del));
      await loadCategories();
    }));
  } catch (e) {
    rows.innerHTML = "<tr><td colspan='2'>تعذر تحميل التصنيفات.</td></tr>";
  }
}

async function addCategory() {
  const input = document.getElementById("newCategoryName");
  const name = input?.value?.trim();
  if (!name) return;
  await addDoc(collection(db, "courseCategories"), { name, createdAt: serverTimestamp() });
  input.value = "";
  await loadCategories();
}
