import { auth, db, storage } from "/js/firebase-config.js";
import { addDoc, collection, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDownloadURL, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const LOCAL_DRAFT_KEY = "coursehub_builder2_draft";
const STEP_TEMPLATES = ["text", "video", "image", "exercise", "checkpointQuiz", "summary"];

let user;
let wizardStep = 0;
let state = {
  title: "",
  category: "",
  description: "",
  image: "",
  price: 0,
  level: "",
  language: "العربية",
  durationHours: 0,
  lessons: []
};

document.addEventListener("DOMContentLoaded", () => {
  initWizard();
  bindEvents();

  auth.onAuthStateChanged(async (u) => {
    if (!u) return (window.location.href = "/login.html");
    user = u;
    await restoreDraft();
    await maybeLoadMigrationCourse();
    renderLessons();
    setStep(0);
  });
});

function initWizard() {
  const labels = ["معلومات", "Lessons", "Checkpoints", "Preview"];
  document.getElementById("wizardSteps").innerHTML = labels
    .map((label, idx) => `<div class="wizard-step ${idx === 0 ? "active" : ""}" data-wizard-dot="${idx}">${idx + 1}. ${label}</div>`)
    .join("");
}

function bindEvents() {
  document.getElementById("nextWizard")?.addEventListener("click", () => setStep(wizardStep + 1));
  document.getElementById("prevWizard")?.addEventListener("click", () => setStep(wizardStep - 1));
  document.getElementById("addLesson")?.addEventListener("click", addLesson);
  document.getElementById("saveDraft")?.addEventListener("click", () => saveDraft(true));
  document.getElementById("builderForm")?.addEventListener("submit", submitCourse);

  ["title", "category", "description", "image", "price", "level", "language", "durationHours"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", () => {
      const el = document.getElementById(id);
      state[id] = el.type === "number" ? Number(el.value || 0) : el.value;
      debouncedAutosave();
      renderPreview();
    });
  });

  document.getElementById("coverImage")?.addEventListener("change", () => {
    const file = document.getElementById("coverImage").files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    document.getElementById("coverPreview").src = url;
  });
}


function setStep(next) {
  wizardStep = Math.max(0, Math.min(3, next));
  document.querySelectorAll(".wizard-panel").forEach((panel, idx) => panel.classList.toggle("active", idx === wizardStep));
  document.querySelectorAll(".wizard-step").forEach((dot, idx) => dot.classList.toggle("active", idx === wizardStep));
  document.getElementById("submitCourse").style.display = wizardStep === 3 ? "inline-flex" : "none";
  document.getElementById("nextWizard").style.display = wizardStep === 3 ? "none" : "inline-flex";
  renderPreview();
}

function addLesson() {
  state.lessons.push({
    id: crypto.randomUUID(),
    title: `Lesson ${state.lessons.length + 1}`,
    duration: "",
    summary: "",
    steps: []
  });
  renderLessons();
  debouncedAutosave();
}

function addStep(lessonId, type = "text") {
  const lesson = state.lessons.find((l) => l.id === lessonId);
  if (!lesson) return;
  lesson.steps.push({
    id: crypto.randomUUID(),
    type,
    title: `${type} step`,
    content: "",
    mediaUrl: "",
    options: type === "checkpointQuiz" ? ["خيار 1", "خيار 2"] : [],
    correctIndex: 0,
    points: 10
  });
  renderLessons();
  debouncedAutosave();
}

function moveItem(arr, from, to) {
  if (to < 0 || to >= arr.length) return;
  const [item] = arr.splice(from, 1);
  arr.splice(to, 0, item);
}

