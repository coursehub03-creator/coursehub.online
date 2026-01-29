import { db, auth } from "/js/firebase-config.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", async () => {

  const params = new URLSearchParams(window.location.search);
  const courseId = params.get("id");
  if (!courseId) {
  alert("❌ courseId مفقود من الرابط");
  throw new Error("Missing courseId");
}
  if (!courseId) {
    alert("لم يتم تحديد الدورة");
    return;
  }

  const courseDetail = document.getElementById("courseDetail");
  const courseImage = document.getElementById("courseImage");
  const courseDesc = document.getElementById("courseDesc");
  const courseRating = document.getElementById("courseRating");
  const joinBtn = document.getElementById("joinBtn");

  let currentUser = null;

  auth.onAuthStateChanged(user => {
    currentUser = user;
  });

  async function loadCourse() {
    const courseRef = doc(db, "courses", courseId);
    const snap = await getDoc(courseRef);

    if (!snap.exists()) {
      courseDetail.innerHTML =
        "<p class='empty-msg'>الدورة غير موجودة</p>";
      return;
    }

    const course = snap.data();

    courseDetail.querySelector("h2").textContent = course.title;
    courseImage.src = course.image || "/assets/images/course1.jpg";
    courseDesc.textContent = course.description || "";

    if (course.rating) {
      courseRating.textContent = `⭐ ${course.rating} / 5`;
    } else {
      courseRating.textContent = "";
    }
  }

  // زر بدء المشغل
  joinBtn.addEventListener("click", () => {
    if (!currentUser) {
      alert("يرجى تسجيل الدخول");
      return;
    }
    location.href = `/course-player.html?id=${courseId}`;
  });

  loadCourse();
});
