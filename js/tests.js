import { db } from "/js/firebase-config.js";
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const grid = document.getElementById("testsGrid");
const emptyState = document.getElementById("testsEmptyState");

async function loadTests() {
  if (!grid || !emptyState) return;

  try {
    const publishedCoursesQuery = query(collection(db, "courses"), where("status", "==", "published"));
    const snapshot = await getDocs(publishedCoursesQuery);
    const coursesWithQuizzes = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const hasQuiz = data.lessons?.some((lesson) => lesson.quiz?.length);
      if (hasQuiz) {
        coursesWithQuizzes.push({ id: docSnap.id, ...data });
      }
    });

    if (!coursesWithQuizzes.length) {
      emptyState.style.display = "block";
      return;
    }

    emptyState.style.display = "none";
    const lang = localStorage.getItem("coursehub_lang") || "ar";
    const defaultDescription =
      lang === "en"
        ? "Start the course test and make sure you have mastered the skills."
        : "ابدأ اختبار الدورة وتأكد من إتقان المهارات.";
    const startLabel = lang === "en" ? "Start test" : "ابدأ الاختبار";

    grid.innerHTML = coursesWithQuizzes.map((course) => `
      <div class="card">
        <img src="${course.image || "/assets/images/default-course.png"}" alt="${course.title}">
        <div class="card-content">
          <h3>${course.title}</h3>
          <p>${course.description || defaultDescription}</p>
          <a href="/course-player.html?id=${course.id}" class="btn">${startLabel}</a>
        </div>
      </div>
    `).join("");
  } catch (error) {
    console.error("فشل تحميل الاختبارات:", error);
    emptyState.style.display = "block";
  }
}

loadTests();
