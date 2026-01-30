diff --git a/admin/js-admin/add-course.js b/admin/js-admin/add-course.js
index ec2409e86aaa6995f7eaa6137b2d0a3e7fc0a17d..b8d2bc5249e3d8e8606ce1f67bc7299189aa974c 100644
--- a/admin/js-admin/add-course.js
+++ b/admin/js-admin/add-course.js
@@ -8,133 +8,259 @@ import {
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
+
+      if (btn.dataset.tab === "preview") {
+        renderPreview();
+      }
     });
   });
 
   /* ================= Builders ================= */
   const lessonBuilder = new LessonBuilder("lessonsContainer");
   const slideBuilder = new SlideBuilder();
   const quizBuilder = new QuizBuilder();
 
   const addLessonBtn = document.getElementById("addLessonBtn");
   const form = document.getElementById("addCourseForm");
+  const coverInput = document.getElementById("coverImage");
+  const coverPreview = document.getElementById("coverPreview");
+  const statusInput = document.getElementById("courseStatus");
+  const reviewChecks = document.querySelectorAll(".review-check");
+  const statusButtons = document.querySelectorAll("[data-course-status]");
+
+  if (coverInput && coverPreview) {
+    coverInput.addEventListener("change", e => {
+      const file = e.target.files[0];
+      if (file) {
+        coverPreview.src = URL.createObjectURL(file);
+      }
+    });
+  }
 
   /* ================= Add Lesson ================= */
   addLessonBtn.addEventListener("click", () => {
     lessonBuilder.addLesson();
   });
 
+  statusButtons.forEach((button) => {
+    button.addEventListener("click", (event) => {
+      const status = event.currentTarget.dataset.courseStatus;
+      if (statusInput) statusInput.value = status;
+      if (status === "published") return;
+      if (status === "review") {
+        const allChecked = [...reviewChecks].every((check) => check.checked);
+        if (!allChecked) {
+          alert("⚠️ يرجى إكمال قائمة المراجعة قبل إرسال الدورة للمراجعة.");
+          return;
+        }
+      }
+      form.requestSubmit();
+    });
+  });
+
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
+      const level = document.getElementById("level")?.value || "";
+      const language = document.getElementById("language")?.value || "";
+      const duration = document.getElementById("duration")?.value || "";
+      const modules = document.getElementById("modules")?.value || "";
+      const status = statusInput?.value || "draft";
+
+      if (status === "published" || status === "review") {
+        const allChecked = [...reviewChecks].every((check) => check.checked);
+        if (!allChecked) {
+          alert("⚠️ يرجى إكمال قائمة المراجعة قبل النشر.");
+          return;
+        }
+      }
 
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
 
-      lessonBuilder.getData().forEach(lesson => {
-        const slides = slideBuilder.getSlides(lesson.id);
+      for (const lesson of lessonBuilder.getData()) {
+        const slides = await slideBuilder.getSlidesForSave(lesson.id, storage);
         const quiz = quizBuilder.getQuiz(lesson.id);
 
         lessons.push({
           title: lesson.title,
+          duration: lesson.duration || "",
+          summary: lesson.summary || "",
           slides,
           quiz,
           passScore: 80
         });
-      });
+      }
 
       /* ===== Firestore ===== */
       await addDoc(collection(db, "courses"), {
         title,
         description,
         category,
+        level,
+        language,
+        duration,
+        modules,
+        status,
         image: coverImageUrl,
         lessons,
         createdAt: Timestamp.now()
       });
 
-      alert("✅ تم نشر الدورة بنجاح");
+      alert(status === "published"
+        ? "✅ تم نشر الدورة بنجاح"
+        : status === "review"
+          ? "✅ تم إرسال الدورة للمراجعة"
+          : "✅ تم حفظ الدورة كمسودة");
 
       form.reset();
       document.getElementById("lessonsContainer").innerHTML = "";
+      document.getElementById("previewLessons").innerHTML = "";
+      if (coverPreview) coverPreview.src = "/assets/images/default-course.png";
+      const previewCover = document.getElementById("previewCover");
+      if (previewCover) previewCover.src = "/assets/images/default-course.png";
+      lessonBuilder.updateEmptyState();
+      if (statusInput) statusInput.value = "draft";
+      reviewChecks.forEach((check) => {
+        check.checked = false;
+      });
 
     } catch (err) {
       console.error(err);
       alert("❌ حدث خطأ أثناء حفظ الدورة");
     }
   });
+
+  function renderPreview() {
+    const previewTitle = document.getElementById("previewTitle");
+    const previewDescription = document.getElementById("previewDescription");
+    const previewCategory = document.getElementById("previewCategory");
+    const previewLevel = document.getElementById("previewLevel");
+    const previewLanguage = document.getElementById("previewLanguage");
+    const previewDuration = document.getElementById("previewDuration");
+    const previewCover = document.getElementById("previewCover");
+    const previewLessons = document.getElementById("previewLessons");
+
+    const title = document.getElementById("title").value.trim();
+    const description = document.getElementById("description").value.trim();
+    const category = document.getElementById("category").value.trim();
+    const level = document.getElementById("level")?.value || "";
+    const language = document.getElementById("language")?.value || "";
+    const duration = document.getElementById("duration")?.value || "";
+
+    if (previewTitle) previewTitle.textContent = title || "عنوان الدورة";
+    if (previewDescription) previewDescription.textContent = description || "سيظهر وصف الدورة هنا بعد إدخاله.";
+    if (previewCategory) previewCategory.textContent = category ? `التصنيف: ${category}` : "التصنيف";
+    if (previewLevel) previewLevel.textContent = level ? `المستوى: ${level}` : "المستوى";
+    if (previewLanguage) previewLanguage.textContent = language ? `اللغة: ${language}` : "اللغة";
+    if (previewDuration) previewDuration.textContent = duration ? `المدة: ${duration} ساعة` : "المدة";
+
+    if (coverInput && coverInput.files[0] && previewCover) {
+      previewCover.src = URL.createObjectURL(coverInput.files[0]);
+    }
+
+    if (!previewLessons) return;
+    previewLessons.innerHTML = "";
+
+    lessonBuilder.getData().forEach((lesson, index) => {
+      const lessonEl = document.createElement("div");
+      lessonEl.className = "preview-lesson";
+      lessonEl.innerHTML = `
+        <h3>الدرس ${index + 1}: ${lesson.title || "بدون عنوان"}</h3>
+        <p class="helper-text">${lesson.summary || "لا يوجد ملخص للدرس."}</p>
+      `;
+
+      const slides = slideBuilder.getSlides(lesson.id);
+      slides.forEach(slide => {
+        const slideEl = document.createElement("div");
+        slideEl.className = "preview-slide";
+        slideEl.style.background = slide.backgroundColor || "#f8fafc";
+        slideEl.innerHTML = `
+          <strong style="color: ${slide.textColor}; font-size: ${slide.fontSize}px; font-weight: ${slide.fontWeight};">
+            ${slide.title || "سلايد بدون عنوان"}
+          </strong>
+          <p style="color: ${slide.textColor}; text-align: ${slide.textAlign};">
+            ${slide.text || ""}
+          </p>
+        `;
+        lessonEl.appendChild(slideEl);
+      });
+
+      previewLessons.appendChild(lessonEl);
+    });
+  }
 });
