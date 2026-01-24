import { db, storage } from "/js/firebase-config.js";
import { protectAdmin } from "./admin-guard.js";
import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

document.addEventListener("DOMContentLoaded", async () => {
  await protectAdmin();

  const form = document.getElementById("addCourseForm");
  const lessonsContainer = document.getElementById("lessonsContainer");
  const addLessonBtn = document.getElementById("addLessonBtn");

  // ➕ إضافة درس
  addLessonBtn.addEventListener("click", () => {
    const index = lessonsContainer.children.length + 1;

    const div = document.createElement("div");
    div.className = "lesson-block";
    div.innerHTML = `
      <h4>درس ${index}</h4>

      <label>عنوان الدرس</label>
      <input type="text" name="lessonTitle" required>

      <label>نوع الدرس</label>
      <select name="lessonType">
        <option value="video">فيديو</option>
        <option value="slides">PDF / سلايدات</option>
      </select>

      <label>ملف الدرس</label>
      <input type="file" name="lessonFile" accept="video/*,application/pdf" required>

      <label>موارد إضافية</label>
      <input type="file" name="lessonResources" accept=".pdf,.zip" multiple>

      <label>اختبار (JSON اختياري)</label>
      <textarea name="lessonQuiz"></textarea>

      <hr>
    `;
    lessonsContainer.appendChild(div);
  });

  // 💾 حفظ الدورة
  form.addEventListener("submit", async e => {
    e.preventDefault();

    try {
      const title = titleInput();
      const description = descriptionInput();
      const category = categoryInput();

      // 🖼️ صورة الغلاف
      let coverImageUrl = "";
      const coverFile = form.coverImage.files[0];
      if (coverFile) {
        const refCover = ref(storage, `courses/covers/${Date.now()}_${coverFile.name}`);
        await uploadBytes(refCover, coverFile);
        coverImageUrl = await getDownloadURL(refCover);
      }

      // 📚 الدروس
      const lessons = [];

      for (const lesson of lessonsContainer.children) {
        const title = lesson.querySelector('[name="lessonTitle"]').value.trim();
        const type = lesson.querySelector('[name="lessonType"]').value;
        const file = lesson.querySelector('[name="lessonFile"]').files[0];

        if (!title || !file) continue;

        const lessonRef = ref(storage, `courses/lessons/${Date.now()}_${file.name}`);
        await uploadBytes(lessonRef, file);
        const contentUrl = await getDownloadURL(lessonRef);

        // 📎 الموارد
        const resources = [];
        const resFiles = lesson.querySelector('[name="lessonResources"]').files;
        for (const r of resFiles) {
          const rRef = ref(storage, `courses/resources/${Date.now()}_${r.name}`);
          await uploadBytes(rRef, r);
          resources.push({
            name: r.name,
            url: await getDownloadURL(rRef)
          });
        }

        // 🧠 الاختبار
        let quiz = [];
        const quizText = lesson.querySelector('[name="lessonQuiz"]').value.trim();
        if (quizText) {
          try { quiz = JSON.parse(quizText); } catch {}
        }

        lessons.push({ title, type, contentUrl, resources, quiz });
      }

      // 🗄️ Firestore
      await addDoc(collection(db, "courses"), {
        title,
        description,
        category,
        image: coverImageUrl,
        lessons,
        createdAt: Timestamp.now()
      });

      alert("✅ تم إضافة الدورة بنجاح");
      form.reset();
      lessonsContainer.innerHTML = "";

    } catch (err) {
      console.error(err);
      alert("❌ حدث خطأ أثناء حفظ الدورة");
    }
  });

  function titleInput() {
    return document.getElementById("title").value.trim();
  }
  function descriptionInput() {
    return document.getElementById("description").value.trim();
  }
  function categoryInput() {
    return document.getElementById("category").value.trim();
  }
});