function renderLessons() {
  const root = document.getElementById("lessonsBuilder");
  root.innerHTML = state.lessons.map((lesson, lessonIndex) => `
    <article class="lesson-card" data-lesson-id="${lesson.id}">
      <header>
        <input data-lesson-field="title" value="${esc(lesson.title)}" placeholder="عنوان الدرس">
        <input data-lesson-field="duration" value="${esc(lesson.duration)}" placeholder="المدة">
        <button type="button" class="btn ghost" data-lesson-move="up" ${lessonIndex === 0 ? "disabled" : ""}>↑</button>
        <button type="button" class="btn ghost" data-lesson-move="down" ${lessonIndex === state.lessons.length - 1 ? "disabled" : ""}>↓</button>
      </header>
      <textarea data-lesson-field="summary" placeholder="ملخص الدرس">${lesson.summary || ""}</textarea>
      <div class="step-actions-inline">
        ${STEP_TEMPLATES.map((type) => `<button type="button" class="btn ghost" data-add-step="${type}">+ ${type}</button>`).join("")}
      </div>
      <div class="steps-list">
        ${lesson.steps.map((step, stepIndex) => `
          <div class="step-row" data-step-id="${step.id}">
            <input data-step-field="title" value="${esc(step.title)}" placeholder="عنوان الخطوة">
            <select data-step-field="type">${STEP_TEMPLATES.map((type) => `<option value="${type}" ${step.type === type ? "selected" : ""}>${type}</option>`).join("")}</select>
            <textarea data-step-field="content" placeholder="المحتوى">${step.content || ""}</textarea>
            <input data-step-field="mediaUrl" value="${esc(step.mediaUrl || "")}" placeholder="mediaUrl">
            ${step.type === "checkpointQuiz" ? `<input data-step-field="options" value="${esc((step.options || []).join("|"))}" placeholder="خيارات مفصولة |">` : ""}
            <div class="step-actions-inline">
              <button type="button" class="btn ghost" data-step-move="up" ${stepIndex === 0 ? "disabled" : ""}>↑</button>
              <button type="button" class="btn ghost" data-step-move="down" ${stepIndex === lesson.steps.length - 1 ? "disabled" : ""}>↓</button>
              <button type="button" class="btn ghost" data-step-delete>حذف</button>
            </div>
          </div>`).join("")}
      </div>
    </article>
  `).join("");

  bindLessonEvents();
  renderPreview();
}

function bindLessonEvents() {
  document.querySelectorAll(".lesson-card").forEach((card) => {
    const lessonId = card.dataset.lessonId;
    const lesson = state.lessons.find((l) => l.id === lessonId);
    if (!lesson) return;

    card.querySelectorAll("[data-lesson-field]").forEach((input) => {
      input.addEventListener("input", () => {
        lesson[input.dataset.lessonField] = input.value;
        debouncedAutosave();
        renderPreview();
      });
    });

    card.querySelector("[data-lesson-move='up']")?.addEventListener("click", () => {
      const idx = state.lessons.findIndex((l) => l.id === lessonId);
      moveItem(state.lessons, idx, idx - 1);
      renderLessons();
      debouncedAutosave();
    });

    card.querySelector("[data-lesson-move='down']")?.addEventListener("click", () => {
      const idx = state.lessons.findIndex((l) => l.id === lessonId);
      moveItem(state.lessons, idx, idx + 1);
      renderLessons();
      debouncedAutosave();
    });

    card.querySelectorAll("[data-add-step]").forEach((btn) => btn.addEventListener("click", () => addStep(lessonId, btn.dataset.addStep)));

    card.querySelectorAll(".step-row").forEach((stepRow) => {
      const step = lesson.steps.find((s) => s.id === stepRow.dataset.stepId);
      if (!step) return;

      stepRow.querySelectorAll("[data-step-field]").forEach((field) => {
        field.addEventListener("input", () => {
          const key = field.dataset.stepField;
          step[key] = key === "options" ? field.value.split("|").map((v) => v.trim()).filter(Boolean) : field.value;
          debouncedAutosave();
          renderPreview();
        });
      });

      stepRow.querySelector("[data-step-delete]")?.addEventListener("click", () => {
        lesson.steps = lesson.steps.filter((s) => s.id !== step.id);
        renderLessons();
        debouncedAutosave();
      });

      stepRow.querySelector("[data-step-move='up']")?.addEventListener("click", () => {
        const idx = lesson.steps.findIndex((s) => s.id === step.id);
        moveItem(lesson.steps, idx, idx - 1);
        renderLessons();
        debouncedAutosave();
      });

      stepRow.querySelector("[data-step-move='down']")?.addEventListener("click", () => {
        const idx = lesson.steps.findIndex((s) => s.id === step.id);
        moveItem(lesson.steps, idx, idx + 1);
        renderLessons();
        debouncedAutosave();
      });
    });
  });
}

