import { db, storage } from "/js/firebase-config.js";
import { protectAdmin } from "./admin-guard.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

document.addEventListener("DOMContentLoaded", async () => {
  await protectAdmin();

  const form = document.getElementById("add-course-form");
  const lessonsWrapper = document.getElementById("lessons-wrapper");
  const addLessonBtn = document.getElementById("add-lesson-btn");

  let lessons = [];

  function createLessonField(index) {
    const div = document.createElement("div");
    div.classList.add("lesson-block");
    div.dataset.index = index;
    div.innerHTML = `
      <hr>
      <label>عنوان الدرس ${index + 1}</label>
      <input type="text" class="lesson-title" required>
      <label>نوع الدرس</label>
      <select class="lesson-type" required>
        <option value="">اختر النوع</option>
        <option value="video">فيديو</option>
        <option value="slides">سلايد / PDF</option>
      </select>
      <label>ملف الدرس (فيديو / PDF)</label>
      <input type="file" class="lesson-file" required>
      <label>موارد إضافية (اختياري)</label>
      <input type="file" class="lesson-resources" multiple>
      <button type="button" class="remove-lesson-btn">حذف الدرس</button>
    `;
    lessonsWrapper.appendChild(div);

    div.querySelector(".remove-lesson-btn").addEventListener("click", () => {
      lessonsWrapper.removeChild(div);
    });
  }

  addLessonBtn.addEventListener("click", () => {
    createLessonField(lessonsWrapper.children.length);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const title = document.getElementById("title").value.trim();
      const description = document.getElementById("description").value.trim();
      const type = document.getElementById("type").value;
      const imageFile = document.getElementById("image").files[0];

      if (!title || !description || !type || !imageFile) throw new Error("يرجى تعبئة جميع الحقول");

      // رفع صورة الغلاف
      const imageRef = ref(storage, `courses/${Date.now()}_${imageFile.name}`);
      await uploadBytes(imageRef, imageFile);
      const imageUrl = await getDownloadURL(imageRef);

      // تجهيز الدروس
      const lessonDivs = lessonsWrapper.querySelectorAll(".lesson-block");
      let lessonsData = [];
      for (const div of lessonDivs) {
        const lessonTitle = div.querySelector(".lesson-title").value.trim();
        const lessonType = div.querySelector(".lesson-type").value;
        const lessonFile = div.querySelector(".lesson-file").files[0];
        const resourceFiles = div.querySelector(".lesson-resources").files;

        if (!lessonTitle || !lessonType || !lessonFile) throw new Error("يرجى تعبئة جميع بيانات الدرس");

        // رفع ملف الدرس
        const lessonRef = ref(storage, `lessons/${Date.now()}_${lessonFile.name}`);
        await uploadBytes(lessonRef, lessonFile);
        const lessonUrl = await getDownloadURL(lessonRef);

        // رفع الموارد
        let resources = [];
        for (const file of resourceFiles) {
          const resRef = ref(storage, `lessons/resources/${Date.now()}_${file.name}`);
          await uploadBytes(resRef, file);
          const resUrl = await getDownloadURL(resRef);
          resources.push({ name: file.name, url: resUrl });
        }

        lessonsData.push({
          title: lessonTitle,
          type: lessonType,
          contentUrl: lessonUrl,
          resources,
          order: lessonsData.length,
          createdAt: new Date().toISOString()
        });
      }

      // إضافة الدورة إلى Firestore
      await addDoc(collection(db, "courses"), {
        title,
        description,
        type,
        image: imageUrl,
        lessons: lessonsData,
        createdAt: serverTimestamp()
      });

      alert("تم إضافة الدورة بنجاح!");
      form.reset();
      lessonsWrapper.innerHTML = "";
    } catch (err) {
      console.error(err);
      alert(err.message || "حدث خطأ أثناء إضافة الدورة.");
    }
  });
});
