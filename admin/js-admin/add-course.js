// js-admin/add-course.js
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

// Builders
import { LessonBuilder } from "./lesson-builder.js";
import { SlideBuilder } from "./slide-builder.js";
import { QuizBuilder } from "./quiz-builder.js";

document.addEventListener("DOMContentLoaded", async () => {
  await protectAdmin();

  /* ================= Tabs ================= */
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add("active");
    });
  });

  /* ================= Builders ================= */
  const lessonBuilder = new LessonBuilder("lessonsContainer");
  const slideBuilder = new SlideBuilder();
  const quizBuilder = new QuizBuilder();

  const addLessonBtn = document.getElementById("addLessonBtn");
  const form = document.getElementById("addCourseForm");

  /* ================= Add Lesson ================= */
  addLessonBtn.addEventListener("click", () => {
    lessonBuilder.addLesson();
  });

  /* ================= Delegated Events ================= */
  document.addEventListener("click", e => {
    // ➕ إضافة سلايد
    if (e.target.classList.contains("add-slide")) {
      const lessonId = e.target
        .closest(".lesson-card")
        .id.replace("lesson-", "");

      const slidesContainer = e.target
        .closest(".lesson-card")
        .querySelector(".slides-container");

      slideBuilder.addSlide(lessonId, slidesContainer);
    }

    // ➕ إضافة اختبار
    if (e.target.classList.contains("add-quiz")) {
      const lessonId = e.target
        .closest(".lesson-card")
        .id.replace("lesson-", "");

      const quizContainer = e.target
        .closest(".lesson-card")
        .querySelector(".quiz-container");

      quizBuilder.addQuiz(lessonId, quizContainer);
    }
  });

  /* ================= Save Course ================= */
  form.addEventListener("submit", async e => {
    e.preventDefault();

    try {
      const title = document.getElementById("title").value.trim();
      const description = document.getElementById("description").value.trim();
      const category = document.getElementById("category").value.trim();

      if (!title || !description) {
        alert("⚠️ عنوان ووصف الدورة إجباريان");
        return;
      }

      /* ===== Upload Cover Image ===== */
      let coverImageUrl = "";
      const coverFile = document.getElementById("coverImage").files[0];

      if (coverFile) {
        const coverRef = ref(
          storage,
          `courses/covers/${Date.now()}_${coverFile.name}`
        );
        await uploadBytes(coverRef, coverFile);
        coverImageUrl = await getDownloadURL(coverRef);
      }

      /* ===== Build Lessons Data ===== */
      const lessons = [];

      lessonBuilder.getData().forEach(lesson => {
        const slides = slideBuilder.getSlides(lesson.id);
        const quiz = quizBuilder.getQuiz(lesson.id);

        lessons.push({
          title: lesson.title,
          slides,
          quiz,
          passScore: 80
        });
      });

      /* ===== Firestore ===== */
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
      document.getElementById("lessonsContainer").innerHTML = "";

    } catch (err) {
      console.error(err);
      alert("❌ حدث خطأ أثناء حفظ الدورة");
    }
  });
});
