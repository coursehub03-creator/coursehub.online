import { db, storage } from "/js/firebase-config.js";
import { addDoc, collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDownloadURL, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const LOCAL_DRAFT_KEY = "coursehub_admin_builder3_draft";
const STEP_TEMPLATES = ["text", "video", "image", "file", "checkpointQuiz", "summary"];

let authUser = null;
let wizardStep = 0;
let state = {
  title: "",
  category: "",
  description: "",
  image: "",
  price: 0,
  level: "مبتدئ",
  language: "العربية",
  durationHours: 0,
  lessons: [],
  finalQuiz: []
};

const auth = getAuth();
const uid = () => crypto.randomUUID();
const esc = (v = "") => String(v).replace(/[&<>\"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

document.addEventListener("DOMContentLoaded", async () => {
  initWizard();
  bindEvents();
  await loadCategories();
  auth.onAuthStateChanged(async (u) => {
    authUser = u;
    await restoreDraft();
    renderLessons();
    setStep(0);
  });
});

function initWizard() {
  const labels = ["معلومات", "Lessons", "Checkpoints", "Preview"];
  document.getElementById("wizardSteps").innerHTML = labels.map((label, idx) => `<div class="wizard-step ${idx === 0 ? "active" : ""}">${idx + 1}. ${label}</div>`).join("");
}

async function loadCategories() {
  const select = document.getElementById("category");
  try {
    const snap = await getDocs(collection(db, "courseCategories"));
    const cats = snap.docs.map((d) => d.data()?.name).filter(Boolean);
    select.innerHTML = cats.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("") || "<option value='عام'>عام</option>";
  } catch {
    select.innerHTML = "<option value='عام'>عام</option>";
  }
}

function bindEvents() {
  document.getElementById("nextWizard")?.addEventListener("click", () => setStep(wizardStep + 1));
  document.getElementById("prevWizard")?.addEventListener("click", () => setStep(wizardStep - 1));
  document.getElementById("addLesson")?.addEventListener("click", addLesson);
  document.getElementById("saveDraft")?.addEventListener("click", () => saveDraft(true));
  document.getElementById("builderForm")?.addEventListener("submit", submitCourse);
  document.getElementById("addFinalQuestion")?.addEventListener("click", () => {
    state.finalQuiz.push({ id: uid(), question: "", options: ["", ""], correctIndexes: [] });
    renderFinalQuiz();
    debouncedAutosave();
  });

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
    if (!file.type.startsWith("image/")) return setStatus("❌ يجب اختيار صورة من الجهاز", true);
    document.getElementById("coverPreview").src = URL.createObjectURL(file);
    const prev = document.getElementById("previewCover");
    if (prev) prev.src = URL.createObjectURL(file);
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
  state.lessons.push({ id: uid(), title: `Lesson ${state.lessons.length + 1}`, duration: "", requiredWatchSeconds: 60, summary: "", theme: "clean", layout: { textScale: 1, mediaScale: 1, x: 0, y: 0 }, steps: [] });
  renderLessons();
  debouncedAutosave();
}

function addStep(lessonId, type) {
  const lesson = state.lessons.find((l) => l.id === lessonId);
  if (!lesson) return;
  lesson.steps.push({ id: uid(), type, title: `${type} step`, content: "", mediaUrl: "", questions: type === "checkpointQuiz" ? [{ id: uid(), question: "", options: ["", ""], correctIndexes: [] }] : [] });
  renderLessons();
  debouncedAutosave();
}

function renderLessons() {
  const root = document.getElementById("lessonsBuilder");
  root.innerHTML = state.lessons.map((lesson) => `
    <article class="lesson-card" data-lesson-id="${lesson.id}">
      <header>
        <input data-lesson-field="title" value="${esc(lesson.title)}" placeholder="عنوان الدرس">
        <input data-lesson-field="requiredWatchSeconds" type="number" min="10" value="${lesson.requiredWatchSeconds}" placeholder="المدة بالثواني">
        <select data-lesson-field="theme"><option value="clean" ${lesson.theme === "clean" ? "selected" : ""}>Clean</option><option value="dark" ${lesson.theme === "dark" ? "selected" : ""}>Dark</option><option value="gradient" ${lesson.theme === "gradient" ? "selected" : ""}>Gradient</option></select>
      </header>
      <textarea data-lesson-field="summary" placeholder="ملخص الدرس">${lesson.summary || ""}</textarea>
      <div class="grid-2">
        <label>تكبير النص<input type="range" min="0.7" max="1.8" step="0.1" data-layout="textScale" value="${lesson.layout.textScale}"></label>
        <label>تكبير الوسائط<input type="range" min="0.7" max="1.8" step="0.1" data-layout="mediaScale" value="${lesson.layout.mediaScale}"></label>
      </div>
      <div class="step-actions-inline">${STEP_TEMPLATES.map((type) => `<button type="button" class="btn ghost" data-add-step="${type}">+ ${type}</button>`).join("")}</div>
      <div class="steps-list">
        ${lesson.steps.map((step) => `
          <div class="step-row" data-step-id="${step.id}">
            <input data-step-field="title" value="${esc(step.title)}" placeholder="عنوان الخطوة">
            <select data-step-field="type">${STEP_TEMPLATES.map((type) => `<option value="${type}" ${step.type === type ? "selected" : ""}>${type}</option>`).join("")}</select>
            <textarea data-step-field="content" placeholder="المحتوى">${step.content || ""}</textarea>
            <input type="file" data-step-file accept="image/*,video/*,.pdf,.zip,.doc,.docx,.ppt,.pptx">
            ${step.mediaUrl ? "<small>✅ ملف مرفوع</small>" : ""}
            ${step.type === "checkpointQuiz" ? renderCheckpoint(step) : ""}
            <button type="button" class="btn ghost" data-step-delete>حذف</button>
          </div>`).join("")}
      </div>
      <div class="preview-shell">${renderLessonPreview(lesson)}</div>
    </article>`).join("");

  bindLessonEvents();
  renderFinalQuiz();
  renderPreview();
}

function renderCheckpoint(step) {
  return `<div class='checkpoint-block'>${step.questions.map((q) => `<div data-qid='${q.id}'><input data-q='question' value='${esc(q.question)}' placeholder='السؤال'>${q.options.map((o, i) => `<div><input data-opt='${i}' value='${esc(o)}'><label><input type='checkbox' data-correct='${i}' ${q.correctIndexes.includes(i) ? "checked" : ""}> صحيح</label></div>`).join("")}<button type='button' class='btn ghost' data-add-option='${q.id}'>+ خيار</button></div>`).join("")}<button type='button' class='btn ghost' data-add-question='${step.id}'>+ سؤال</button></div>`;
}

function renderLessonPreview(lesson) {
  const style = lesson.theme === "dark" ? "background:#0f172a;color:#fff" : lesson.theme === "gradient" ? "background:linear-gradient(135deg,#dbeafe,#f5d0fe)" : "background:#fff";
  return `<div style='${style};padding:10px;border-radius:10px'><strong>${esc(lesson.title)}</strong><p style='font-size:${lesson.layout.textScale}rem'>${esc(lesson.summary || "معاينة الدرس")}</p><div>Timer: <span id='timer-${lesson.id}'>${lesson.requiredWatchSeconds}</span>s <button type='button' class='btn ghost' data-start-timer='${lesson.id}'>ابدأ</button><button type='button' class='btn ghost' data-next-after-timer='${lesson.id}' disabled>التالي</button></div></div>`;
}

function bindLessonEvents() {
  document.querySelectorAll(".lesson-card").forEach((card) => {
    const lesson = state.lessons.find((l) => l.id === card.dataset.lessonId);
    if (!lesson) return;

    card.querySelectorAll("[data-lesson-field]").forEach((input) => {
      input.addEventListener("input", () => {
        const key = input.dataset.lessonField;
        lesson[key] = key === "requiredWatchSeconds" ? Number(input.value || 0) : input.value;
        debouncedAutosave();
        renderLessons();
      });
    });

    card.querySelectorAll("[data-layout]").forEach((input) => input.addEventListener("input", () => {
      lesson.layout[input.dataset.layout] = Number(input.value || 1);
      debouncedAutosave();
      renderLessons();
    }));

    card.querySelectorAll("[data-add-step]").forEach((btn) => btn.addEventListener("click", () => addStep(lesson.id, btn.dataset.addStep)));

    card.querySelectorAll(".step-row").forEach((stepRow) => {
      const step = lesson.steps.find((s) => s.id === stepRow.dataset.stepId);
      if (!step) return;
      stepRow.querySelectorAll("[data-step-field]").forEach((field) => field.addEventListener("input", () => {
        step[field.dataset.stepField] = field.value;
        debouncedAutosave();
      }));
      stepRow.querySelector("[data-step-delete]")?.addEventListener("click", () => {
        lesson.steps = lesson.steps.filter((s) => s.id !== step.id);
        renderLessons();
        debouncedAutosave();
      });
      stepRow.querySelector("[data-step-file]")?.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 250 * 1024 * 1024) return setStatus("❌ الملف كبير جداً", true);
        try {
          const r = ref(storage, `courses/lesson-assets/${Date.now()}_${file.name}`);
          await uploadBytes(r, file);
          step.mediaUrl = await getDownloadURL(r);
        } catch {
          step.mediaUrl = URL.createObjectURL(file);
        }
        renderLessons();
        debouncedAutosave();
      });

      stepRow.querySelectorAll("[data-add-option]").forEach((btn) => btn.addEventListener("click", () => {
        const q = step.questions.find((x) => x.id === btn.dataset.addOption);
        q.options.push("");
        renderLessons();
      }));
      stepRow.querySelectorAll("[data-add-question]").forEach((btn) => btn.addEventListener("click", () => {
        step.questions.push({ id: uid(), question: "", options: ["", ""], correctIndexes: [] });
        renderLessons();
      }));
      stepRow.querySelectorAll("[data-q='question']").forEach((qEl) => qEl.addEventListener("input", () => {
        const q = step.questions.find((x) => x.id === qEl.closest("[data-qid]")?.dataset.qid);
        q.question = qEl.value;
        debouncedAutosave();
      }));
      stepRow.querySelectorAll("[data-opt]").forEach((oEl) => oEl.addEventListener("input", () => {
        const q = step.questions.find((x) => x.id === oEl.closest("[data-qid]")?.dataset.qid);
        q.options[Number(oEl.dataset.opt)] = oEl.value;
        debouncedAutosave();
      }));
      stepRow.querySelectorAll("[data-correct]").forEach((cEl) => cEl.addEventListener("change", () => {
        const q = step.questions.find((x) => x.id === cEl.closest("[data-qid]")?.dataset.qid);
        const idx = Number(cEl.dataset.correct);
        q.correctIndexes = cEl.checked ? [...new Set([...(q.correctIndexes || []), idx])] : q.correctIndexes.filter((x) => x !== idx);
        debouncedAutosave();
      }));
    });
  });

  document.querySelectorAll("[data-start-timer]").forEach((btn) => btn.addEventListener("click", () => {
    const lesson = state.lessons.find((l) => l.id === btn.dataset.startTimer);
    const label = document.getElementById(`timer-${lesson.id}`);
    const nextBtn = document.querySelector(`[data-next-after-timer='${lesson.id}']`);
    let left = Number(lesson.requiredWatchSeconds || 0);
    nextBtn.disabled = true;
    const i = setInterval(() => {
      left -= 1;
      label.textContent = String(Math.max(left, 0));
      if (left <= 0) {
        clearInterval(i);
        nextBtn.disabled = false;
      }
    }, 1000);
  }));
}

