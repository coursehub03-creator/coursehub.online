import { db, storage } from "/js/firebase-config.js";
import { protectAdmin } from "./admin-guard.js";
import {
  doc,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

document.addEventListener("DOMContentLoaded", async () => {
  await protectAdmin();

  const params = new URLSearchParams(window.location.search);
  const courseId = params.get("id");

  const form = document.getElementById("editCourseForm");
  const coverPreview = document.getElementById("coverPreview");
  const coverInput = document.getElementById("coverImage");

  if (!courseId || !form) {
    alert("معرف الدورة غير موجود.");
    return;
  }

  if (coverInput && coverPreview) {
    coverInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (file) {
        coverPreview.src = URL.createObjectURL(file);
      }
    });
  }

  const courseRef = doc(db, "courses", courseId);
  const snap = await getDoc(courseRef);
  if (!snap.exists()) {
    alert("الدورة غير موجودة.");
    return;
  }

  const course = snap.data();
  document.getElementById("title").value = course.title || "";
  document.getElementById("titleEn").value = course.titleEn || "";
  document.getElementById("description").value = course.description || "";
  document.getElementById("descriptionEn").value = course.descriptionEn || "";
  document.getElementById("category").value = course.category || "";
  document.getElementById("level").value = course.level || "";
  document.getElementById("language").value = course.language || "";
  document.getElementById("duration").value = course.duration || "";
  document.getElementById("modules").value = course.modules || "";
  document.getElementById("status").value = course.status || "draft";
  if (coverPreview) {
    coverPreview.src = course.image || "/assets/images/default-course.png";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const updates = {
      title: document.getElementById("title").value.trim(),
      titleEn: document.getElementById("titleEn").value.trim(),
      description: document.getElementById("description").value.trim(),
      descriptionEn: document.getElementById("descriptionEn").value.trim(),
      category: document.getElementById("category").value.trim(),
      level: document.getElementById("level").value.trim(),
      language: document.getElementById("language").value.trim(),
      duration: document.getElementById("duration").value.trim(),
      modules: Number(document.getElementById("modules").value) || "",
      status: document.getElementById("status").value
    };

    const coverFile = document.getElementById("coverImage").files[0];
    const coverImageUrlInput = document.getElementById("coverImageUrl").value.trim();
    if (coverFile) {
      const coverRef = ref(storage, `courses/covers/${Date.now()}_${coverFile.name}`);
      await uploadBytes(coverRef, coverFile);
      updates.image = await getDownloadURL(coverRef);
    } else if (coverImageUrlInput) {
      updates.image = coverImageUrlInput;
    }

    await updateDoc(courseRef, updates);
    alert("✅ تم تحديث الدورة بنجاح.");
  });
});
