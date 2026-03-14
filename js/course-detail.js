import { demoCourses } from "./coursehub-demo-data.js";

const params = new URLSearchParams(window.location.search);
const id = params.get("id") || "demo-1";
const course = demoCourses.find((c) => c.id === id) || demoCourses[0];

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("courseTitle").textContent = course.title;
  document.getElementById("courseStatus").textContent = course.status;
  document.getElementById("courseStatus").className = `ch-badge ${course.status}`;
  document.getElementById("courseMeta").textContent = `${course.instructor} • ${course.duration} • ${course.level} • ⭐ ${course.rating} (${course.students} طالب)`;
  document.getElementById("coursePrice").textContent = `السعر: ${course.price}`;
  document.getElementById("outcomes").innerHTML = course.outcomes.map((x) => `<li>${x}</li>`).join("");
  document.getElementById("curriculum").innerHTML = ["الوحدة 1: المقدمة","الوحدة 2: الأساسيات","الوحدة 3: التطبيق العملي","الوحدة 4: اختبار نهائي"].map((x) => `<p>${x}</p>`).join("");
  document.getElementById("joinBtn").href = `course-player.html?id=${course.id}`;
});
