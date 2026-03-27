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

function normalizeLessons(course) {
  if (Array.isArray(course.lessons) && course.lessons.length) return course.lessons;
  if (Array.isArray(course.modules)) {
    return course.modules.flatMap((module) => (module.lessons || []).map((lesson) => ({ ...lesson, moduleTitle: module.title || "" })));
  }
  return [];
}

function normalizeOutcomes(course) {
  if (Array.isArray(course.outcomes)) return course.outcomes;
  if (typeof course.outcomes === "string") return course.outcomes.split(/\n|،|,/).map((x) => x.trim()).filter(Boolean);
  return [];
}

function resolvePrice(course) {
  const pricing = course.pricing || {};
  const finalPrice = Number(pricing.finalPrice ?? course.price ?? pricing.suggestedPrice ?? 0);
  return finalPrice;
}

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
  if (!id) return renderNotFound("لم يتم العثور على معرف الدورة.");

  try {
    const snap = await getDoc(doc(db, "courses", id));
    if (!snap.exists()) return renderNotFound("الدورة غير موجودة.");

    const course = snap.data() || {};
    if (String(course.status || "") !== "published") return renderNotFound("هذه الدورة ليست منشورة بعد.");

    const lessons = normalizeLessons(course);
    const outcomes = normalizeOutcomes(course);
    const price = resolvePrice(course);

    document.getElementById("courseTitle").textContent = course.title || "بدون عنوان";
    document.getElementById("courseStatus").textContent = "published";
    document.getElementById("courseStatus").className = "ch-badge published";
    document.getElementById("courseMeta").textContent = `${course.instructorName || "مدرّب"} • ${course.duration || course.durationHours || "-"} • ${course.level || "-"}`;
    document.getElementById("coursePrice").textContent = `السعر: ${price <= 0 ? "مجاني" : `${price.toLocaleString("ar")} ر.س`}`;
    document.getElementById("courseImage").src = course.cover || course.image || "assets/images/default-course.png";

    document.getElementById("outcomes").innerHTML = outcomes.length
      ? outcomes.map((x) => `<li>${escapeHtml(x)}</li>`).join("")
      : "<li>سيتم إضافة مخرجات التعلم قريبًا.</li>";

    document.getElementById("curriculum").innerHTML = lessons.length
      ? lessons.map((lesson, idx) => `<p>الدرس ${idx + 1}: ${escapeHtml(lesson.title || "درس")}</p>`).join("")
      : "<p>لا توجد دروس متاحة للعرض الآن.</p>";

    document.getElementById("joinBtn").href = `course-player.html?id=${encodeURIComponent(id)}`;
  } catch (error) {
    console.error("تعذر تحميل تفاصيل الدورة:", error);
    renderNotFound("حدث خطأ أثناء تحميل بيانات الدورة.");
  }
});
