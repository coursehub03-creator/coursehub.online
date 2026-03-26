import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  where,
  query
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let state = { search: "", category: "all", level: "all", price: "all", sort: "top", page: 1, pageSize: 6 };
let allCourses = [];
let categories = [];

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function filteredCourses() {
  return allCourses
    .filter((c) => (state.category === "all" ? true : String(c.category || "") === state.category))
    .filter((c) => (state.level === "all" ? true : String(c.level || "") === state.level))
    .filter((c) => (state.price === "all" ? true : state.price === "free" ? Number(c.price || 0) <= 0 : Number(c.price || 0) > 0))
    .filter((c) => `${c.title} ${c.description}`.toLowerCase().includes(state.search.toLowerCase()))
    .sort((a, b) => {
      if (state.sort === "latest") {
        const aTime = Number(a.updatedAt?.seconds || a.createdAt?.seconds || 0);
        const bTime = Number(b.updatedAt?.seconds || b.createdAt?.seconds || 0);
        return bTime - aTime;
      }
      return Number(b.rating || 0) - Number(a.rating || 0);
    });
}

function render() {
  const list = filteredCourses();
  const root = document.getElementById("catalogGrid");
  const empty = document.getElementById("catalogEmpty");
  const slice = list.slice(0, state.page * state.pageSize);

  if (!root || !empty) return;

  root.innerHTML = slice.map((c) => `
  <article class="ch-card landing-card">
    <img src="${escapeHtml(c.image || "assets/images/default-course.png")}" width="480" height="260" alt="${escapeHtml(c.title)}" loading="lazy">
    <div class="landing-card-body">
      <span class="ch-badge published">published</span>
      <h3>${escapeHtml(c.title)}</h3><p>${escapeHtml(c.description || "بدون وصف")}</p>
      <div class="meta">${escapeHtml(c.level || "-")} • ${escapeHtml(c.language || "-")} • ⭐ ${Number(c.rating || 0).toFixed(1)}</div>
      <a class="ch-btn primary" href="course-detail.html?id=${encodeURIComponent(c.id)}">عرض الدورة</a>
    </div>
  </article>`).join("");

  empty.style.display = slice.length ? "none" : "block";
  const loadMore = document.getElementById("loadMore");
  if (loadMore) {
    loadMore.style.display = slice.length < list.length ? "inline-flex" : "none";
  }
}

function renderCategoryOptions() {
  const categorySelect = document.getElementById("category");
  if (!categorySelect) return;

  const current = categorySelect.value || "all";
  categorySelect.innerHTML = `
    <option value="all">الكل</option>
    ${categories.map((cat) => `<option value="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</option>`).join("")}
  `;
  if ([...categorySelect.options].some((opt) => opt.value === current)) {
    categorySelect.value = current;
  }
}

async function loadCatalogData() {
  const [coursesSnap, categoriesSnap] = await Promise.all([
    getDocs(query(collection(db, "courses"), where("status", "==", "published"))),
    getDocs(collection(db, "courseCategories"))
  ]);

  allCourses = coursesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  categories = categoriesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((c) => String(c.name || "").trim())
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "ar"));
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadCatalogData();
    renderCategoryOptions();
  } catch (error) {
    console.error("تعذر تحميل الكتالوج:", error);
    allCourses = [];
    categories = [];
    renderCategoryOptions();
  }

  ["search", "category", "level", "price", "sort"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", (e) => {
      state[id] = e.target.value;
      state.page = 1;
      render();
    });
  });
  document.getElementById("loadMore")?.addEventListener("click", () => {
    state.page += 1;
    render();
  });

  render();
});