function renderFinalQuiz() {
  const root = document.getElementById("finalQuizBuilder");
  if (!root) return;
  root.innerHTML = state.finalQuiz.map((q) => `<div data-final-id='${q.id}'><input data-final='question' value='${esc(q.question)}' placeholder='سؤال نهائي'>${q.options.map((o, i) => `<div><input data-final-opt='${i}' value='${esc(o)}'><label><input type='checkbox' data-final-correct='${i}' ${q.correctIndexes.includes(i) ? "checked" : ""}> صحيح</label></div>`).join("")}<button type='button' class='btn ghost' data-final-del='${q.id}'>حذف</button></div>`).join("");
  root.querySelectorAll("[data-final='question'], [data-final-opt], [data-final-correct]").forEach((el) => el.addEventListener("input", saveFinalFromDom));
  root.querySelectorAll("[data-final-del]").forEach((btn) => btn.addEventListener("click", () => {
    state.finalQuiz = state.finalQuiz.filter((x) => x.id !== btn.dataset.finalDel);
    renderFinalQuiz();
  }));
}

function saveFinalFromDom() {
  document.querySelectorAll("[data-final-id]").forEach((row) => {
    const q = state.finalQuiz.find((x) => x.id === row.dataset.finalId);
    if (!q) return;
    q.question = row.querySelector("[data-final='question']")?.value || "";
    row.querySelectorAll("[data-final-opt]").forEach((o) => (q.options[Number(o.dataset.finalOpt)] = o.value));
    q.correctIndexes = [...row.querySelectorAll("[data-final-correct]:checked")].map((x) => Number(x.dataset.finalCorrect));
  });
  debouncedAutosave();
}

