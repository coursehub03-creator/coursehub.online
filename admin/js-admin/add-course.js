// add-course.js
import { db } from "./firebase-config.js";
import { protectAdmin } from "./admin-guard.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", async () => {
  await protectAdmin();

  const form = document.getElementById("addCourseForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const title = document.getElementById("title").value.trim();
    const instructor = document.getElementById("instructor").value.trim();
    const category = document.getElementById("category").value;
    const image = document.getElementById("image").value.trim();
    const description = document.getElementById("description").value.trim();

    if (!title || !instructor || !category || !image || !description) {
      alert("يرجى تعبئة جميع الحقول!");
      return;
    }

    try {
      await addDoc(collection(db, "courses"), {
        title,
        instructor,
        category,
        image,
        description,
        createdAt: new Date().toISOString()
      });

      alert("تم إضافة الدورة بنجاح!");
      form.reset();
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء إضافة الدورة.");
    }
  });
});
