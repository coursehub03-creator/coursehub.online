import { auth, db } from "/js/firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let courseId;
let course;
let user;
let courseTitle = "";
let courseDescription = "";

let currentLesson = 0;
let currentSlide = 0;
let isQuizActive = false;
let quizState = null;
let courseCompleted = false;

const quizSummary = {
  totalQuestions: 0,
  correctAnswers: 0,
  lessons: []
};

const NOTIFICATION_KEY = "coursehub_notifications";
const INCOMPLETE_KEY = "coursehub_incomplete_progress";
const COMPLETED_KEY = "coursehub_completed_courses";

function normalizeCourseLessons(rawCourse) {
  const lessonSource = Array.isArray(rawCourse.lessons) && rawCourse.lessons.length
    ? rawCourse.lessons
    : Array.isArray(rawCourse.modules)
      ? rawCourse.modules.flatMap((m) => m.lessons || [])
      : [];

  return lessonSource.map((lesson, i) => {
    const rawSlides = Array.isArray(lesson.slides) && lesson.slides.length
      ? lesson.slides
      : [{ title: lesson.title || `شريحة ${i + 1}`, content: lesson.content || lesson.summary || "", type: lesson.contentType || "text" }];

    const slides = rawSlides.map((slide) => {
      if (Array.isArray(slide.elements) && slide.elements.length) {
        const firstText = slide.elements.find((el) => ["heading", "text"].includes(el.type));
        const firstMedia = slide.elements.find((el) => ["image", "video"].includes(el.type));
        return {
          title: slide.title || lesson.title || "",
          content: firstText?.text || "",
          mediaUrl: firstMedia?.src || "",
          type: firstMedia?.type || "text",
          style: {
            backgroundColor: slide.background || "#ffffff",
            textAlign: "right",
            textColor: "#0f172a",
            fontSize: 22,
            fontWeight: 600
          }
        };
      }
      return slide;
    });

    const quizQuestions = lesson.checkpointQuiz?.questions || lesson.quiz || [];
    return { ...lesson, slides, quiz: quizQuestions };
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  courseId = params.get("id");

  if (!courseId) {
    alert("❌ courseId مفقود");
    return;
  }

  auth.onAuthStateChanged(async (u) => {
    if (!u) {
      alert("يرجى تسجيل الدخول");
      location.href = "/login.html";
      return;
    }

    user = u;

    await loadCourse();
    await loadResume();
    renderSidebar();
    renderSlide();
  });

  window.addEventListener("beforeunload", () => {
    if (courseCompleted) return;
    notifyIncompleteCourse();
  });
});

async function loadCourse() {
  const snap = await getDoc(doc(db, "courses", courseId));

  if (!snap.exists()) {
    alert("الدورة غير موجودة");
    window.location.href = "/courses.html";
    return;
  }

  course = snap.data();
  course.lessons = normalizeCourseLessons(course);

  if (course.status !== "published") {
    alert("هذه الدورة غير متاحة حالياً للطلاب.");
    window.location.href = "/courses.html";
    return;
  }

  const lang = localStorage.getItem("coursehub_lang") || "ar";
  courseTitle = lang === "en" ? course.titleEn || course.title : course.title;
  courseDescription =
    lang === "en" ? course.descriptionEn || course.description : course.description;

  const title = document.getElementById("courseTitle");
  if (title) title.textContent = courseTitle;

  const sidebarTitle = document.getElementById("courseTitleSidebar");
  if (sidebarTitle) sidebarTitle.textContent = courseTitle;

  const subtitle = document.getElementById("courseSubtitle");
  if (subtitle) {
    subtitle.textContent =
      courseDescription || "تابع هذه الدورة خطوة بخطوة بإشراف خبراء.";
  }

  const instructor = document.getElementById("courseInstructor");
  if (instructor) {
    instructor.textContent = course.instructor ? `المدرب: ${course.instructor}` : "";
  }

  const level = document.getElementById("courseLevel");
  if (level) {
    level.textContent = course.level ? `المستوى: ${course.level}` : "المستوى: جميع المستويات";
  }

  const duration = document.getElementById("courseDuration");
  if (duration) {
    duration.textContent = course.duration ? `المدة: ${course.duration}` : "";
  }
}

function renderSidebar() {
  const ul = document.getElementById("lessonsList");
  ul.innerHTML = "";

  course.lessons.forEach((lesson, i) => {
    const li = document.createElement("li");
    li.textContent = lesson.title;

    if (i === currentLesson) li.classList.add("active");
    if (i < currentLesson) li.classList.add("completed");

    // ✅ منع تخطي الدروس
    li.onclick = () => {
      if (i > currentLesson) {
        alert("يجب إكمال الدرس الحالي أولاً");
        return;
      }

      currentLesson = i;
      currentSlide = 0;
      renderSidebar();
      renderSlide();
    };

    ul.appendChild(li);
  });
}

function renderSlide() {
  isQuizActive = false;
  const playerContent = document.querySelector(".player-content");
  if (playerContent) playerContent.classList.remove("is-quiz");

  const lesson = course.lessons[currentLesson];
  const slide = lesson.slides[currentSlide];
  const box = document.getElementById("slideContainer");
  const slideStyle = slide.style || {};
  const layoutClass = slideStyle.layout || "media-right";
  const textAlign = slideStyle.textAlign || "right";
  const textColor = slideStyle.textColor || "#0f172a";
  const backgroundColor = slideStyle.backgroundColor || "#ffffff";
  const fontSize = Math.max(slideStyle.fontSize || 24, 18);
  const fontWeight = slideStyle.fontWeight || 600;
  const titleFontSize = Math.max(fontSize + 6, 26);
  const bodyFontSize = Math.max(fontSize - 2, 16);
  const slideBody = (slide.content ?? slide.text ?? "").replace(/\n/g, "<br>");
  const hasMedia = Boolean(slide.mediaUrl);
  const mediaMarkup = hasMedia
    ? slide.type === "video"
      ? `<video src="${slide.mediaUrl}" controls></video>`
      : `<img src="${slide.mediaUrl}" alt="${slide.title || "وسائط الدرس"}">`
    : "";
  const slideClassNames = [
    "course-slide",
    layoutClass,
    hasMedia && slide.type !== "text" ? "" : "no-media"
  ]
    .filter(Boolean)
    .join(" ");

  box.innerHTML = `
    <div class="lesson-header">
      <span class="lesson-label">الدرس ${currentLesson + 1} من ${course.lessons.length}</span>
      <h2>${lesson.title}</h2>
    </div>
    <div class="${slideClassNames}" style="background: ${backgroundColor};">
      <div class="course-slide-text" style="color: ${textColor}; text-align: ${textAlign};">
        <h3 style="font-size: ${titleFontSize}px; font-weight: ${fontWeight};">${slide.title || ""}</h3>
        <div class="slide-content" style="font-size: ${bodyFontSize}px; color: ${textColor};">
          ${slideBody}
        </div>
      </div>
      <div class="course-slide-media">
        ${
          hasMedia && slide.type !== "text"
            ? mediaMarkup
            : `<span class="slide-media-empty">لا توجد وسائط لهذا السلايد</span>`
        }
      </div>
    </div>
  `;

  updateButtons();
  updateProgressBar();
  saveResume();
}

function updateButtons() {
  if (isQuizActive) return;
  document.getElementById("prevBtn").disabled =
    currentSlide === 0 && currentLesson === 0;
}

document.getElementById("nextBtn").onclick = () => {
  if (isQuizActive) return;
  const lesson = course.lessons[currentLesson];

  if (currentSlide < lesson.slides.length - 1) {
    currentSlide++;
    renderSlide();
  } else if (lesson.quiz?.length) {
    renderQuiz(lesson);
  } else {
    nextLesson();
  }
};

document.getElementById("prevBtn").onclick = () => {
  if (isQuizActive) return;

  if (currentSlide > 0) {
    currentSlide--;
  } else if (currentLesson > 0) {
    currentLesson--;
    currentSlide = 0;
  }

  renderSidebar();
  renderSlide();
};

function renderQuiz(lesson) {
  const box = document.getElementById("slideContainer");

  isQuizActive = true;
  const playerContent = document.querySelector(".player-content");
  if (playerContent) playerContent.classList.add("is-quiz");

  quizState = {
    lessonIndex: currentLesson,
    questionIndex: 0,
    answers: [],
    lesson
  };

  box.innerHTML = "";
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const box = document.getElementById("slideContainer");
  const lesson = quizState.lesson;
  const question = lesson.quiz[quizState.questionIndex];

  const selectedValue = quizState.answers[quizState.questionIndex];
  const isLast = quizState.questionIndex === lesson.quiz.length - 1;

  box.innerHTML = `
    <div class="quiz-shell">
      <div class="quiz-header">
        <span class="quiz-label">اختبار الدرس</span>
        <h2>${lesson.title}</h2>
        <p class="quiz-progress">سؤال ${quizState.questionIndex + 1} من ${lesson.quiz.length}</p>
      </div>
      <div class="quiz-question">
        <h3>${question.question}</h3>
        <div class="quiz-options">
          ${question.options
            .map(
              (opt, idx) => `
            <label class="quiz-option">
              <input type="radio" name="quizOption" value="${idx}" ${
                selectedValue === idx ? "checked" : ""
              }>
              <span>${opt}</span>
            </label>
          `
            )
            .join("")}
        </div>
      </div>
      <div class="quiz-actions">
        <button class="secondary" id="quizPrevBtn" ${
          quizState.questionIndex === 0 ? "disabled" : ""
        }>السابق</button>
        <button class="primary" id="quizNextBtn" disabled>${
          isLast ? "إرسال الاختبار" : "التالي"
        }</button>
      </div>
    </div>
  `;

  const nextBtn = document.getElementById("quizNextBtn");
  const prevBtn = document.getElementById("quizPrevBtn");
  const options = box.querySelectorAll("input[name='quizOption']");

  options.forEach((option) => {
    option.addEventListener("change", () => {
      quizState.answers[quizState.questionIndex] = Number(option.value);
      nextBtn.disabled = false;
    });
  });

  if (selectedValue !== undefined) nextBtn.disabled = false;

  nextBtn.addEventListener("click", () => {
    if (isLast) {
      submitQuiz(lesson);
      return;
    }
    quizState.questionIndex += 1;
    renderQuizQuestion();
  });

  prevBtn.addEventListener("click", () => {
    if (quizState.questionIndex === 0) return;
    quizState.questionIndex -= 1;
    renderQuizQuestion();
  });
}

function submitQuiz(lesson) {
  let score = 0;
  lesson.quiz.forEach((q, i) => {
    if (quizState.answers[i] === q.correct) score++;
  });

  const percent = Math.round((score / lesson.quiz.length) * 100);
  const passed = percent >= 80;
  const isLastLesson = currentLesson >= course.lessons.length - 1;

  quizSummary.totalQuestions += lesson.quiz.length;
  quizSummary.correctAnswers += score;
  quizSummary.lessons.push({
    title: lesson.title,
    score,
    total: lesson.quiz.length,
    percent,
    passed
  });

  saveQuizAttempt(lesson, score, percent);

  const box = document.getElementById("slideContainer");
  box.innerHTML = `
      <div class="quiz-result ${passed ? "passed" : "failed"}">
      <h2>${passed ? "أحسنت! اجتزت اختبار الدرس" : "للأسف، تحتاج لإعادة المحاولة"}</h2>
      <p>نتيجتك: ${score} من ${lesson.quiz.length} (${percent}%)</p>
      <div class="quiz-result-actions">
        ${
          passed
            ? `<button class="primary" id="continueLessonBtn">${
                isLastLesson ? "استلم شهادتك" : "متابعة الدرس التالي"
              }</button>`
            : `<button class="primary" id="retryQuizBtn">إعادة المحاولة</button>`
        }
      </div>
    </div>
  `;

  if (passed) {
    document.getElementById("continueLessonBtn").addEventListener("click", async () => {
      isQuizActive = false;
      if (isLastLesson) {
        const btn = document.getElementById("continueLessonBtn");
        if (btn) {
          btn.disabled = true;
          btn.textContent = "جاري تجهيز الشهادة...";
        }
        await completeCourse();
        return;
      } else {
        nextLesson();
      }
    });
  } else {
    document.getElementById("retryQuizBtn").addEventListener("click", () => {
      quizSummary.totalQuestions -= lesson.quiz.length;
      quizSummary.correctAnswers -= score;
      quizSummary.lessons.pop();
      quizState = {
        lessonIndex: currentLesson,
        questionIndex: 0,
        answers: [],
        lesson
      };
      renderQuizQuestion();
    });
  }
}

function nextLesson() {
  if (currentLesson < course.lessons.length - 1) {
    currentLesson++;
    currentSlide = 0;
    renderSidebar();
    renderSlide();
  } else {
    completeCourse();
  }
}

async function completeCourse({ showSummary = true } = {}) {
  courseCompleted = true;

  const finalScore = quizSummary.totalQuestions
    ? Math.round((quizSummary.correctAnswers / quizSummary.totalQuestions) * 100)
    : 100;

  const certId = `${user.uid}_${courseId}`;
  const verificationCode = generateVerificationCode();

  // ✅ توليد شهادة (DataURL)
  const certificateUrl = await generateCertificateUrl(verificationCode);

  try {
    // ✅ حفظ الشهادة في مجموعة certificates العامة
    await setDoc(doc(db, "certificates", certId), {
      userId: user.uid,
      userEmail: user.email || "",
      userName: user.displayName || user.email?.split("@")[0] || "Student",
      courseId,
      courseTitle: courseTitle || course.title,
      completedAt: new Date(),
      verificationCode,
      certificateUrl,
      status: "active"
    });

    // ✅ حفظ بيانات الإنجاز في مجموعات فرعية لتجنب تضخم مستند المستخدم
    await setDoc(
      doc(db, "users", user.uid, "completedCourses", courseId),
      {
        id: courseId,
        title: courseTitle || course.title,
        instructor: course.instructor || "",
        image: course.image || "/assets/images/default-course.png",
        completedAt: new Date().toLocaleDateString("ar-EG")
      },
      { merge: true }
    );

    await setDoc(
      doc(db, "users", user.uid, "certificates", certId),
      {
        title: courseTitle || course.title,
        issuedAt: new Date().toLocaleDateString("ar-EG"),
        certificateUrl: certificateUrl || course.certificateUrl || "/assets/images/certificate.svg",
        verificationCode
      },
      { merge: true }
    );
  } catch (error) {
    console.error("❌ خطأ أثناء حفظ بيانات الشهادة:", error);
  }

  saveCompletionState();

  pushCourseNotification({
    title: "تم إنهاء الدورة بنجاح",
    message: `تهانينا! أكملت دورة "${courseTitle || course.title}" بنجاح.`,
    link: "/achievements.html"
  });

  if (showSummary) {
    showCourseCompletion(finalScore);
  }
}

async function saveResume() {
  try {
    if (!user || !courseId) return;

    const docId = `${user.uid}_${courseId}`;

    await setDoc(
      doc(db, "enrollments", docId),
      {
        userId: user.uid,
        courseId: courseId,
        lesson: currentLesson,
        slide: currentSlide,
        updatedAt: new Date()
      },
      { merge: true }
    );
  } catch (err) {
    console.error("❌ خطأ أثناء حفظ التقدم:", err);
  }
}

async function loadResume() {
  const docId = `${user.uid}_${courseId}`;
  const snap = await getDoc(doc(db, "enrollments", docId));
  if (!snap.exists()) return;

  const data = snap.data();
  currentLesson = data.lesson || 0;
  currentSlide = data.slide || 0;
}

function updateProgressBar() {
  const totalSteps = course.lessons.reduce(
    (sum, lesson) => sum + lesson.slides.length + (lesson.quiz?.length ? 1 : 0),
    0
  );

  const completedLessonsSteps = course.lessons
    .slice(0, currentLesson)
    .reduce(
      (sum, lesson) => sum + lesson.slides.length + (lesson.quiz?.length ? 1 : 0),
      0
    );

  let currentSteps = currentSlide + 1;
  if (isQuizActive) {
    currentSteps = course.lessons[currentLesson].slides.length + 1;
  }

  const percent = Math.min(
    100,
    Math.floor(((completedLessonsSteps + currentSteps) / totalSteps) * 100)
  );

  document.getElementById("courseProgress").style.width = percent + "%";
  document.getElementById("progressText").textContent = percent + "%";
}

function showCourseCompletion(finalScore) {
  const box = document.getElementById("slideContainer");
  const summaryItems = quizSummary.lessons
    .map(
      (lesson) => `
    <li>
      <strong>${lesson.title}</strong>
      <span>${lesson.score}/${lesson.total} (${lesson.percent}%)</span>
    </li>
  `
    )
    .join("");

  box.innerHTML = `
    <div class="course-finish">
      <h2>🎉 تم إنهاء الدورة بنجاح</h2>
      <p>نتيجتك الإجمالية في الاختبارات: ${finalScore}%</p>
      ${
        quizSummary.lessons.length
          ? `
        <div class="course-finish-results">
          <h3>تفاصيل نتائج الاختبارات</h3>
          <ul>${summaryItems}</ul>
        </div>
      `
          : `<p>لا توجد اختبارات لهذه الدورة.</p>`
      }
      <button class="primary" id="goAchievementsBtn">عرض شهادتي</button>
    </div>
  `;

  document.getElementById("goAchievementsBtn").addEventListener("click", () => {
    location.href = "/achievements.html";
  });

}

function pushLocalNotification({ title, message, link }) {
  const notifications = getStoredNotifications();
  const entry = {
    id: `${user.uid}_${Date.now()}`,
    userId: user.uid,
    title,
    message,
    link,
    read: false,
    createdAt: new Date().toISOString()
  };
  notifications.push(entry);
  localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(notifications));
}