function renderPreview() {
  const firstLesson = state.lessons[0];
  const firstStep = firstLesson?.steps?.[0];
  document.getElementById("playerPreview").innerHTML = `
    <h3>${state.title || "عنوان الدورة"}</h3>
    <p>${state.description || "وصف الدورة"}</p>
    <hr>
    <strong>${firstLesson?.title || "أضف Lesson لعرض المعاينة"}</strong>
    <p>${firstStep?.title || "أضف Step من Templates"}</p>
    <div>${firstStep?.content || ""}</div>
  `;

  const checkpoints = state.lessons.flatMap((l) => l.steps).filter((s) => s.type === "checkpointQuiz").length;
  document.getElementById("checkpointHint").textContent = `عدد checkpoints الحالية: ${checkpoints}`;
}

async function saveDraft(showMessage = false) {
  const payload = getPayload("draft");
  localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(payload));
  if (user?.uid) {
    await setDoc(doc(db, "instructorCourseDrafts", user.uid), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
  }
  if (showMessage) setStatus("✅ تم حفظ المسودة محليًا وسحابيًا");
}

async function restoreDraft() {
  const local = safeParse(localStorage.getItem(LOCAL_DRAFT_KEY));
  const remoteSnap = user?.uid ? await getDoc(doc(db, "instructorCourseDrafts", user.uid)) : null;
  const remote = remoteSnap?.exists() ? remoteSnap.data() : null;
  state = pickLatestDraft(local, remote) || state;

  Object.keys(state).forEach((key) => {
    const input = document.getElementById(key);
    if (input && typeof state[key] !== "object") input.value = state[key] ?? "";
  });
  document.getElementById("coverPreview").src = state.image || "/assets/images/default-course.png";
  renderLessons();
}

async function submitCourse(event) {
  event.preventDefault();
  try {
    state.image = document.getElementById("image").value || state.image;
    const coverFile = document.getElementById("coverImage")?.files?.[0];
    if (coverFile) {
      const coverRef = ref(storage, `courses/covers/${Date.now()}_${coverFile.name}`);
      await uploadBytes(coverRef, coverFile);
      state.image = await getDownloadURL(coverRef);
    }
    const payload = getPayload("pending");
    await addDoc(collection(db, "courses"), payload);
    setStatus("✅ تم إرسال الدورة للمراجعة");
    localStorage.removeItem(LOCAL_DRAFT_KEY);
  } catch (error) {
    console.error(error);
    setStatus("❌ فشل إرسال الدورة", true);
  }
}

function getPayload(status = "draft") {
  const lessons = state.lessons.map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    duration: lesson.duration,
    summary: lesson.summary,
    steps: lesson.steps.map((step) => ({
      id: step.id,
      type: step.type,
      title: step.title,
      content: step.content,
      mediaUrl: step.mediaUrl,
      options: step.options || [],
      correctIndex: Number(step.correctIndex || 0),
      points: Number(step.points || 10)
    }))
  }));

  return {
    title: state.title,
    description: state.description,
    category: state.category,
    price: Number(state.price || 0),
    level: state.level,
    language: state.language,
    durationHours: Number(state.durationHours || 0),
    image: state.image,
    instructorId: user?.uid || "",
    status,
    lessons,
    modules: lessons.map((lesson) => ({ title: lesson.title })),
    assessmentQuestions: lessons.flatMap((lesson) => lesson.steps.filter((step) => step.type === "checkpointQuiz").map((step) => ({
      question: step.title,
      options: step.options || [],
      correctIndex: step.correctIndex || 0
    }))),
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp()
  };
}

