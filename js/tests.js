import { db } from "/js/firebase-config.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const grid = document.getElementById("testsGrid");
const emptyState = document.getElementById("testsEmptyState");

async function loadTests() {
  if (!grid || !emptyState) return;

  try {
    const snapshot = await getDocs(collection(db, "courses"));
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
    grid.innerHTML = coursesWithQuizzes.map((course) => `
      <div class="card">
        <img src="${course.image || "/assets/images/course1.jpg"}" alt="${course.title}">
        <div class="card-content">
          <h3>${course.title}</h3>
          <p>${course.description || "ابدأ اختبار الدورة وتأكد من إتقان المهارات."}</p>
          <a href="/course-player.html?id=${course.id}" class="btn">ابدأ الاختبار</a>
        </div>
      </div>
    `).join("");
  } catch (error) {
    console.error("فشل تحميل الاختبارات:", error);
    emptyState.style.display = "block";
  }
}

loadTests();