async function pushCourseNotification({ title, message, link }) {
  pushLocalNotification({ title, message, link });

  try {
    await addDoc(collection(db, "notifications"), {
      userId: user.uid,
      title,
      message,
      link,
      read: false,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("تعذر إرسال الإشعار:", error);
  }
}

function getStoredNotifications() {
  try {
    const stored = JSON.parse(localStorage.getItem(NOTIFICATION_KEY));
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    return [];
  }
}

function notifyIncompleteCourse() {
  if (!user || !courseId || !course) return;

  const completedCourses = getCompletedCourses();
  if (completedCourses[courseId]) return;
  if (currentLesson === 0 && currentSlide === 0) return;

  const progressStore = getIncompleteStore();
  const currentProgress = `${currentLesson}-${currentSlide}`;
  const lastProgress = progressStore[courseId];
  if (lastProgress === currentProgress) return;

  progressStore[courseId] = currentProgress;
  localStorage.setItem(INCOMPLETE_KEY, JSON.stringify(progressStore));

  pushCourseNotification({
    title: "لم تُكمل الدورة بعد",
    message: `لم تكمل دورة "${courseTitle || course.title}" بعد، ننتظرك للمتابعة!`,
    link: `/course-player.html?id=${courseId}`
  });
}

function getIncompleteStore() {
  try {
    const stored = JSON.parse(localStorage.getItem(INCOMPLETE_KEY));
    return stored && typeof stored === "object" ? stored : {};
  } catch (error) {
    return {};
  }
}

function saveCompletionState() {
  const completed = getCompletedCourses();
  completed[courseId] = true;
  localStorage.setItem(COMPLETED_KEY, JSON.stringify(completed));

  const progressStore = getIncompleteStore();
  delete progressStore[courseId];
  localStorage.setItem(INCOMPLETE_KEY, JSON.stringify(progressStore));
}

function getCompletedCourses() {
  try {
    const stored = JSON.parse(localStorage.getItem(COMPLETED_KEY));
    return stored && typeof stored === "object" ? stored : {};
  } catch (error) {
    return {};
  }
}

async function saveQuizAttempt(lesson, score, percent) {
  try {
    await addDoc(collection(db, "quizAttempts"), {
      userId: user.uid,
      courseId,
      courseTitle: courseTitle || course.title,
      lessonTitle: lesson.title,
      score,
      percent,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("تعذر حفظ نتيجة الاختبار:", error);
  }
}

function generateVerificationCode() {
  return `CH-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

async function generateCertificateUrl(verificationCode) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 850;

    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    const template = await loadImage("/assets/images/certificate.svg");
    ctx.drawImage(template, 0, 0, canvas.width, canvas.height);

    const lang = localStorage.getItem("coursehub_lang") || "ar";
    const studentName = user?.displayName || user?.email || "طالب CourseHub";
    const titleToPrint = lang === "en" ? course.titleEn || course.title : course.title;
// ✅ تنسيق ثابت DD/MM/YYYY
const date = new Date().toLocaleDateString("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});


    ctx.textAlign = "center";

    ctx.fillStyle = "#1d4ed8";
    ctx.font = "bold 44px 'Inter', sans-serif";
    ctx.fillText(studentName, canvas.width / 2, 415);

    ctx.fillStyle = "#111827";
    ctx.font = "bold 34px 'Inter', sans-serif";
    ctx.fillText(titleToPrint, canvas.width / 2, 550);

    ctx.fillStyle = "#6b7280";
    ctx.font = "20px 'Inter', sans-serif";
    ctx.fillText(date, 300, 690);
    if (verificationCode) {
      ctx.fillText(verificationCode, 390, 725);
    }

    return canvas.toDataURL("image/png");
  } catch (error) {
    console.error("تعذر إنشاء الشهادة:", error);
    return "";
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
