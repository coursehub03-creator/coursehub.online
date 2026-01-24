import { db, storage, auth } from "/js/firebase-config.js";
import { protectAdmin } from "./admin-guard.js";
import { collection, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

document.addEventListener("DOMContentLoaded", async () => {
  await protectAdmin(); // حماية الأدمن

  const form = document.getElementById("addCourseForm");
  const lessonsContainer = document.getElementById("lessonsContainer");
  const addLessonBtn = document.getElementById("addLessonBtn");

  // إضافة درس جديد
  addLessonBtn.addEventListener("click", () => {
    const lessonIndex = lessonsContainer.children.length;
    const lessonDiv = document.createElement("div");
    lessonDiv.classList.add("lesson-block");
    lessonDiv.innerHTML = `
      <h4>درس ${lessonIndex + 1}</h4>
      <label>عنوان الدرس:</label>
      <input type="text" name="lessonTitle" required>
      <label>نوع الدرس:</label>
      <select name="lessonType">
        <option value="video">فيديو</option>
        <option value="slides">سلايدات / PDF</option>
      </select>
      <label>ملف الفيديو / السلايد:</label>
      <input type="file" name="lessonFile" accept="video/*,application/pdf" required>
      <label>الموارد الإضافية (اختياري، PDF / ZIP):</label>
      <input type="file" name="lessonResources" accept=".pdf,.zip" multiple>
      <label>اختبار الدرس (اختياري):</label>
      <textarea name="lessonQuiz" placeholder='JSON مثال: [{"question":"سؤال؟","options":["أ","ب","ج"],"correctAnswer":"أ"}]'></textarea>
      <hr>
    `;
    lessonsContainer.appendChild(lessonDiv);
  });

  // رفع الدورة
  form.addEventListener("submit", async e => {
    e.preventDefault();

    const title = form.title.value.trim();
    const description = form.description.value.trim();
    const category = form.category.value.trim();
    const coverImageFile = form.coverImage.files[0];

    if (!title || !description) return alert("يرجى تعبئة العنوان والوصف.");

    let coverImageUrl = "";
    if (coverImageFile) {
      const coverRef = ref(storage, `courses/cover-images/${Date.now()}_${coverImageFile.name}`);
      await uploadBytes(coverRef, coverImageFile);
      coverImageUrl = await getDownloadURL(coverRef);
    }

    const lessons = [];
    for (let lessonDiv of lessonsContainer.children) {
      const lessonTitle = lessonDiv.querySelector('input[name="lessonTitle"]').value.trim();
      const lessonType = lessonDiv.querySelector('select[name="lessonType"]').value;
      const lessonFile = lessonDiv.querySelector('input[name="lessonFile"]').files[0];
      const resourcesFiles = lessonDiv.querySelector('input[name="lessonResources"]').files;
      const quizText = lessonDiv.querySelector('textarea[name="lessonQuiz"]').value.trim();

      if (!lessonTitle || !lessonFile) continue;

      // رفع الفيديو / السلايد
      const lessonFileRef = ref(storage, `lessons/${Date.now()}_${lessonFile.name}`);
      await uploadBytes(lessonFileRef, lessonFile);
      const lessonContentUrl = await getDownloadURL(lessonFileRef);

      // رفع الموارد
      const resources = [];
      for (let file of resourcesFiles) {
        const resRef = ref(storage, `lessons/resources/${Date.now()}_${file.name}`);
        await uploadBytes(resRef, file);
        const url = await getDownloadURL(resRef);
        resources.push({ name: file.name, url });
      }

      // قراءة الاختبار (JSON)
      let quiz = [];
      if (quizText) {
        try {
          quiz = JSON.parse(quizText);
        } catch {
          console.warn(`خطأ في JSON للاختبار في درس: ${lessonTitle}`);
        }
      }

      lessons.push({ title: lessonTitle, type: lessonType, contentUrl: lessonContentUrl, resources, quiz });
    }

    try {
      await addDoc(collection(db, "courses"), {
        title,
        description,
        category,
        image: coverImageUrl,
        lessons,
        createdAt: Timestamp.now()
      });
      alert("تم إضافة الدورة بنجاح!");
      form.reset();
      lessonsContainer.innerHTML = "";
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء إضافة الدورة.");
    }
  });
});