async function maybeLoadMigrationCourse() {
  const courseId = new URLSearchParams(window.location.search).get("courseId");
  if (!courseId) return;
  const snap = await getDoc(doc(db, "courses", courseId));
  if (!snap.exists()) return;
  const data = snap.data();

  const migratedLessons = Array.isArray(data.lessons) && data.lessons.length
    ? data.lessons
    : migrateLegacyToLessons(data.modules || [], data.assessmentQuestions || []);

  state = {
    ...state,
    title: data.title || "",
    description: data.description || "",
    category: data.category || "",
    price: data.price || 0,
    level: data.level || "",
    language: data.language || "العربية",
    durationHours: data.durationHours || 0,
    image: data.image || "",
    lessons: migratedLessons.map(normalizeLesson)
  };

  Object.keys(state).forEach((key) => {
    const input = document.getElementById(key);
    if (input && typeof state[key] !== "object") input.value = state[key] ?? "";
  });

  document.getElementById("coverPreview").src = state.image || "/assets/images/default-course.png";
  renderLessons();
  setStatus("ℹ️ تم استيراد محتوى النظام القديم بنجاح");
}


function normalizeLesson(lesson, idx) {
  const rawSteps = Array.isArray(lesson.steps) && lesson.steps.length ? lesson.steps : [
    ...(lesson.slides || []).map((slide, i) => ({ id: slide.id || `${lesson.id || idx}-slide-${i}`, type: slide.type || "text", title: slide.title || `Slide ${i + 1}`, content: slide.content || slide.text || "", mediaUrl: slide.mediaUrl || "" })),
    ...(lesson.quiz || []).map((q, i) => ({ id: `${lesson.id || idx}-quiz-${i}`, type: "checkpointQuiz", title: q.question || `Quiz ${i + 1}`, options: q.options || [], correctIndex: Number(q.correct ?? q.correctIndex ?? 0) }))
  ];

  return {
    id: lesson.id || `lesson-${idx + 1}`,
    title: lesson.title || `Lesson ${idx + 1}`,
    duration: lesson.duration || "",
    summary: lesson.summary || "",
    steps: rawSteps.map((step, i) => ({
      id: step.id || `step-${i + 1}`,
      type: step.type || "text",
      title: step.title || `Step ${i + 1}`,
      content: step.content || step.text || "",
      mediaUrl: step.mediaUrl || "",
      options: step.options || [],
      correctIndex: Number(step.correctIndex ?? step.correct ?? 0),
      points: Number(step.points || 10)
    }))
  };
}

function migrateLegacyToLessons(modules, assessmentQuestions) {
  return (modules || []).map((module, idx) => ({
    id: `legacy-${idx + 1}`,
    title: module.title || `Module ${idx + 1}`,
    duration: module.duration || "",
    summary: "",
    steps: [
      { id: `legacy-${idx + 1}-text`, type: "text", title: module.title || "مقدمة", content: module.description || "مقدمة سريعة" },
      { id: `legacy-${idx + 1}-exercise`, type: "exercise", title: "طبّق", content: "طبّق المفهوم في تمرين بسيط" },
      {
        id: `legacy-${idx + 1}-quiz`,
        type: "checkpointQuiz",
        title: (assessmentQuestions[idx] && assessmentQuestions[idx].question) || "سؤال سريع",
        options: (assessmentQuestions[idx] && assessmentQuestions[idx].options) || ["خيار 1", "خيار 2"],
        correctIndex: (assessmentQuestions[idx] && assessmentQuestions[idx].correctIndex) || 0
      },
      { id: `legacy-${idx + 1}-summary`, type: "summary", title: "ملخص", content: "راجع أهم النقاط." }
    ]
  }));
}

function pickLatestDraft(local, remote) {
  if (!local && !remote) return null;
  if (!local) return remote;
  if (!remote) return local;
  const localAt = new Date(local.updatedAt || 0).getTime();
  const remoteAt = new Date(remote.updatedAt?.toDate ? remote.updatedAt.toDate() : remote.updatedAt || 0).getTime();
  return remoteAt > localAt ? remote : local;
}

function setStatus(msg, isError = false) {
  const el = document.getElementById("builderStatus");
  el.style.color = isError ? "#b91c1c" : "#1d4ed8";
  el.textContent = msg;
}

function safeParse(value) {
  try { return JSON.parse(value); } catch { return null; }
}

function esc(value = "") {
  return String(value).replace(/"/g, "&quot;");
}

let saveTimer;
function debouncedAutosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveDraft(false).catch(() => {}), 700);
}
