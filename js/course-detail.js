import { db, auth, storage } from "/js/firebase-config.js";
import { doc, getDoc, updateDoc, setDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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
  auth.onAuthStateChanged(user => studentId = user ? user.uid : null);

  async function loadCourse() {
    const courseRef = doc(db, "courses", courseId);
    const snapshot = await getDoc(courseRef);
    if (!snapshot.exists()) {
      courseDetail.innerHTML = "<p class='empty-msg'>الدورة غير موجودة.</p>";
      return;
    }

    const course = snapshot.data();
    courseDetail.querySelector("h2").textContent = course.title || "دورة بدون عنوان";
    courseImage.src = course.image || "/assets/images/course1.jpg";
    courseDesc.textContent = course.description || "لا يوجد وصف متاح.";

    // عرض قائمة الدروس
    courseContent.innerHTML = "";
    course.lessons?.forEach((lesson, index) => {
      const li = document.createElement("li");
      li.classList.add("lesson");
      li.innerHTML = `
        <span>${index + 1}. ${lesson.title}</span>
        <button class="start-lesson-btn" data-index="${index}">ابدأ / تابع</button>
        <div class="lesson-progress" id="lesson-progress-${index}">0%</div>
      `;
      courseContent.appendChild(li);
    });

    joinBtn.addEventListener("click", () => startLesson(0, course));
    document.querySelectorAll(".start-lesson-btn").forEach(btn => {
      btn.addEventListener("click", () => startLesson(Number(btn.dataset.index), course));
    });

    await loadProgress(course.lessons?.length || 0);
  }

  async function loadProgress(totalLessons) {
    if (!studentId) return;
    const studentRef = doc(db, "courses", courseId, "progress", studentId);
    const snapshot = await getDoc(studentRef);
    const completed = snapshot.exists() ? snapshot.data().completedLessons || [] : [];

    completed.forEach(i => {
      const bar = document.getElementById(`lesson-progress-${i}`);
      if (bar) bar.textContent = "100%";
    });

    if (completed.length < totalLessons) {
      console.log(`تذكير: الطالب لم يكمل جميع الدروس بعد (${courseId})`);
      // لاحقًا: إرسال إيميل أو إشعار
    }
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
      for (const res of lesson.resources) {
        let url = res.url;
        if (res.storagePath) {
          // إذا كان مخزن في Firebase Storage
          url = await getDownloadURL(ref(storage, res.storagePath));
        }
        contentHtml += `<li><a href="${url}" target="_blank">${res.name}</a></li>`;
      }
      contentHtml += "</ul>";
    }

    // اختبار MCQ
    if (lesson.quiz?.length > 0) {
      contentHtml += `<h4>الاختبار:</h4><form id="quizForm">`;
      lesson.quiz.forEach((q, i) => {
        contentHtml += `<p>${q.question}</p>`;
        q.options.forEach(opt => {
          contentHtml += `<label><input type="radio" name="q${i}" value="${opt}" required> ${opt}</label><br>`;
        });
      });
      contentHtml += `<button type="submit" class="btn">إرسال الإجابات</button></form>`;
    }

    courseContent.innerHTML = contentHtml;

    // متابعة الفيديو
    if (lesson.type === "video") {
      const video = document.getElementById("lesson-video");
      video.addEventListener("ended", async () => markLessonCompleted(index));
    }

    // متابعة الاختبارات
    const quizForm = document.getElementById("quizForm");
    if (quizForm) {
      quizForm.addEventListener("submit", async e => {
        e.preventDefault();
        let passed = true;
        lesson.quiz.forEach((q, i) => {
          const selected = quizForm[`q${i}`].value;
          if (selected !== q.correctAnswer) passed = false;
        });
        if (!passed) return alert("لم تجتاز الاختبار بعد، حاول مرة أخرى.");
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
      await setDoc(studentRef, {
        completedLessons: [index],
        lastUpdated: new Date().toISOString()
      });
    });

    const bar = document.getElementById(`lesson-progress-${index}`);
    if (bar) bar.textContent = "100%";
    alert("تم إتمام الدرس! يمكنك الانتقال للدرس التالي.");
  }

  loadCourse();
});
