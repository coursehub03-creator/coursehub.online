import { auth, db, storage } from "/js/firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  setDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const steps = ["Basic Info", "Media", "Curriculum", "Pricing", "Landing", "Review"];
const lessonStepTypes = ["text", "video", "image", "file", "checkpointQuiz", "summary"];
const localKey = "coursehub_builder_v5";

let currentStep = 0;
let lessons = [];
let finalQuiz = [];
let categories = [];
let currentUser = null;
let uploadedCoverUrl = "";
let uploadedVideoUrl = "";

const val = (id) => document.getElementById(id)?.value || "";
const uid = () => crypto.randomUUID();
const esc = (v = "") => String(v).replace(/[&<>\"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

function stepDots() {
  const wrap = document.getElementById("builderSteps");
  if (!wrap) return;
  wrap.innerHTML = steps.map((s, i) => `<span class="step-dot ${i === currentStep ? "active" : ""}">${i + 1}. ${s}</span>`).join("");
  document.querySelectorAll(".wizard-panel").forEach((p, i) => {
    p.hidden = i !== currentStep;
  });
}

function makeLesson() {
  return {
    id: uid(),
    title: `Lesson ${lessons.length + 1}`,
    status: "draft",
    requiredWatchSeconds: 60,
    theme: "clean",
    layout: { textScale: 1, mediaScale: 1, x: 0, y: 0 },
    steps: [{ id: uid(), type: "text", title: "مقدمة", content: "", mediaUrl: "", options: [], correctIndexes: [] }]
  };
}

function makeQuizQuestion() {
  return { id: uid(), question: "", options: ["", ""], correctIndexes: [] };
}

function toast(msg) {
  const d = document.createElement("div");
  d.className = "ch-toast";
  d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 1800);
}

async function loadCategories() {
  const select = document.getElementById("category");
  if (!select) return;
  try {
    const snap = await getDocs(collection(db, "courseCategories"));
    categories = snap.docs.map((d) => String(d.data()?.name || "").trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, "ar"));
  } catch {
    categories = ["برمجة", "تصميم", "أعمال", "تسويق"];
  }
  const options = categories.length ? categories : ["عام"];
  select.innerHTML = options.map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join("");
}

