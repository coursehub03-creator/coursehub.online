import { demoCourses } from "./coursehub-demo-data.js";

let state = { search: "", category: "all", level: "all", price: "all", sort: "top", page: 1, pageSize: 6 };

const all = [...demoCourses, ...demoCourses.map((c, i) => ({ ...c, id: `${c.id}-x${i}`, title: `${c.title} (${i + 1})`, status: "published" }))];

function filteredCourses() {
  return all
    .filter((c) => (state.category === "all" ? true : c.category === state.category))
    .filter((c) => (state.level === "all" ? true : c.level === state.level))
    .filter((c) => (state.price === "all" ? true : state.price === "free" ? c.price === "مجاني" : c.price !== "مجاني"))
    .filter((c) => `${c.title} ${c.description}`.toLowerCase().includes(state.search.toLowerCase()))
    .sort((a, b) => state.sort === "latest" ? b.id.localeCompare(a.id) : b.rating - a.rating);
}

function render() {
  const list = filteredCourses();
  const root = document.getElementById("catalogGrid");
  const empty = document.getElementById("catalogEmpty");
  const slice = list.slice(0, state.page * state.pageSize);

  root.innerHTML = slice.map((c) => `
  <article class="ch-card landing-card">
    <img src="assets/images/default-course.png" width="480" height="260" alt="${c.title}" loading="lazy">
    <div class="landing-card-body">
      <span class="ch-badge ${c.status}">${c.status}</span>
      <h3>${c.title}</h3><p>${c.description}</p>
      <div class="meta">${c.level} • ${c.language} • ⭐ ${c.rating}</div>
      <a class="ch-btn primary" href="course-detail.html?id=${c.id}">عرض الدورة</a>
    </div>
  </article>`).join("");

  empty.style.display = slice.length ? "none" : "block";
  document.getElementById("loadMore").style.display = slice.length < list.length ? "inline-flex" : "none";
}

document.addEventListener("DOMContentLoaded", () => {
  ["search","category","level","price","sort"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", (e) => {
      state[id] = e.target.value;
      state.page = 1;
      render();
    });
  });
  document.getElementById("loadMore")?.addEventListener("click", () => { state.page += 1; render(); });
  render();
});