function renderPreview() {
  const firstLesson = state.lessons[0];
  const firstStep = firstLesson?.steps?.[0];
  document.getElementById("playerPreview").innerHTML = `
    <div class="course-public-hero">
      <div class="course-public-copy">
        <span class="course-tag">${state.category || "تصنيف الدورة"}</span>
        <h3>${state.title || "عنوان الدورة"}</h3>
        <p>${state.description || "وصف الدورة"}</p>
      </div>
      <img id="previewCover" src="${document.getElementById("coverPreview").src || "/assets/images/default-course.png"}" class="preview-cover" alt="cover preview">
    </div>
    <hr>
    <strong>${firstLesson?.title || "أضف Lesson لعرض المعاينة"}</strong>
    <p>${firstStep?.title || "أضف Step"}</p>
    <div>${firstStep?.content || ""}</div>
    <p>أسئلة الاختبار النهائي: ${state.finalQuiz.length}</p>`;

  const checkpoints = state.lessons.flatMap((l) => l.steps).filter((s) => s.type === "checkpointQuiz").length;
  document.getElementById("checkpointHint").textContent = `عدد checkpoints الحالية: ${checkpoints}`;
}

async function uploadCoverIfNeeded() {
  const file = document.getElementById("coverImage")?.files?.[0];
  if (!file) return state.image || "";
  const coverRef = ref(storage, `courses/covers/${Date.now()}_${file.name}`);
  await uploadBytes(coverRef, file);
  return getDownloadURL(coverRef);
}

