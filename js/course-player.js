import { db, auth } from "/js/firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let courseId;
let course;
let user;

let currentLessonIndex = 0;
let currentSlideIndex = 0;

let completedLessons = [];
let quizResults = {};

auth.onAuthStateChanged(u => user = u);

document.addEventListener("DOMContentLoaded", async () => {
  courseId = new URLSearchParams(location.search).get("id");
  if (!courseId) return alert("الدورة غير محددة");

  await loadCourse();
  await loadProgress();

  renderSidebar();
  renderSlide();
  updateProgressUI();
});

/* ================== DATA ================== */

async function loadCourse() {
  const snap = await getDoc(doc(db, "courses", courseId));
  if (!snap.exists()) return alert("الدورة غير موجودة");

  course = snap.data();
  document.getElementById("courseTitle").textContent = course.title;
}

async function loadProgress() {
  if (!user) return;

  const ref = doc(db, "studentProgress", `${user.uid}_${courseId}`);
  const snap = await getDoc(ref);

  if (!snap.exists()) return;

  const data = snap.data();

  completedLessons = data.completedLessons || [];
  quizResults = data.quizResults || {};

  // ✅ Resume
  currentLessonIndex = data.lastLessonIndex ?? 0;
  currentSlideIndex = data.lastSlideIndex ?? 0;
}

/* ================== UI ================== */

function renderSidebar() {
  const ul = document.getElementById("lessonsList");
  ul.innerHTML = "";

  course.lessons.forEach((lesson, i) => {
    const li = document.createElement("li");
    li.textContent = lesson.title;

    if (i === currentLessonIndex) li.classList.add("active");
    if (completedLessons.includes(i)) li.classList.add("completed");

    li.onclick = () => {
      if (i > 0 && !completedLessons.includes(i - 1)) {
        alert("يجب إكمال الدرس السابق");
        return;
      }
      currentLessonIndex = i;
      currentSlideIndex = 0;
      renderSidebar();
      renderSlide();
    };

    ul.appendChild(li);
  });
}

function renderSlide() {
  const lesson = course.lessons[currentLessonIndex];
  const slide = lesson.slides[currentSlideIndex];

  const box = document.getElementById("slideContainer");

  box.innerHTML = `
    <h2>${lesson.title}</h2>
    <h3>${slide.title}</h3>
    <div class="slide-content">${slide.content}</div>
  `;

  saveResume();
  updateControls();
}

function updateControls() {
  const lesson = course.lessons[currentLessonIndex];

  document.getElementById("prevBtn").disabled = currentSlideIndex === 0;

  document.getElementById("nextBtn").textContent =
    currentSlideIndex === lesson.slides.length - 1
      ? "الانتقال للاختبار"
      : "التالي";
}

/* ================== CONTROLS ================== */

document.getElementById("nextBtn").onclick = async () => {
  const lesson = course.lessons[currentLessonIndex];

  if (currentSlideIndex < lesson.slides.length - 1) {
    currentSlideIndex++;
    renderSlide();
    return;
  }

  // ✅ نهاية الدرس → Quiz
  renderQuiz(lesson.quiz || []);
};

document.getElementById("prevBtn").onclick = () => {
  if (currentSlideIndex > 0) {
    currentSlideIndex--;
    renderSlide();
  }
};

/* ================== QUIZ ================== */

function renderQuiz(quiz) {
  if (!quiz.length) {
    completeLesson();
    return;
  }

  const box = document.getElementById("slideContainer");

  let html = `<h2>اختبار الدرس</h2><form id="quizForm">`;

  quiz.forEach((q, i) => {
    html += `<p>${q.question}</p>`;
    q.options.forEach(opt => {
      html += `
        <label>
          <input type="radio" name="q${i}" value="${opt}" required>
          ${opt}
        </label><br>
      `;
    });
  });

  html += `<button class="primary">إرسال الاختبار</button></form>`;
  box.innerHTML = html;

  document.getElementById("quizForm").onsubmit = e => {
    e.preventDefault();
    evaluateQuiz(quiz);
  };
}

async function evaluateQuiz(quiz) {
  let correct = 0;

  quiz.forEach((q, i) => {
    const value = document.querySelector(`input[name="q${i}"]:checked`).value;
    if (value === q.correctAnswer) correct++;
  });

  const score = Math.round((correct / quiz.length) * 100);

  quizResults[`lesson_${currentLessonIndex}`] = {
    score,
    passed: score >= 80
  };

  if (score < 80) {
    alert(`لم تنجح في الاختبار (${score}%)`);
    return;
  }

  alert(`نجحت 🎉 (${score}%)`);
  await completeLesson();
}

/* ================== PROGRESS ================== */

async function completeLesson() {
  if (!user) return;

  if (!completedLessons.includes(currentLessonIndex)) {
    completedLessons.push(currentLessonIndex);
  }

  await setDoc(
    doc(db, "studentProgress", `${user.uid}_${courseId}`),
    {
      completedLessons,
      quizResults,
      lastLessonIndex: currentLessonIndex + 1,
      lastSlideIndex: 0,
      updatedAt: new Date()
    },
    { merge: true }
  );

  currentLessonIndex++;
  currentSlideIndex = 0;

  renderSidebar();
  renderSlide();
  updateProgressUI();
}

async function saveResume() {
  if (!user) return;

  await updateDoc(
    doc(db, "studentProgress", `${user.uid}_${courseId}`),
    {
      lastLessonIndex: currentLessonIndex,
      lastSlideIndex: currentSlideIndex,
      updatedAt: new Date()
    }
  );
}

function updateProgressUI() {
  const percent = Math.round(
    (completedLessons.length / course.lessons.length) * 100
  );

  document.getElementById("courseProgress").style.width = percent + "%";
  document.getElementById("progressText").textContent = percent + "%";
}
