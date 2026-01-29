import { db, auth } from "/js/firebase-config.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", async () => {

  // اقرأ courseId من الرابط
  const params = new URLSearchParams(window.location.search);
  const courseId = params.get("id");

  // تحقق مبكر
  if (!courseId) {
    alert("❌ لم يتم العثور على معرف الدورة (courseId)");
    throw new Error("Missing courseId in URL");
  }

  // عناصر الصفحة
  const courseDetail = document.getElementById("courseDetail");
  const courseImage = document.getElementById("courseImage");
  const courseDesc = document.getElementById("courseDesc");
  const courseRating = document.getElementById("courseRating");
  const joinBtn = document.getElementById("joinBtn");

  if (!courseDetail || !joinBtn) {
    console.error("❌ عناصر الصفحة غير موجودة");
    return;
  }

  let currentUser = null;

  // مراقبة تسجيل الدخول
  auth.onAuthStateChanged(user => {
    currentUser = user;
  });

  // تحميل بيانات الدورة
  async function loadCourse() {
    try {
      const courseRef = doc(db, "courses", courseId);
      const snap = await getDoc(courseRef);

      if (!snap.exists()) {
        courseDetail.innerHTML =
          "<p class='empty-msg'>الدورة غير موجودة</p>";
        return;
      }

      const course = snap.data();

      const titleEl = courseDetail.querySelector("h2");
      if (titleEl) titleEl.textContent = course.title || "بدون عنوان";

      if (courseImage)
        courseImage.src = course.image || "/assets/images/course1.jpg";

      if (courseDesc)
        courseDesc.textContent = course.description || "";

      if (courseRating) {
        courseRating.textContent = course.rating
          ? `⭐ ${course.rating} / 5`
          : "";
      }

    } catch (err) {
      console.error("❌ خطأ أثناء تحميل الدورة:", err);
      courseDetail.innerHTML =
        "<p class='empty-msg'>حدث خطأ أثناء تحميل الدورة</p>";
    }
  }

  // زر الانضمام
  joinBtn.addEventListener("click", () => {

    if (!currentUser) {
      alert("يرجى تسجيل الدخول");
      return;
    }

    if (!courseId) {
      alert("خطأ: معرف الدورة غير موجود");
      return;
    }

    location.href = `/course-player.html?id=${courseId}`;
  });

  // تشغيل التحميل
  await loadCourse();
});
