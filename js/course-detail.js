import { db, auth } from "/js/firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", async () => {

  const params = new URLSearchParams(window.location.search);
  const courseId = params.get("id");
  if (!courseId) return alert("لم يتم تحديد الدورة");

  const courseDetail = document.getElementById("courseDetail");
  const courseImage = document.getElementById("courseImage");
  const courseDesc = document.getElementById("courseDesc");
  const courseContent = document.getElementById("courseContent");
  const joinBtn = document.getElementById("joinBtn");

  let currentUser = null;
  let courseData = null;

  auth.onAuthStateChanged(user => {
    currentUser = user;
  });

  async function loadCourse() {
    const courseRef = doc(db, "courses", courseId);
    const snap = await getDoc(courseRef);

    if (!snap.exists()) {
      courseDetail.innerHTML = "<p class='empty-msg'>الدورة غير موجودة</p>";
      return;
    }

    courseData = snap.data();

    courseDetail.querySelector("h2").textContent = courseData.title;
    courseImage.src = courseData.image || "/assets/images/course1.jpg";
    courseDesc.textContent = courseData.description || "";

    renderLessons();
    await loadProgress();
  }

  function renderLessons() {
    courseContent.innerHTML = "";

    courseData.lessons.forEach((lesson, index) => {
      const li = document.createElement("li");
      li.className = "lesson";
      li.innerHTML = `
        <strong>${index + 1}. ${lesson.title}</strong>
        <button class="btn start-btn" data-index="${index}">ابدأ / تابع</button>
        <div id="progress-${index}">0%</div>
      `;
      courseContent.appendChild(li);
    });

    document.querySelectorAll(".start-btn").forEach(btn => {
      btn.addEventListener("click", () =>
        startLesson(Number(btn.dataset.index))
      );
    });

    // ✅ تعديل: التحقق من تسجيل الدخول عند الضغط على زر الانضمام
    joinBtn.addEventListener("click", () => {
      if (!currentUser) return alert("يرجى تسجيل الدخول لبدء الدورة.");
      startLesson(0);
    });
  }

  async function loadProgress() {
    if (!currentUser) return;

    const ref = doc(db, "courses", courseId, "progress", currentUser.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) return;

    const completed = snap.data().completedLessons || [];
    completed.forEach(i => {
      const el = document.getElementById(`progress-${i}`);
      if (el) el.textContent = "100%";
    });
  }

  async function startLesson(index) {
    if (!currentUser) return alert("يرجى تسجيل الدخول أولًا");

    const progressRef = doc(
      db,
      "courses",
      courseId,
      "progress",
      currentUser.uid
    );

    const snap = await getDoc(progressRef);
    const completed = snap.exists() ? snap.data().completedLessons || [] : [];

    if (index > 0 && !completed.includes(index - 1)) {
      return alert("يجب إكمال الدرس السابق");
    }

    const lesson = courseData.lessons[index];
    let html = `<h3>${lesson.title}</h3>`;

    if (lesson.type === "video") {
      html += `<video src="${lesson.contentUrl}" controls width="100%" id="lessonVideo"></video>`;
    } else {
      html += `<iframe src="${lesson.contentUrl}" width="100%" height="500"></iframe>`;
    }

    if (lesson.resources?.length) {
      html += "<h4>الموارد</h4><ul>";
      lesson.resources.forEach(r => {
        html += `<li><a href="${r.url}" target="_blank">${r.name}</a></li>`;
      });
      html += "</ul>";
    }

    if (lesson.quiz?.length) {
      html += `<form id="quizForm"><h4>الاختبار</h4>`;
      lesson.quiz.forEach((q, i) => {
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
      html += `<button class="btn">إرسال</button></form>`;
    }

    courseContent.innerHTML = html;

    const video = document.getElementById("lessonVideo");
    if (video) {
      video.onended = () => completeLesson(index);
    }

    const quizForm = document.getElementById("quizForm");
    if (quizForm) {
      quizForm.onsubmit = async e => {
        e.preventDefault();
        let passed = true;

        lesson.quiz.forEach((q, i) => {
          if (quizForm[`q${i}`].value !== q.correctAnswer) passed = false;
        });

        if (!passed) return alert("لم تنجح في الاختبار");
        await completeLesson(index);
      };
    }
  }

  async function completeLesson(index) {
    const ref = doc(db, "courses", courseId, "progress", currentUser.uid);

    await setDoc(
      ref,
      {
        completedLessons: arrayUnion(index),
        updatedAt: new Date()
      },
      { merge: true }
    );

    alert("تم إكمال الدرس");
    renderLessons();
    loadProgress();
  }

  loadCourse();
});
