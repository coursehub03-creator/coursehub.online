import { auth, db } from "/js/firebase-config.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { renderSlideElements, slideBackgroundStyle } from "/js/shared/slide-story-renderer.js";

let user;
let courseId = "";
let course = null;
let lessons = [];
let currentLessonIndex = 0;
let currentStepIndex = 0;
let progress = {
  lastLessonId: "",
  lastStepIndex: 0,
  completedLessons: [],
  completedSteps: {},
  xp: 0,
  badges: []
};

const STEP_XP = 15;
const LESSON_XP = 60;

document.addEventListener("DOMContentLoaded", () => {
  courseId = new URLSearchParams(window.location.search).get("courseId") || "";
  if (!courseId) {
    alert("courseId مفقود");
    return;
  }

  bindUI();
  auth.onAuthStateChanged(async (u) => {
    if (!u) return (window.location.href = "/login.html");
    user = u;
    await loadCourse();
    await loadProgress();
    renderAll();
  });
});

function bindUI() {
  document.getElementById("prevStepBtn")?.addEventListener("click", () => goStep(-1));
  document.getElementById("nextStepBtn")?.addEventListener("click", () => goStep(1));
  document.getElementById("resumeBtn")?.addEventListener("click", resumeLastPoint);
  document.getElementById("focusBtn")?.addEventListener("click", () => document.body.classList.toggle("focus-mode"));
  document.getElementById("sidebarToggle")?.addEventListener("click", () => document.body.classList.toggle("sidebar-open"));
  document.getElementById("playerOverlay")?.addEventListener("click", () => document.body.classList.remove("sidebar-open"));
  document.getElementById("lessonSearch")?.addEventListener("input", renderSidebar);
}

async function loadCourse() {
  const snap = await getDoc(doc(db, "courses", courseId));
  if (!snap.exists()) throw new Error("الدورة غير موجودة");
  course = { id: snap.id, ...snap.data() };
  lessons = normalizeLessons(course);
  document.getElementById("sidebarCourseTitle").textContent = course.title || "الدورة";
}

function normalizeLessons(courseData) {
  if (Array.isArray(courseData.lessons) && courseData.lessons.length) {
    return courseData.lessons.map((lesson, idx) => ({
      id: lesson.id || `lesson-${idx + 1}`,
      title: lesson.title || `درس ${idx + 1}`,
      summary: lesson.summary || "",
      steps: normalizeSteps(lesson.steps || lesson.slides || [])
    }));
  }

  const modules = Array.isArray(courseData.modules) ? courseData.modules : [];
  const questions = Array.isArray(courseData.assessmentQuestions) ? courseData.assessmentQuestions : [];
  return modules.map((module, idx) => ({
    id: `module-${idx + 1}`,
    title: module.title || `وحدة ${idx + 1}`,
    summary: "",
    steps: [
      { id: `m${idx + 1}-text`, type: "text", title: module.title || "مقدمة", content: module.description || "نظرة سريعة على الوحدة" },
      { id: `m${idx + 1}-exercise`, type: "exercise", title: "تطبيق", content: "طبّق ما تعلمته في تمرين قصير." },
      { id: `m${idx + 1}-quiz`, type: "checkpointQuiz", title: "Checkpoint", options: questions.slice(0, 2).map((q) => q.question || "سؤال"), correctIndex: 0 },
      { id: `m${idx + 1}-summary`, type: "summary", title: "ملخص", content: "راجع النقاط الأساسية قبل الانتقال." }
    ]
  }));
}

function normalizeSteps(steps) {
  return steps.map((step, idx) => {
    if (step?.elements?.length) {
      const txt = step.elements.find((el) => ["heading", "text"].includes(el.type));
      const media = step.elements.find((el) => ["image", "video"].includes(el.type));
      return {
        id: step.id || `step-${idx + 1}`,
        type: media?.type || "text",
        title: step.title || `شريحة ${idx + 1}`,
        content: txt?.text || "",
        mediaUrl: media?.src || "",
        options: [],
        correctIndex: 0,
        points: 0,
        elements: step.elements,
        background: step.background || "#ffffff"
      };
    }

    const checkpoint = step.checkpointQuiz || null;
    if (checkpoint?.questions?.length) {
      const firstQ = checkpoint.questions[0];
      return {
        id: step.id || `step-${idx + 1}`,
        type: "checkpointQuiz",
        title: checkpoint.title || `اختبار ${idx + 1}`,
        content: firstQ.question || "",
        mediaUrl: "",
        options: firstQ.options || [],
        correctIndex: Number(firstQ.correctIndexes?.[0] ?? 0),
        points: Number(step.points || 0)
      };
    }

    return {
      id: step.id || `step-${idx + 1}`,
      type: step.type || (step.mediaUrl ? "video" : "text"),
      title: step.title || `خطوة ${idx + 1}`,
      content: step.content || step.text || "",
      mediaUrl: step.mediaUrl || "",
      options: step.options || [],
      correctIndex: Number(step.correctIndex ?? step.correct ?? 0),
      points: Number(step.points || 0)
    };
  });
}

