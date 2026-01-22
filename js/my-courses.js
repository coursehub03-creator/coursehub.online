// js/my-courses.js

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("my-courses-list");
  if (!container) return;

  const user = JSON.parse(localStorage.getItem("coursehub_user"));
  if (!user) return;

  const courses = JSON.parse(localStorage.getItem("courses") || "[]");
  if (courses.length === 0) {
    container.innerHTML = "<p>لم يتم التسجيل في أي دورة بعد.</p>";
    return;
  }

  container.innerHTML = courses.map(c => `
    <div class="course-item">
      <h3>${c.title}</h3>
      <p>${c.description}</p>
      <a href="course-detail.html?id=${c.id}">عرض الدورة</a>
    </div>
  `).join("");
});