async function saveDraft(showMessage = false) {
  const payload = getPayload("draft");
  localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify({ ...payload, updatedAt: new Date().toISOString() }));
  if (authUser?.uid) {
    await setDoc(doc(db, "adminCourseDrafts", authUser.uid), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
  }
  if (showMessage) setStatus("✅ تم حفظ المسودة");
}

async function restoreDraft() {
  const local = safeParse(localStorage.getItem(LOCAL_DRAFT_KEY));
  const remoteSnap = authUser?.uid ? await getDoc(doc(db, "adminCourseDrafts", authUser.uid)) : null;
  const remote = remoteSnap?.exists() ? remoteSnap.data() : null;
  state = pickLatestDraft(local, remote) || state;
  fillInfoFields();
  renderFinalQuiz();
}

function fillInfoFields() {
  ["title", "description", "image", "price", "level", "language", "durationHours"].forEach((key) => {
    const el = document.getElementById(key);
    if (el) el.value = state[key] ?? "";
  });
  if (document.getElementById("category") && state.category) document.getElementById("category").value = state.category;
  document.getElementById("coverPreview").src = state.image || "/assets/images/default-course.png";
}

async function submitCourse(event) {
  event.preventDefault();
  try {
    const uploadedImage = await uploadCoverIfNeeded();
    if (uploadedImage) state.image = uploadedImage;
    const payload = getPayload("published");
    await addDoc(collection(db, "courses"), payload);
    setStatus("✅ تم إنشاء الدورة بنجاح");
    localStorage.removeItem(LOCAL_DRAFT_KEY);
  } catch (error) {
    console.error(error);
    setStatus("❌ فشل إنشاء الدورة", true);
  }
}

function normalizeCheckpointQuestions(step) {
  if (!Array.isArray(step.questions)) return [];
  return step.questions.map((q) => ({ question: q.question || "", options: q.options || [], correctIndexes: q.correctIndexes || [] }));
}

function getPayload(status) {
  const lessons = state.lessons.map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    duration: lesson.duration,
    summary: lesson.summary,
    requiredWatchSeconds: Number(lesson.requiredWatchSeconds || 0),
    theme: lesson.theme,
    layout: lesson.layout,
    steps: lesson.steps.map((step) => ({
      id: step.id,
      type: step.type,
      title: step.title,
      content: step.content,
      mediaUrl: step.mediaUrl,
      questions: normalizeCheckpointQuestions(step)
    })),
    quiz: lesson.steps.filter((step) => step.type === "checkpointQuiz").flatMap((step) => normalizeCheckpointQuestions(step))
  }));

  return {
    title: state.title,
    description: state.description,
    category: state.category,
    price: Number(state.price || 0),
    level: state.level,
    language: state.language,
    durationHours: Number(state.durationHours || 0),
    duration: Number(state.durationHours || 0),
    image: state.image,
    status,
    lessons,
    finalQuiz: state.finalQuiz,
    modules: lessons.map((lesson) => ({ title: lesson.title })),
    assessmentQuestions: state.finalQuiz,
    levelsSupported: ["مبتدئ", "متوسط", "متقدم"],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}

function pickLatestDraft(local, remote) {
  const localDate = Date.parse(local?.updatedAt || 0);
  const remoteDate = remote?.updatedAt?.toDate ? remote.updatedAt.toDate().getTime() : Date.parse(remote?.updatedAt || 0);
  if (!local && !remote) return null;
  return localDate >= remoteDate ? local : remote;
}

function safeParse(raw) {
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

let autosaveTimer = null;
function debouncedAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => saveDraft(false), 400);
}

function setStatus(message, isError = false) {
  const el = document.getElementById("builderStatus");
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "#b91c1c" : "#166534";
}
