import { auth, db } from "/js/firebase-config.js";
import {
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let courseId;
let course;
let user;

let currentLesson = 0;
let currentSlide = 0;

document.addEventListener("DOMContentLoaded", async () => {

  const params = new URLSearchParams(window.location.search);
  courseId = params.get("id");

  if (!courseId) {
    alert("❌ courseId مفقود");
    return;
  }

  auth.onAuthStateChanged(async (u) => {
    if (!u) {
      alert("يرجى تسجيل الدخول");
      location.href = "/login.html";
      return;
    }

    user = u;

    await loadCourse();
    await loadResume();
    renderSidebar();
    renderSlide();
  });
});

async function loadCourse() {
  const snap = await getDoc(doc(db, "courses", courseId));

  if (!snap.exists()) {
    alert("الدورة غير موجودة");
    return;
  }

  course = snap.data();
  document.getElementById("courseTitle").textContent = course.title;
}

function renderSidebar() {
  const ul = document.getElementById("lessonsList");
  ul.innerHTML = "";

  course.lessons.forEach((lesson, i) => {
    const li = document.createElement("li");
    li.textContent = lesson.title;

    if (i === currentLesson) li.classList.add("active");

    ul.appendChild(li);
  });
}

function renderSlide() {
  const lesson = course.lessons[currentLesson];
  const slide = lesson.slides[currentSlide];

  const box = document.getElementById("slideContainer");

  box.innerHTML = `
    <h2>${lesson.title}</h2>
    <h3>${slide.title || ""}</h3>
    <div>${slide.content}</div>
  `;

  updateProgressBar();
  saveResume(); // 🔥 حفظ تلقائي كل سلايد
}

document.getElementById("nextBtn").onclick = () => {

  const lesson = course.lessons[currentLesson];

  if (currentSlide < lesson.slides.length - 1) {
    currentSlide++;
  } else if (currentLesson < course.lessons.length - 1) {
    currentLesson++;
    currentSlide = 0;
  }

  renderSidebar();
  renderSlide();
};

document.getElementById("prevBtn").onclick = () => {
  if (currentSlide > 0) {
    currentSlide--;
  }
  renderSlide();
};

async function saveResume() {
  try {
    const docId = `${user.uid}_${courseId}`;

    await setDoc(
      doc(db, "enrollments", docId),
      {
        userId: user.uid,
        courseId: courseId,
        lesson: currentLesson,
        slide: currentSlide,
        updatedAt: new Date()
      },
      { merge: true }
    );

  } catch (err) {
    console.error("❌ خطأ أثناء حفظ التقدم:", err);
  }
}

async function loadResume() {
  const docId = `${user.uid}_${courseId}`;
  const snap = await getDoc(doc(db, "enrollments", docId));

  if (!snap.exists()) return;

  const data = snap.data();

  currentLesson = data.lesson || 0;
  currentSlide = data.slide || 0;
}

function updateProgressBar() {
  const totalSlides = course.lessons.reduce(
    (sum, l) => sum + l.slides.length,
    0
  );

  const passedSlides =
    course.lessons
      .slice(0, currentLesson)
      .reduce((s, l) => s + l.slides.length, 0) + currentSlide;

  const percent = Math.floor((passedSlides / totalSlides) * 100);

  document.getElementById("courseProgress").style.width = percent + "%";
}
