import { db, auth, storage } from "/js/firebase-config.js";
import { doc, getDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const courseId = urlParams.get("id");
  if (!courseId) return alert("لم يتم تحديد أي دورة.");

  const courseDetail = document.getElementById("courseDetail");
  const courseImage = document.getElementById("courseImage");
  const courseDesc = document.getElementById("courseDesc");
  const courseContent = document.getElementById("courseContent");
  const joinBtn = document.getElementById("joinBtn");

  let studentId = null;
  auth.onAuthStateChanged(user => {
    if (user) studentId = user.uid;
    else studentId = null;
  });

  async function loadCourse() {
    const courseRef = doc(db, "courses", courseId);
    const snapshot = await getDoc(courseRef);

    if (!snapshot.exists()) {
      courseDetail.innerHTML = "<p class='empty-msg'>الدورة غير موجودة.</p>";
      return;
    }

    const course = snapshot.data();
    courseDetail.querySelector("h2").textContent = course.title;
    courseImage.src = course.image || "/assets/images/course1.jpg";
    courseDesc.textContent = course.description || "لا يوجد وصف متاح.";

    courseContent.innerHTML = "";
    course.lessons?.forEach((lesson, index) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span>${lesson.title}</span>
        <button class="start-lesson-btn" data-index="${index}">ابدأ / تابع</button>
        <div class="lesson-progress" id="lesson-progress-${index}">0%</div>
      `;
      courseContent.appendChild(li);
    });

    joinBtn.addEventListener("click", () => startLesson(0, course));
  }

  async function startLesson(index, course) {
    if (!studentId) return alert("يرجى تسجيل الدخول لبدء الدورة.");

    const lesson = course.lessons[index];
    const studentRef = doc(db, "courses", courseId, "progress", studentId);
    const studentSnapshot = await getDoc(studentRef);
    let completedLessons = studentSnapshot.exists() ? studentSnapshot.data().completedLessons || [] : [];

    // منع الانتقال قبل اجتياز الدرس السابق
    if (index > 0 && !completedLessons.includes(index - 1)) {
      return alert("يرجى إتمام الدرس السابق أولاً.");
    }

    // عرض محتوى الدرس
    let contentHtml = `<h3>${lesson.title}</h3>`;
    if (lesson.type === "video") {
      contentHtml += `<video src="${lesson.contentUrl}" controls width="100%" id="lesson-video"></video>`;
    } else if (lesson.type === "slides") {
      contentHtml += `<iframe src="${lesson.contentUrl}" width="100%" height="500px"></iframe>`;
    }

    // الموارد الإضافية
    if (lesson.resources?.length > 0) {
      contentHtml += `<h4>الموارد:</h4><ul>`;
      lesson.resources.forEach(res => {
        contentHtml += `<li><a href="${res.url}" target="_blank">${res.name}</a></li>`;
      });
      contentHtml += "</ul>";
    }

    // اختبار MCQ إن وجد
    if (lesson.quiz?.length > 0) {
      contentHtml += `<h4>الاختبار:</h4><form id="quizForm">`;
      lesson.quiz.forEach((q, i) => {
        contentHtml += `<p>${q.question}</p>`;
        q.options.forEach(opt => {
          contentHtml += `<label><input type="radio" name="q${i}" value="${opt}" required> ${opt}</label><br>`;
        });
      });
      contentHtml += `<button type="submit">إرسال الإجابات</button></form>`;
    }

    courseContent.innerHTML = contentHtml;

    // متابعة تقدم الفيديو
    if (lesson.type === "video") {
      const video = document.getElementById("lesson-video");
      video.addEventListener("ended", async () => {
        await markLessonCompleted(index);
      });
    }

    // متابعة الاختبارات
    const quizForm = document.getElementById("quizForm");
    if (quizForm) {
      quizForm.addEventListener("submit", async e => {
        e.preventDefault();
        let correct = true;
        lesson.quiz.forEach((q, i) => {
          const selected = quizForm[`q${i}`].value;
          if (selected !== q.correctAnswer) correct = false;
        });
        if (!correct) return alert("لم تجتاز الاختبار بعد، حاول مرة أخرى.");

        await markLessonCompleted(index);
      });
    }
  }

  async function markLessonCompleted(index) {
    const studentRef = doc(db, "courses", courseId, "progress", studentId);
    await updateDoc(studentRef, {
      completedLessons: arrayUnion(index),
      lastUpdated: new Date().toISOString()
    }).catch(async () => {
      // إذا لم يكن المستند موجود، إنشاؤه
      await setDoc(studentRef, {
        completedLessons: [index],
        lastUpdated: new Date().toISOString()
      });
    });

    document.getElementById(`lesson-progress-${index}`).textContent = "100%";
    alert("تم إتمام الدرس! يمكنك الانتقال للدرس التالي.");
  }

  loadCourse();
});