async function uploadFile(file, type) {
  if (!currentUser || !file) return "";
  const path = `instructor-courses/${currentUser.uid}/${type}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

function validateLocalFile(file, expected) {
  if (!file) return "";
  if (!file.type.startsWith(expected)) return `نوع الملف ${file.name} غير مدعوم.`;
  const maxMb = expected === "video/" ? 250 : 20;
  if (file.size > maxMb * 1024 * 1024) return `حجم الملف ${file.name} أكبر من ${maxMb}MB.`;
  return "";
}

async function handleMediaPreview() {
  const coverFile = document.getElementById("coverFile")?.files?.[0];
  const videoFile = document.getElementById("previewVideoFile")?.files?.[0];

  if (coverFile) {
    const err = validateLocalFile(coverFile, "image/");
    if (err) return toast(err);
    document.getElementById("coverPreview").src = URL.createObjectURL(coverFile);
    try {
      uploadedCoverUrl = await uploadFile(coverFile, "images");
      document.getElementById("cover").value = uploadedCoverUrl;
    } catch {
      toast("تعذر رفع صورة الغلاف حالياً");
    }
  }

  if (videoFile) {
    const err = validateLocalFile(videoFile, "video/");
    if (err) return toast(err);
    document.getElementById("videoPreview").src = URL.createObjectURL(videoFile);
    try {
      uploadedVideoUrl = await uploadFile(videoFile, "videos");
      document.getElementById("previewVideo").value = uploadedVideoUrl;
    } catch {
      toast("تعذر رفع الفيديو حالياً");
    }
  }

  await saveDraft(false);
}

function renderLessonPreview(lesson) {
  const first = lesson.steps[0] || {};
  const styleMap = {
    clean: "background:#fff;color:#0f172a;",
    dark: "background:#0f172a;color:#f8fafc;",
    gradient: "background:linear-gradient(135deg,#dbeafe,#f5d0fe);color:#111827;"
  };

  return `
    <div class="lesson-live-preview" style="${styleMap[lesson.theme] || styleMap.clean}">
      <div class="lesson-preview-toolbar">
        <strong>${esc(lesson.title)}</strong>
        <span>العد التنازلي الإجباري: ${lesson.requiredWatchSeconds} ثانية</span>
      </div>
      <div class="lesson-preview-canvas" style="transform:translate(${lesson.layout.x}px, ${lesson.layout.y}px)">
        <h4 style="font-size:${1.1 * lesson.layout.textScale}rem">${esc(first.title || "عنوان الدرس")}</h4>
        <p style="font-size:${0.95 * lesson.layout.textScale}rem">${esc(first.content || "محتوى الدرس")}</p>
        ${first.mediaUrl ? `<div class="media-box" style="transform:scale(${lesson.layout.mediaScale})">معاينة وسائط مرفقة</div>` : ""}
      </div>
      <div class="timer-zone">
        <button type="button" class="ch-btn secondary" data-start-timer="${lesson.id}">ابدأ العداد</button>
        <span id="timer-${lesson.id}">${lesson.requiredWatchSeconds}</span>
        <button type="button" class="ch-btn" data-next-after-timer="${lesson.id}" disabled>التالي بعد الإكمال</button>
      </div>
    </div>`;
}

function renderLessons() {
  const root = document.getElementById("lessons");
  if (!root) return;

  root.innerHTML = lessons.map((lesson, i) => `
    <div class="lesson-card-pro" data-id="${lesson.id}">
      <div class="lesson-row">
        <input class="ch-input" data-lesson="title" data-i="${i}" value="${esc(lesson.title)}" placeholder="عنوان الدرس">
        <select class="ch-select" data-lesson="status" data-i="${i}">
          <option value="draft" ${lesson.status === "draft" ? "selected" : ""}>draft</option>
          <option value="published" ${lesson.status === "published" ? "selected" : ""}>published</option>
        </select>
        <input class="ch-input" type="number" min="10" data-lesson="requiredWatchSeconds" data-i="${i}" value="${lesson.requiredWatchSeconds}">
        <select class="ch-select" data-lesson="theme" data-i="${i}">
          <option value="clean" ${lesson.theme === "clean" ? "selected" : ""}>Clean</option>
          <option value="dark" ${lesson.theme === "dark" ? "selected" : ""}>Dark</option>
          <option value="gradient" ${lesson.theme === "gradient" ? "selected" : ""}>Gradient</option>
        </select>
        <button type="button" class="ch-btn secondary" data-del-lesson="${lesson.id}">حذف</button>
      </div>

      <div class="lesson-layout-controls">
        <label>تكبير النص <input type="range" min="0.7" max="1.8" step="0.1" data-layout="textScale" data-i="${i}" value="${lesson.layout.textScale}"></label>
        <label>تكبير الوسائط <input type="range" min="0.6" max="1.8" step="0.1" data-layout="mediaScale" data-i="${i}" value="${lesson.layout.mediaScale}"></label>
        <label>X <input type="range" min="-80" max="80" step="2" data-layout="x" data-i="${i}" value="${lesson.layout.x}"></label>
        <label>Y <input type="range" min="-80" max="80" step="2" data-layout="y" data-i="${i}" value="${lesson.layout.y}"></label>
      </div>

      <div class="step-actions-inline">
        ${lessonStepTypes.map((t) => `<button type="button" class="ch-btn secondary" data-add-step="${t}" data-id="${lesson.id}">+ ${t}</button>`).join("")}
      </div>

      <div class="steps-list">
        ${lesson.steps.map((step) => `
          <div class="step-row" data-step-id="${step.id}">
            <input class="ch-input" data-step="title" value="${esc(step.title)}" placeholder="عنوان الخطوة">
            <select class="ch-select" data-step="type">
              ${lessonStepTypes.map((t) => `<option value="${t}" ${step.type === t ? "selected" : ""}>${t}</option>`).join("")}
            </select>
            <textarea class="ch-textarea" data-step="content" placeholder="محتوى">${esc(step.content)}</textarea>
            <label class="file-label">ملف من الكمبيوتر
              <input type="file" data-step-file="1" accept="image/*,video/*,.pdf,.zip,.doc,.docx,.ppt,.pptx">
            </label>
            ${step.mediaUrl ? `<small>✅ ملف مرفوع</small>` : ""}
            ${step.type === "checkpointQuiz" ? renderCheckpointEditor(step) : ""}
            <button type="button" class="ch-btn secondary" data-del-step="${step.id}">حذف الخطوة</button>
          </div>
        `).join("")}
      </div>

      ${renderLessonPreview(lesson)}
    </div>
  `).join("");

  bindLessonActions();
}

function renderCheckpointEditor(step) {
  const questions = Array.isArray(step.questions) ? step.questions : [makeQuizQuestion()];
  step.questions = questions;
  return `
    <div class="checkpoint-block">
      <strong>Checkpoint Quiz</strong>
      ${questions.map((q) => `
        <div class="quiz-q" data-qid="${q.id}">
          <input class="ch-input" data-q="question" value="${esc(q.question)}" placeholder="نص السؤال">
          ${q.options.map((opt, idx) => `
            <div class="quiz-opt-row">
              <input class="ch-input" data-opt-index="${idx}" value="${esc(opt)}" placeholder="خيار ${idx + 1}">
              <label><input type="checkbox" data-correct-index="${idx}" ${q.correctIndexes.includes(idx) ? "checked" : ""}> صحيح</label>
            </div>
          `).join("")}
          <button type="button" class="ch-btn secondary" data-add-opt="${q.id}">+ خيار</button>
        </div>
      `).join("")}
      <button type="button" class="ch-btn secondary" data-add-q="${step.id}">+ سؤال</button>
    </div>
  `;
}

function bindLessonActions() {
  document.querySelectorAll("[data-lesson]").forEach((el) => {
    el.addEventListener("input", async () => {
      const i = Number(el.dataset.i);
      const k = el.dataset.lesson;
      lessons[i][k] = k === "requiredWatchSeconds" ? Number(el.value || 0) : el.value;
      renderLessons();
      await saveDraft(false);
    });
  });

  document.querySelectorAll("[data-layout]").forEach((el) => {
    el.addEventListener("input", async () => {
      const i = Number(el.dataset.i);
      const key = el.dataset.layout;
      lessons[i].layout[key] = Number(el.value || 0);
      renderLessons();
      await saveDraft(false);
    });
  });

  document.querySelectorAll("[data-del-lesson]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      lessons = lessons.filter((l) => l.id !== btn.dataset.delLesson);
      renderLessons();
      await saveDraft(false);
    });
  });

  document.querySelectorAll("[data-add-step]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const lesson = lessons.find((l) => l.id === btn.dataset.id);
      if (!lesson) return;
      const type = btn.dataset.addStep;
      lesson.steps.push({ id: uid(), type, title: `${type} step`, content: "", mediaUrl: "", options: [], correctIndexes: [], questions: type === "checkpointQuiz" ? [makeQuizQuestion()] : [] });
      renderLessons();
      await saveDraft(false);
    });
  });

  document.querySelectorAll(".step-row").forEach((row) => {
    const lesson = lessons.find((l) => l.steps.some((s) => s.id === row.dataset.stepId));
    const step = lesson?.steps.find((s) => s.id === row.dataset.stepId);
    if (!lesson || !step) return;

    row.querySelectorAll("[data-step]").forEach((el) => {
      el.addEventListener("input", async () => {
        step[el.dataset.step] = el.value;
        await saveDraft(false);
      });
    });

    row.querySelector("[data-del-step]")?.addEventListener("click", async () => {
      lesson.steps = lesson.steps.filter((s) => s.id !== step.id);
      renderLessons();
      await saveDraft(false);
    });

    row.querySelector("[data-step-file]")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 250 * 1024 * 1024) return toast("حجم الملف كبير جداً");
      const localType = file.type || "application/octet-stream";
      if (!["image/", "video/", "application/pdf"].some((x) => localType.startsWith(x)) && !/\.(zip|docx?|pptx?)$/i.test(file.name)) {
        return toast("صيغة الملف غير مدعومة");
      }
      try {
        step.mediaUrl = await uploadFile(file, "lesson-assets");
      } catch {
        step.mediaUrl = URL.createObjectURL(file);
      }
      renderLessons();
      await saveDraft(false);
    });

    row.querySelectorAll("[data-add-opt]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const q = step.questions.find((x) => x.id === btn.dataset.addOpt);
        q.options.push("");
        renderLessons();
        await saveDraft(false);
      });
    });

    row.querySelectorAll("[data-add-q]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        step.questions.push(makeQuizQuestion());
        renderLessons();
        await saveDraft(false);
      });
    });

    row.querySelectorAll("[data-q='question']").forEach((el) => {
      el.addEventListener("input", async () => {
        const q = step.questions.find((x) => x.id === el.closest("[data-qid]")?.dataset.qid);
        if (!q) return;
        q.question = el.value;
        await saveDraft(false);
      });
    });

    row.querySelectorAll("[data-opt-index]").forEach((el) => {
      el.addEventListener("input", async () => {
        const q = step.questions.find((x) => x.id === el.closest("[data-qid]")?.dataset.qid);
        if (!q) return;
        q.options[Number(el.dataset.optIndex)] = el.value;
        await saveDraft(false);
      });
    });

    row.querySelectorAll("[data-correct-index]").forEach((el) => {
      el.addEventListener("change", async () => {
        const q = step.questions.find((x) => x.id === el.closest("[data-qid]")?.dataset.qid);
        if (!q) return;
        const idx = Number(el.dataset.correctIndex);
        q.correctIndexes = el.checked ? [...new Set([...(q.correctIndexes || []), idx])] : (q.correctIndexes || []).filter((x) => x !== idx);
        await saveDraft(false);
      });
    });
  });

  document.querySelectorAll("[data-start-timer]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lesson = lessons.find((l) => l.id === btn.dataset.startTimer);
      if (!lesson) return;
      let left = Number(lesson.requiredWatchSeconds || 0);
      const label = document.getElementById(`timer-${lesson.id}`);
      const nextBtn = document.querySelector(`[data-next-after-timer='${lesson.id}']`);
      nextBtn.disabled = true;
      const interval = setInterval(() => {
        left -= 1;
        label.textContent = String(Math.max(left, 0));
        if (left <= 0) {
          clearInterval(interval);
          nextBtn.disabled = false;
        }
      }, 1000);
    });
  });
}

function renderFinalQuiz() {
  const root = document.getElementById("finalQuizBuilder");
  if (!root) return;
  root.innerHTML = finalQuiz.map((q) => `
    <div class="quiz-q" data-final-id="${q.id}">
      <input class="ch-input" data-final="question" value="${esc(q.question)}" placeholder="سؤال الاختبار النهائي">
      ${q.options.map((opt, idx) => `
        <div class="quiz-opt-row">
          <input class="ch-input" data-final-opt="${idx}" value="${esc(opt)}" placeholder="خيار ${idx + 1}">
          <label><input type="checkbox" data-final-correct="${idx}" ${q.correctIndexes.includes(idx) ? "checked" : ""}> صحيح</label>
        </div>
      `).join("")}
      <button type="button" class="ch-btn secondary" data-final-add-opt="${q.id}">+ خيار</button>
      <button type="button" class="ch-btn secondary" data-final-del="${q.id}">حذف السؤال</button>
    </div>
  `).join("");

  root.querySelectorAll("[data-final='question']").forEach((el) => el.addEventListener("input", saveFinalFromDom));
  root.querySelectorAll("[data-final-opt]").forEach((el) => el.addEventListener("input", saveFinalFromDom));
  root.querySelectorAll("[data-final-correct]").forEach((el) => el.addEventListener("change", saveFinalFromDom));
  root.querySelectorAll("[data-final-add-opt]").forEach((btn) => btn.addEventListener("click", () => {
    const q = finalQuiz.find((x) => x.id === btn.dataset.finalAddOpt);
    q.options.push("");
    renderFinalQuiz();
  }));
  root.querySelectorAll("[data-final-del]").forEach((btn) => btn.addEventListener("click", () => {
    finalQuiz = finalQuiz.filter((x) => x.id !== btn.dataset.finalDel);
    renderFinalQuiz();
  }));
}

function saveFinalFromDom() {
  document.querySelectorAll("[data-final-id]").forEach((row) => {
    const q = finalQuiz.find((x) => x.id === row.dataset.finalId);
    if (!q) return;
    q.question = row.querySelector("[data-final='question']")?.value || "";
    row.querySelectorAll("[data-final-opt]").forEach((optInput) => {
      q.options[Number(optInput.dataset.finalOpt)] = optInput.value;
    });
    q.correctIndexes = [...row.querySelectorAll("[data-final-correct]:checked")].map((x) => Number(x.dataset.finalCorrect));
  });
  saveDraft(false);
}

function collectState() {
  return {
    title: val("title"),
    subtitle: val("subtitle"),
    slug: val("slug"),
    category: val("category"),
    level: val("level"),
    language: val("language"),
    description: val("description"),
    cover: val("cover") || uploadedCoverUrl,
    previewVideo: val("previewVideo") || uploadedVideoUrl,
    price: Number(val("price") || 0),
    visibility: val("visibility"),
    headline: val("headline"),
    faq: val("faq"),
    lessons,
    finalQuiz,
    status: "draft"
  };
}

function completionScore(st) {
  const checks = [st.title, st.category, st.description, st.cover, st.lessons.length > 0, st.finalQuiz.length > 0, ["مبتدئ", "متوسط", "متقدم"].includes(st.level)];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function refreshSidebar() {
  const st = collectState();
  const score = completionScore(st);
  document.getElementById("completion").textContent = `${score}%`;
  document.getElementById("moduleCount").textContent = st.lessons.length;
  document.getElementById("publishedLessons").textContent = st.lessons.filter((l) => l.status === "published").length;
  document.getElementById("qualityScore").textContent = `Quality score: ${score}/100`;
  const missing = [];
  if (!st.title) missing.push("أضف عنوان الدورة");
  if (!st.cover) missing.push("أضف صورة الغلاف");
  if (!st.lessons.length) missing.push("أضف Lesson واحدة على الأقل");
  if (!st.finalQuiz.length) missing.push("أضف الاختبار النهائي");
  document.getElementById("missingChecklist").innerHTML = missing.map((m) => `<li>${m}</li>`).join("") || "<li>جاهز ✅</li>";
  document.getElementById("missing").textContent = missing.length ? `حقول ناقصة: ${missing.join("، ")}` : "كل شيء جاهز للإرسال.";
}

async function saveDraft(showToast = false) {
  const st = collectState();
  localStorage.setItem(localKey, JSON.stringify(st));
  document.getElementById("lastSaved").textContent = new Date().toLocaleTimeString("ar");
  if (currentUser) {
    await setDoc(doc(db, "instructorCourseDrafts", currentUser.uid), { ...st, instructorId: currentUser.uid, instructorEmail: currentUser.email || "", updatedAt: serverTimestamp() }, { merge: true });
  }
  if (showToast) toast("تم حفظ المسودة");
  refreshSidebar();
}

function restore() {
  const raw = localStorage.getItem(localKey);
  if (!raw) return;
  const st = JSON.parse(raw);
  Object.entries(st).forEach(([k, v]) => {
    const el = document.getElementById(k);
    if (el && typeof v !== "object") el.value = v;
  });
  lessons = Array.isArray(st.lessons) ? st.lessons : [];
  finalQuiz = Array.isArray(st.finalQuiz) ? st.finalQuiz : [];
  if (st.cover) document.getElementById("coverPreview").src = st.cover;
  if (st.previewVideo) document.getElementById("videoPreview").src = st.previewVideo;
}

async function loadFeedback() {
  if (!currentUser) return;
  const el = document.getElementById("submissionFeedback");
  const hint = document.getElementById("reviewStatusHint");
  try {
    const snap = await getDocs(query(collection(db, "instructorCourseSubmissions"), where("instructorId", "==", currentUser.uid), orderBy("createdAt", "desc"), limit(5)));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (!items.length) {
      el.textContent = "لا توجد مراجعات بعد.";
      return;
    }
    el.innerHTML = items.map((i) => `<div style="padding:6px 0;border-bottom:1px solid var(--color-border)"><strong>${esc(i.title || "-")}</strong> <span class="ch-badge ${i.status || "pending"}">${i.status || "pending"}</span></div>`).join("");
    hint.textContent = `آخر حالة: ${items[0].status || "pending"}`;
  } catch {
    el.textContent = "تعذر تحميل المراجعات حالياً.";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadCategories();
  restore();
  stepDots();
  renderLessons();
  renderFinalQuiz();
  refreshSidebar();

  auth.onAuthStateChanged((u) => {
    currentUser = u;
  });

  document.getElementById("coverFile")?.addEventListener("change", handleMediaPreview);
  document.getElementById("previewVideoFile")?.addEventListener("change", handleMediaPreview);

  document.getElementById("addLesson")?.addEventListener("click", async () => {
    lessons.push(makeLesson());
    renderLessons();
    await saveDraft(false);
  });

  document.getElementById("addFinalQuestion")?.addEventListener("click", async () => {
    finalQuiz.push(makeQuizQuestion());
    renderFinalQuiz();
    await saveDraft(false);
  });

  document.getElementById("nextStep")?.addEventListener("click", () => {
    currentStep = Math.min(steps.length - 1, currentStep + 1);
    stepDots();
    refreshSidebar();
    loadFeedback();
  });

  document.getElementById("prevStep")?.addEventListener("click", () => {
    currentStep = Math.max(0, currentStep - 1);
    stepDots();
  });

  document.getElementById("saveDraft")?.addEventListener("click", () => saveDraft(true));
  document.getElementById("builderForm")?.addEventListener("input", () => saveDraft(false));

  document.getElementById("builderForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const st = collectState();
    if (!currentUser) return toast("يرجى تسجيل الدخول");
    await addDoc(collection(db, "instructorCourseSubmissions"), {
      ...st,
      status: "pending",
      instructorId: currentUser.uid,
      instructorEmail: currentUser.email || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      assessmentQuestions: finalQuiz,
      levelsSupported: ["مبتدئ", "متوسط", "متقدم"]
    });
    document.getElementById("courseState").textContent = "in_review";
    toast("تم إرسال الدورة للمراجعة");
  });

  loadFeedback();
});
