import { demoCourses, demoTestimonials } from "./coursehub-demo-data.js";

function renderFeatured() {
  const root = document.getElementById("featuredCourses");
  if (!root) return;
  root.innerHTML = demoCourses.slice(0, 3).map((course) => `
    <article class="ch-card landing-card">
      <img src="assets/images/default-course.png" width="480" height="260" alt="${course.title}">
      <div class="landing-card-body">
        <span class="ch-badge ${course.status}">${course.status}</span>
        <h3>${course.title}</h3>
        <p>${course.description}</p>
        <div class="meta">⭐ ${course.rating} • ${course.students} طالب • ${course.duration}</div>
        <a class="ch-btn primary" href="course-detail.html?id=${course.id}">عرض التفاصيل</a>
      </div>
    </article>
  `).join("");
}

function renderTestimonials() {
  const root = document.getElementById("testimonials");
  if (!root) return;
  root.innerHTML = demoTestimonials.map((item) => `
    <article class="ch-card quote-card"><p>“${item.text}”</p><strong>${item.name}</strong><span>${item.role}</span></article>
  `).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  renderFeatured();
  renderTestimonials();
});
