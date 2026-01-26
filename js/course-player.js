import { db, auth } from "/js/firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let courseId;
let course;
let user;

let currentLessonIndex = 0;
let currentSlideIndex = 0;
let completedLessons = [];

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

/* ---------------- DATA ---------------- */

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

  if (snap.exists()) {
    completedLessons = snap.data().completedLessons || [];
  }
}

/* ---------------- UI ---------------- */

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
        alert("يجب إكمال الدرس السابق أولًا");
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

  updateControls();
}

function updateControls() {
  const lesson = course.lessons[currentLessonIndex];

  document.getElementById("prevBtn").disabled = currentSlideIndex === 0;
  document.getElementById("nextBtn").textContent =
    currentSlideIndex === lesson.slides.length - 1
      ? "إنهاء الدرس"
      : "التالي";
}

/* ---------------- CONTROLS ---------------- */

document.getElementById("nextBtn").onclick = async () => {
  const lesson = course.lessons[currentLessonIndex];

  if (currentSlideIndex < lesson.slides.length - 1) {
    currentSlideIndex++;
  } else {
    await completeLesson();
    currentLessonIndex++;
    currentSlideIndex = 0;
  }

  renderSidebar();
  renderSlide();
  updateProgressUI();
};

document.getElementById("prevBtn").onclick = () => {
  if (currentSlideIndex > 0) {
    currentSlideIndex--;
    renderSlide();
  }
};

/* ---------------- PROGRESS ---------------- */

async function completeLesson() {
  if (!user) return;

  if (!completedLessons.includes(currentLessonIndex)) {
    completedLessons.push(currentLessonIndex);

    await setDoc(
      doc(db, "studentProgress", `${user.uid}_${courseId}`),
      { completedLessons: arrayUnion(currentLessonIndex) },
      { merge: true }
    );
  }
}

function updateProgressUI() {
  const percent = Math.round(
    (completedLessons.length / course.lessons.length) * 100
  );

  document.getElementById("courseProgress").style.width = percent + "%";
  document.getElementById("progressText").textContent = percent + "%";
}