async function loadProgress() {
  const snap = await getDoc(doc(db, "users", user.uid, "courseProgress", courseId));
  if (!snap.exists()) return;
  progress = { ...progress, ...snap.data() };
  const startLesson = lessons.findIndex((l) => l.id === progress.lastLessonId);
  currentLessonIndex = startLesson >= 0 ? startLesson : 0;
  currentStepIndex = progress.lastStepIndex || 0;
}

function resumeLastPoint() {
  const startLesson = lessons.findIndex((l) => l.id === progress.lastLessonId);
  if (startLesson >= 0) {
    currentLessonIndex = startLesson;
    currentStepIndex = progress.lastStepIndex || 0;
    renderAll();
  }
}

function renderAll() {
  renderSidebar();
  renderStep();
  renderTopbar();
}

function renderSidebar() {
  const search = (document.getElementById("lessonSearch")?.value || "").trim();
  const list = document.getElementById("lessonsList");
  list.innerHTML = "";
  lessons
    .filter((lesson) => !search || lesson.title.includes(search))
    .forEach((lesson, i) => {
      const completed = getLessonProgress(lesson);
      const li = document.createElement("li");
      li.className = `lesson-item ${i === currentLessonIndex ? "active" : ""} ${progress.completedLessons.includes(lesson.id) ? "done" : ""}`;
      li.innerHTML = `<div class="lesson-top"><strong>${lesson.title}</strong><small>${completed}%</small></div><div class="lesson-progress"><span style="width:${completed}%"></span></div>`;
      li.addEventListener("click", () => {
        currentLessonIndex = i;
        currentStepIndex = 0;
        renderAll();
        document.body.classList.remove("sidebar-open");
      });
      list.appendChild(li);
    });
}

function renderStep() {
  const lesson = lessons[currentLessonIndex];
  const step = lesson?.steps[currentStepIndex];
  const container = document.getElementById("stepContainer");
  if (!lesson || !step) return;

  if (Array.isArray(step.elements) && step.elements.length) {
    container.innerHTML = `
      <span class="step-type">شريحة مرئية</span>
      <h1 class="step-title">${step.title}</h1>
      <div class="student-story-slide" style="${slideBackgroundStyle(step.background)}">${renderSlideElements({ elements: step.elements }, { editable: false })}</div>
    `;
  } else {
    const media = renderMedia(step);
    const quiz = step.type === "checkpointQuiz" ? renderCheckpoint(step) : "";
    container.innerHTML = `
      <span class="step-type">${mapType(step.type)}</span>
      <h1 class="step-title">${step.title}</h1>
      <div class="step-content">${step.content || ""}</div>
      ${media}
      ${quiz}
    `;
  }

  document.getElementById("stepMeta").textContent = `الدرس ${currentLessonIndex + 1}/${lessons.length} • خطوة ${currentStepIndex + 1}/${lesson.steps.length}`;
  document.getElementById("prevStepBtn").disabled = currentLessonIndex === 0 && currentStepIndex === 0;
  document.getElementById("nextStepBtn").textContent = isCourseEnd() ? "إنهاء" : "التالي";
}

function renderMedia(step) {
  if (!step.mediaUrl) return "";
  if (step.type === "video") {
    if (step.mediaUrl.includes("youtube.com") || step.mediaUrl.includes("youtu.be")) {
      return `<iframe src="${toYoutubeEmbed(step.mediaUrl)}" loading="lazy" allowfullscreen></iframe>`;
    }
    return `<video src="${step.mediaUrl}" controls></video>`;
  }
  if (step.type === "image") return `<img src="${step.mediaUrl}" alt="${step.title}">`;
  return "";
}

function renderCheckpoint(step) {
  const options = Array.isArray(step.options) && step.options.length ? step.options : ["نعم", "لا"];
  return `<div class="quiz-options">${options.map((opt, idx) => `<button type="button" data-quiz-index="${idx}">${opt}</button>`).join("")}</div>`;
}

