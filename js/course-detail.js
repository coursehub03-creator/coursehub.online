import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const id = params.get("id") || "";

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function renderNotFound(message) {
  document.getElementById("courseTitle").textContent = "الدورة غير متاحة";
  document.getElementById("courseStatus").textContent = "archived";
  document.getElementById("courseStatus").className = "ch-badge archived";
  document.getElementById("courseMeta").textContent = message;
  document.getElementById("coursePrice").textContent = "-";
  document.getElementById("outcomes").innerHTML = "<li>لا توجد بيانات متاحة.</li>";
  document.getElementById("curriculum").innerHTML = "<p>هذه الدورة غير منشورة حاليًا.</p>";
  document.getElementById("joinBtn").setAttribute("href", "courses.html");
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!id) {
    renderNotFound("لم يتم العثور على معرف الدورة.");
    return;
  }

  try {
    const snap = await getDoc(doc(db, "courses", id));
    if (!snap.exists()) {
      renderNotFound("الدورة غير موجودة.");
      return;
    }

    const course = snap.data() || {};
    if (String(course.status || "") !== "published") {
      renderNotFound("هذه الدورة ليست منشورة بعد.");
      return;
    }

    document.getElementById("courseTitle").textContent = course.title || "بدون عنوان";
    document.getElementById("courseStatus").textContent = "published";
    document.getElementById("courseStatus").className = "ch-badge published";
    document.getElementById("courseMeta").textContent = `${course.instructorName || "مدرّب"} • ${course.duration || "-"} • ${course.level || "-"} • ⭐ ${Number(course.rating || 0).toFixed(1)}`;
    document.getElementById("coursePrice").textContent = `السعر: ${Number(course.price || 0) <= 0 ? "مجاني" : `${course.price}$`}`;
    document.getElementById("courseImage").src = course.image || "assets/images/default-course.png";

    const outcomes = Array.isArray(course.outcomes) ? course.outcomes : [];
    document.getElementById("outcomes").innerHTML = outcomes.length
      ? outcomes.map((x) => `<li>${escapeHtml(x)}</li>`).join("")
      : "<li>سيتم إضافة مخرجات التعلم قريبًا.</li>";

    const lessons = Array.isArray(course.lessons) ? course.lessons : [];
    document.getElementById("curriculum").innerHTML = lessons.length
      ? lessons.map((lesson, idx) => `<p>الوحدة ${idx + 1}: ${escapeHtml(lesson.title || "درس")}</p>`).join("")
      : "<p>لا توجد دروس متاحة للعرض الآن.</p>";

    document.getElementById("joinBtn").href = `course-player.html?id=${encodeURIComponent(id)}`;
  } catch (error) {
    console.error("تعذر تحميل تفاصيل الدورة:", error);
    renderNotFound("حدث خطأ أثناء تحميل بيانات الدورة.");
  }
});
