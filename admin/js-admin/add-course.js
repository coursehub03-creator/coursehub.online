// add-course.js
import { protectAdmin } from "./admin-guard.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.16.0/firebase-firestore.js";

const db = getFirestore();

document.addEventListener("DOMContentLoaded", () => {
  protectAdmin();

  const form = document.getElementById("add-course-form"); 
  let feedback = document.getElementById("feedback-message");

  if (!feedback) {
    feedback = document.createElement("p");
    feedback.id = "feedback-message";
    form.appendChild(feedback);
  }

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    feedback.textContent = "";
    feedback.className = "";

    const title = form.title.value.trim();
    const description = form.description.value.trim();

    if (!title || !description) {
      feedback.textContent = "يرجى ملء جميع الحقول!";
      feedback.classList.add("error");
      return;
    }

    try {
      await addDoc(collection(db, "courses"), {
        title,
        description,
        createdAt: new Date().toISOString()
      });

      feedback.textContent = "تمت إضافة الدورة بنجاح!";
      feedback.classList.add("success");
      form.reset();
    } catch (err) {
      console.error("فشل إضافة الدورة:", err);
      feedback.textContent = "حدث خطأ أثناء إضافة الدورة.";
      feedback.classList.add("error");
    }
  });
});