document.addEventListener("click", (event) => {
  const optionBtn = event.target.closest("[data-quiz-index]");
  if (!optionBtn) return;
  optionBtn.parentElement.querySelectorAll("button").forEach((btn) => btn.classList.remove("selected"));
  optionBtn.classList.add("selected");
});

async function goStep(direction) {
  const lesson = lessons[currentLessonIndex];
  const step = lesson.steps[currentStepIndex];

  if (direction > 0) {
    awardStepXP(lesson.id, step.id);
    if (currentStepIndex < lesson.steps.length - 1) {
      currentStepIndex += 1;
    } else {
      markLessonDone(lesson.id);
      if (currentLessonIndex < lessons.length - 1) {
        currentLessonIndex += 1;
        currentStepIndex = 0;
      } else {
        showFinishScreen();
      }
    }
  } else if (direction < 0) {
    if (currentStepIndex > 0) currentStepIndex -= 1;
    else if (currentLessonIndex > 0) {
      currentLessonIndex -= 1;
      currentStepIndex = Math.max(0, lessons[currentLessonIndex].steps.length - 1);
    }
  }

  await persistProgress();
  renderAll();
}

function showFinishScreen() {
  const nextLesson = lessons[currentLessonIndex + 1];
  document.getElementById("stepContainer").innerHTML = `
    <div class="finish-card">
      <h2>🎉 أحسنت! أنهيت هذا الدرس</h2>
      <p>XP الحالي: ${progress.xp}</p>
      <button class="btn primary" ${nextLesson ? "" : "disabled"}>${nextLesson ? "ابدأ الدرس التالي" : "تم إنهاء الدورة"}</button>
    </div>
  `;
}

function awardStepXP(lessonId, stepId) {
  const completed = progress.completedSteps[lessonId] || [];
  if (!completed.includes(stepId)) {
    completed.push(stepId);
    progress.completedSteps[lessonId] = completed;
    progress.xp += STEP_XP;
  }
}

function markLessonDone(lessonId) {
  if (!progress.completedLessons.includes(lessonId)) {
    progress.completedLessons.push(lessonId);
    progress.xp += LESSON_XP;
  }
  progress.badges = calculateBadges(progress.completedLessons.length);
}

function calculateBadges(completedLessonsCount) {
  const badges = [];
  if (completedLessonsCount >= 1) badges.push("First Lesson");
  if (completedLessonsCount >= 3) badges.push("3 Lessons");
  if (completedLessonsCount >= 5) badges.push("Learning Streak");
  return badges;
}

async function persistProgress() {
  const lesson = lessons[currentLessonIndex];
  progress.lastLessonId = lesson?.id || "";
  progress.lastStepIndex = currentStepIndex;
  progress.updatedAt = new Date().toISOString();

  await setDoc(doc(db, "users", user.uid, "courseProgress", courseId), {
    ...progress,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

function renderTopbar() {
  const total = getCourseCompletionPercent();
  document.getElementById("globalProgressBar").style.width = `${total}%`;
  document.getElementById("globalProgressText").textContent = `${total}%`;
  document.getElementById("xpValue").textContent = `${progress.xp || 0} XP`;
  document.getElementById("badgeValue").textContent = progress.badges?.length ? progress.badges.join(" • ") : "لا توجد badges";
}

function getCourseCompletionPercent() {
  const totalSteps = lessons.reduce((acc, lesson) => acc + lesson.steps.length, 0);
  const doneSteps = Object.values(progress.completedSteps).reduce((acc, arr) => acc + arr.length, 0);
  return totalSteps ? Math.min(100, Math.round((doneSteps / totalSteps) * 100)) : 0;
}

function getLessonProgress(lesson) {
  const done = (progress.completedSteps[lesson.id] || []).length;
  return lesson.steps.length ? Math.min(100, Math.round((done / lesson.steps.length) * 100)) : 0;
}

function isCourseEnd() {
  return currentLessonIndex === lessons.length - 1 && currentStepIndex === lessons[currentLessonIndex].steps.length - 1;
}

function mapType(type) {
  const map = { text: "محتوى", video: "فيديو", image: "صورة", exercise: "تطبيق", checkpointQuiz: "سؤال سريع", summary: "ملخص" };
  return map[type] || "خطوة";
}

function toYoutubeEmbed(url) {
  if (url.includes("embed/")) return url;
  const videoId = url.includes("youtu.be/") ? url.split("youtu.be/")[1]?.split("?")[0] : new URL(url).searchParams.get("v");
  return `https://www.youtube.com/embed/${videoId || ""}`;
}
