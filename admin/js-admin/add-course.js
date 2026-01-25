import { db, storage } from "/js/firebase-config.js";
import { protectAdmin } from "./admin-guard.js";
import {
  collection,
  addDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

document.addEventListener("DOMContentLoaded", async () => {
  await protectAdmin();

  /* ================= Tabs ================= */
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    });
  });

  const form = document.getElementById("addCourseForm");
  const lessonsContainer = document.getElementById("lessonsContainer");
  const addLessonBtn = document.getElementById("addLessonBtn");

  /* ================= Add Lesson ================= */
  addLessonBtn.addEventListener("click", () => {
    const lessonIndex = lessonsContainer.children.length + 1;

    const lesson = document.createElement("div");
    lesson.className = "lesson-card";
    lesson.innerHTML = `
      <h3>📘 درس ${lessonIndex}</h3>

      <label>عنوان الدرس</label>
      <input type="text" class="lesson-title" required>

      <div class="slides"></div>

      <button type="button" class="btn small add-slide">
        ➕ إضافة سلايد
      </button>

      <div class="quiz">
        <h4>🧠 اختبار الدرس</h4>
        <textarea class="quiz-json" placeholder='JSON الأسئلة (اختياري)'></textarea>
      </div>
    `;

    lesson.querySelector(".add-slide").addEventListener("click", () => {
      addSlide(lesson.querySelector(".slides"));
    });

    lessonsContainer.appendChild(lesson);
  });

  function addSlide(container) {
    const slide = document.createElement("div");
    slide.className = "slide-card";
    slide.innerHTML = `
      <label>عنوان السلايد</label>
      <input type="text" class="slide-title">

      <label>محتوى السلايد</label>
      <textarea class="slide-content" rows="4"></textarea>

      <button type="button" class="btn danger small remove-slide">حذف</button>
    `;

    slide.querySelector(".remove-slide").onclick = () => slide.remove();
    container.appendChild(slide);
  }

  /* ================= Save Course ================= */
  form.addEventListener("submit", async e => {
    e.preventDefault();

    try {
      const title = document.getElementById("title").value.trim();
      const description = document.getElementById("description").value.trim();
      const category = document.getElementById("category").value.trim();

      let coverImageUrl = "";
      const coverFile = document.getElementById("coverImage").files[0];
      if (coverFile) {
        const coverRef = ref(storage, `courses/covers/${Date.now()}_${coverFile.name}`);
        await uploadBytes(coverRef, coverFile);
        coverImageUrl = await getDownloadURL(coverRef);
      }

      const lessons = [];
      document.querySelectorAll(".lesson-card").forEach(lessonEl => {
        const lessonTitle = lessonEl.querySelector(".lesson-title").value.trim();
        if (!lessonTitle) return;

        const slides = [];
        lessonEl.querySelectorAll(".slide-card").forEach(slideEl => {
          slides.push({
            title: slideEl.querySelector(".slide-title").value,
            content: slideEl.querySelector(".slide-content").value
          });
        });

        let quiz = [];
        const quizText = lessonEl.querySelector(".quiz-json").value.trim();
        if (quizText) {
          try { quiz = JSON.parse(quizText); } catch {}
        }

        lessons.push({
          title: lessonTitle,
          slides,
          quiz,
          passScore: 80
        });
      });

      await addDoc(collection(db, "courses"), {
        title,
        description,
        category,
        image: coverImageUrl,
        lessons,
        createdAt: Timestamp.now()
      });

      alert("✅ تم نشر الدورة بنجاح");
      form.reset();
      lessonsContainer.innerHTML = "";

    } catch (err) {
      console.error(err);
      alert("❌ حدث خطأ أثناء حفظ الدورة");
    }
  });
});
