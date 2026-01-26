import { db, auth } from "/js/firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let courseId;
let course;
let currentLesson = 0;
let currentSlide = 0;
let user;

auth.onAuthStateChanged(u => user = u);

document.addEventListener("DOMContentLoaded", async () => {
  courseId = new URLSearchParams(location.search).get("id");
  if (!courseId) return alert("الدورة غير محددة");

  await loadCourse();
  renderSidebar();
  renderSlide();
});

async function loadCourse() {
  const snap = await getDoc(doc(db, "courses", courseId));
  if (!snap.exists()) return alert("الدورة غير موجودة");
  course = snap.data();
  document.getElementById("courseTitle").textContent = course.title;
}

function renderSidebar() {
  const ul = document.getElementById("lessonsList");
  ul.innerHTML = "";

  course.lessons.forEach((l, i) => {
    const li = document.createElement("li");
    li.textContent = l.title;
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
    <h3>${slide.title}</h3>
    <div>${slide.content}</div>
  `;
}

document.getElementById("nextBtn").onclick = async () => {
  const lesson = course.lessons[currentLesson];

  if (currentSlide < lesson.slides.length - 1) {
    currentSlide++;
  } else {
    await completeLesson();
    currentLesson++;
    currentSlide = 0;
  }
  renderSidebar();
  renderSlide();
};

document.getElementById("prevBtn").onclick = () => {
  if (currentSlide > 0) currentSlide--;
  renderSlide();
};

async function completeLesson() {
  if (!user) return;
  await setDoc(
    doc(db, "studentProgress", `${user.uid}_${courseId}`),
    { completedLessons: arrayUnion(currentLesson) },
    { merge: true }
  );
}
