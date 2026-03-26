import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

async function renderFeatured() {
  const root = document.getElementById("featuredCourses");
  if (!root) return;

  try {
    const snap = await getDocs(query(collection(db, "courses"), where("status", "==", "published")));
    const courses = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => Number(b.updatedAt?.seconds || b.createdAt?.seconds || 0) - Number(a.updatedAt?.seconds || a.createdAt?.seconds || 0))
      .slice(0, 3);

    if (!courses.length) {
      root.innerHTML = `<article class="ch-card quote-card"><p>لا توجد دورات منشورة حاليًا.</p></article>`;
      return;
    }

    root.innerHTML = courses.map((course) => `
      <article class="ch-card landing-card">
        <img src="${escapeHtml(course.image || "assets/images/default-course.png")}" width="480" height="260" alt="${escapeHtml(course.title || "")}">
        <div class="landing-card-body">
          <span class="ch-badge published">published</span>
          <h3>${escapeHtml(course.title || "دورة بدون عنوان")}</h3>
          <p>${escapeHtml(course.description || "بدون وصف")}</p>
          <div class="meta">⭐ ${Number(course.rating || 0).toFixed(1)} • ${Number(course.enrollmentsCount || 0)} طالب • ${escapeHtml(course.duration || "")}</div>
          <a class="ch-btn primary" href="course-detail.html?id=${encodeURIComponent(course.id)}">عرض التفاصيل</a>
        </div>
      </article>
    `).join("");
  } catch (error) {
    console.error("تعذر تحميل الدورات المميزة:", error);
    root.innerHTML = `<article class="ch-card quote-card"><p>تعذر تحميل الدورات الآن.</p></article>`;
  }
}

function renderTestimonials() {
  const root = document.getElementById("testimonials");
  if (!root) return;
  root.innerHTML = `
    <article class="ch-card quote-card"><p>“منصة ممتازة ومحتوى عملي جدًا.”</p><strong>متعلم</strong><span>CourseHub</span></article>
    <article class="ch-card quote-card"><p>“تجربة منظمة من التسجيل حتى الشهادة.”</p><strong>طالب</strong><span>CourseHub</span></article>
    <article class="ch-card quote-card"><p>“الاختبارات والمتابعة رفعت مستوى التعلّم عندي.”</p><strong>مستخدم</strong><span>CourseHub</span></article>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  renderFeatured();
  renderTestimonials();
});
