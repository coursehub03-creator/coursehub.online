import { auth, db, storage } from "/js/firebase-config.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDownloadURL, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { renderSlideElements, normalizeSlideBackground, slideBackgroundStyle } from "/js/shared/slide-story-renderer.js";

const STEPS = [
  "معلومات أساسية",
  "الوسائط وصفحة الهبوط",
  "المنهج والوحدات",
  "محرر الشرائح",
  "الاختبارات ونقاط التحقق",
  "التسعير والوصول",
  "المراجعة والمعاينة",
  "الإرسال/النشر"
];

const WORKFLOW = [
  "draft",
  "submitted",
  "under_review",
  "changes_requested",
  "resubmitted",
  "approved",
  "rejected",
  "published",
  "archived"
];

const CONTENT_TYPES = ["text", "video", "image", "file", "summary", "checkpointQuiz", "slides"];
const QUIZ_MIN_OPTIONS = 2;
const QUIZ_DEFAULT_OPTIONS = 4;

const uid = () => crypto.randomUUID();
const esc = (v = "") =>
  String(v).replace(/[&<>\"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

const questionTemplate = () => ({
  id: uid(),
  question: "",
  explanation: "",
  options: Array.from({ length: QUIZ_DEFAULT_OPTIONS }, () => ""),
  correctIndexes: [0]
});

const slideElement = (type = "text") => ({
  id: uid(),
  type,
  x: 40,
  y: 40,
  w: type === "heading" ? 340 : type === "shape" ? 260 : 280,
  h: type === "shape" ? 140 : type === "image" || type === "video" ? 180 : 90,
  z: 1,
  text: type === "heading" ? "عنوان الشريحة" : type === "shape" ? "" : "نص",
  src: "",
  style: {
    background: type === "shape" ? "#dbeafe" : "#ffffff",
    color: "#0f172a",
    radius: 10,
    align: "right",
    fontSize: type === "heading" ? 34 : 22,
    fontWeight: type === "heading" ? 700 : 500
  }
});

const slideTemplate = (i = 1) => ({
  id: uid(),
  title: `شريحة ${i}`,
  background: { type: "color", color: "#f8fafc", image: "" },
  elements: [slideElement("heading")]
});

const lessonTemplate = (i = 1) => ({
  id: uid(),
  title: `درس ${i}`,
  summary: "",
  durationMinutes: 10,
  allowPreview: false,
  status: "draft",
  contentType: "text",
  content: "",
  attachments: [],
  slides: [slideTemplate(1)],
  checkpointQuiz: {
    title: "اختبار نقطة تحقق",
    passingScore: 70,
    timeLimitMinutes: 10,
    questions: [questionTemplate()]
  }
});

const moduleTemplate = (i = 1) => ({
  id: uid(),
  title: `وحدة ${i}`,
  lessons: [lessonTemplate(1)]
});

const courseTemplate = () => ({
  id: "",
  title: "",
  subtitle: "",
  slug: "",
  category: "",
  description: "",
  outcomes: "",
  requirements: "",
  cover: "",
  promoVideo: "",
  level: "مبتدئ",
  language: "العربية",
  modules: [moduleTemplate(1)],
  finalQuiz: {
    title: "الاختبار النهائي",
    passingScore: 70,
    timeLimitMinutes: 20,
    questions: [questionTemplate()]
  },
  pricing: { suggestedPrice: 0, finalPrice: 0, accessModel: "paid" },
  status: "draft",
  reviewNotes: []
});

function normalizeQuestionShape(rawQuestion) {
  const options = Array.isArray(rawQuestion?.options) ? rawQuestion.options.map((opt) => String(opt ?? "")) : [];
  while (options.length < QUIZ_DEFAULT_OPTIONS) options.push("");
  const normalized = {
    id: rawQuestion?.id || uid(),
    question: String(rawQuestion?.question || ""),
    explanation: String(rawQuestion?.explanation || ""),
    options,
    correctIndexes: []
  };

  const rawCorrect = Array.isArray(rawQuestion?.correctIndexes)
    ? rawQuestion.correctIndexes
    : rawQuestion?.correct !== undefined
      ? [Number(rawQuestion.correct)]
      : [];

  normalized.correctIndexes = [...new Set(rawCorrect.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 0 && n < options.length))]
    .slice(0, 1);

  if (!normalized.correctIndexes.length && options.length) normalized.correctIndexes = [0];
  return normalized;
}

function normalizeQuizShape(rawQuiz, fallbackTitle = "اختبار") {
  const questions = Array.isArray(rawQuiz?.questions) ? rawQuiz.questions.map((q) => normalizeQuestionShape(q)) : [questionTemplate()];
  return {
    title: String(rawQuiz?.title || fallbackTitle),
    passingScore: Math.min(100, Math.max(1, Number(rawQuiz?.passingScore || 70))),
    timeLimitMinutes: Math.max(1, Number(rawQuiz?.timeLimitMinutes || 10)),
    questions: questions.length ? questions : [questionTemplate()]
  };
}

const statusLabel = (s = "draft") =>
  ({
    draft: "مسودة",
    submitted: "تم الإرسال",
    under_review: "تحت المراجعة",
    changes_requested: "مطلوب تعديلات",
    resubmitted: "أُعيد الإرسال",
    approved: "معتمد",
    rejected: "مرفوض",
    published: "منشور",
    archived: "مؤرشف"
  }[s] || s);

export function createCourseBuilder({ role = "instructor", selectors = {} }) {
  const opts = {
    localDraftKey: selectors.localDraftKey || `coursehub_${role}_builder_draft_v8`,
    draftCollection: selectors.draftCollection || (role === "admin" ? "adminCourseDrafts" : "instructorCourseDrafts")
  };

  const state = {
    step: 0,
    user: null,
    categories: [],
    course: courseTemplate(),
    activeModuleId: "",
    activeLessonId: "",
    activeSlideId: "",
    selectedElementId: "",
    autosaveTimer: null,
    loading: false,
    mounted: false
  };

  const q = (sel) => document.querySelector(sel);

  const setLoading = (v) => {
    state.loading = v;
    const overlay = q("#builderLoading");
    if (overlay) overlay.hidden = !v;
  };

  const activeLesson = () => {
    const mod = state.course.modules.find((m) => m.id === state.activeModuleId) || state.course.modules[0];
    return mod?.lessons.find((l) => l.id === state.activeLessonId) || mod?.lessons?.[0] || null;
  };

  const activeSlide = () => {
    const lesson = activeLesson();
    return lesson?.slides.find((s) => s.id === state.activeSlideId) || lesson?.slides?.[0] || null;
  };

  async function loadCategories() {
    try {
      const snap = await getDocs(collection(db, "courseCategories"));
      state.categories = snap.docs.map((d) => String(d.data()?.name || "").trim()).filter(Boolean);
    } catch {
      state.categories = ["عام", "برمجة", "تصميم", "أعمال", "تسويق"];
    }
    q("#category").innerHTML = state.categories
      .map((n) => `<option value="${esc(n)}">${esc(n)}</option>`)
      .join("");
  }

  function applyCourseToForm() {
    [
      "title",
      "subtitle",
      "slug",
      "category",
      "description",
      "outcomes",
      "requirements",
      "cover",
      "promoVideo",
      "level",
      "language"
    ].forEach((k) => {
      const el = q(`#${k}`);
      if (el) el.value = state.course[k] || "";
    });

    q("#suggestedPrice").value = Number(state.course.pricing?.suggestedPrice || 0);
    q("#finalPrice").value = Number(state.course.pricing?.finalPrice || 0);
    q("#accessModel").value = state.course.pricing?.accessModel || "paid";
  }

  function setStatus(msg, err = false) {
    const el = q("#builderStatus");
    if (!el) return;
    el.textContent = msg;
    el.style.color = err ? "#b91c1c" : "#166534";
  }

  function setStep(next) {
    state.step = Math.max(0, Math.min(STEPS.length - 1, next));
    q("#stepBar").innerHTML = STEPS
      .map((s, i) => `<button type="button" class="step-pill ${i === state.step ? "active" : ""}">${i + 1}. ${s}</button>`)
      .join("");
    document.querySelectorAll(".builder-step-panel").forEach((panel, i) => (panel.hidden = i !== state.step));
    q("#nextStep").style.display = state.step === STEPS.length - 1 ? "none" : "inline-flex";
    q("#submitActions").hidden = state.step !== STEPS.length - 1;
  }

  function autosave() {
    clearTimeout(state.autosaveTimer);
    state.autosaveTimer = setTimeout(() => saveDraft(false).catch(() => {}), 500);
  }

  function updateStatusMeta() {
    const status = state.course.status || "draft";
    q("#courseStatusPill").textContent = statusLabel(status);
    q("#courseStatusPill").className = `ch-badge ${status}`;
    q("#submitForReview").hidden = role !== "instructor";
    q("#publishDirect").hidden = role !== "admin";
    q("#submitForReview").textContent = status === "changes_requested" ? "إعادة الإرسال بعد التعديل" : "إرسال للمراجعة";
  }

  function bindGeneralInputs() {
    q("#builderForm").addEventListener("input", (e) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.matches("[data-bind]")) {
        state.course[target.dataset.bind] = target.type === "number" ? Number(target.value || 0) : target.value;
      }
      autosave();
      renderPreview();
    });

    q("#suggestedPrice").oninput = (e) => {
      state.course.pricing.suggestedPrice = Number(e.target.value || 0);
      if (role !== "admin") {
        state.course.pricing.finalPrice = state.course.pricing.suggestedPrice;
        q("#finalPrice").value = state.course.pricing.finalPrice;
      }
      autosave();
      renderPreview();
    };

    q("#finalPrice").oninput = (e) => {
      if (role !== "admin") return;
      state.course.pricing.finalPrice = Number(e.target.value || 0);
      autosave();
      renderPreview();
    };

    q("#accessModel").onchange = (e) => {
      state.course.pricing.accessModel = e.target.value;
      autosave();
      renderPreview();
    };

    q("#coverFile")?.addEventListener("change", () => uploadMedia("#coverFile", "covers", "cover"));
    q("#promoFile")?.addEventListener("change", () => uploadMedia("#promoFile", "promo", "promoVideo"));
  }

  async function uploadMedia(inputSelector, folder, key) {
    const file = q(inputSelector)?.files?.[0];
    if (!file) return;

    state.course[key] = URL.createObjectURL(file);
    q(`#${key}`).value = state.course[key];
    renderPreview();

    if (!state.user?.uid) return;

    try {
      const storageRef = ref(storage, `${role}-courses/${state.user.uid}/${folder}/${Date.now()}-${file.name}`);
      await uploadBytes(storageRef, file);
      state.course[key] = await getDownloadURL(storageRef);
      q(`#${key}`).value = state.course[key];
      setStatus("✅ تم رفع الملف بنجاح");
      autosave();
      renderPreview();
    } catch {
      setStatus("⚠️ تعذر رفع الملف الآن، تم حفظ معاينة محلية فقط.", true);
    }
  }

  function renderModules() {
    const root = q("#moduleLessonTree");

    if (!state.course.modules.length) {
      root.innerHTML = `<div class="empty-box">لا توجد وحدات بعد. ابدأ بإضافة وحدة جديدة.</div>`;
      return;
    }

    root.innerHTML = state.course.modules
      .map(
        (mod) => `
      <article class="module-card">
        <div class="module-head">
          <input class="ch-input" data-module-title="${mod.id}" value="${esc(mod.title)}">
          <div class="inline-actions">
            <button type="button" class="ch-btn secondary" data-add-lesson="${mod.id}">+ درس</button>
            <button type="button" class="ch-btn secondary" data-del-module="${mod.id}">حذف</button>
          </div>
        </div>
        <div class="lesson-list">
          ${mod.lessons
            .map(
              (l) =>
                `<button type="button" class="lesson-chip ${l.id === state.activeLessonId ? "active" : ""}" data-open-lesson="${l.id}" data-module-id="${mod.id}"><span>${esc(l.title)}</span><span class="lesson-state">${statusLabel(l.status)}</span></button>`
            )
            .join("")}
        </div>
      </article>
    `
      )
      .join("");

    root.querySelectorAll("[data-module-title]").forEach((el) =>
      el.addEventListener("input", () => {
        const mod = state.course.modules.find((m) => m.id === el.dataset.moduleTitle);
        if (mod) mod.title = el.value;
        autosave();
        renderPreview();
      })
    );

    root.querySelectorAll("[data-add-lesson]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const mod = state.course.modules.find((m) => m.id === btn.dataset.addLesson);
        mod.lessons.push(lessonTemplate(mod.lessons.length + 1));
        state.activeModuleId = mod.id;
        state.activeLessonId = mod.lessons.at(-1).id;
        renderAll();
        autosave();
      })
    );

    root.querySelectorAll("[data-open-lesson]").forEach((btn) =>
      btn.addEventListener("click", () => {
        state.activeModuleId = btn.dataset.moduleId;
        state.activeLessonId = btn.dataset.openLesson;
        renderAll();
      })
    );

    root.querySelectorAll("[data-del-module]").forEach((btn) =>
      btn.addEventListener("click", () => {
        state.course.modules = state.course.modules.filter((m) => m.id !== btn.dataset.delModule);
        if (!state.course.modules.length) state.course.modules.push(moduleTemplate(1));
        state.activeModuleId = state.course.modules[0].id;
        state.activeLessonId = state.course.modules[0].lessons[0].id;
        renderAll();
        autosave();
      })
    );
  }

  function renderLessonSettings() {
    const lesson = activeLesson();
    const root = q("#lessonSettings");

    if (!lesson) {
      root.innerHTML = `<div class="empty-box">اختر درساً من القائمة لإدارة إعداداته.</div>`;
      return;
    }

    root.innerHTML = `
      <div class="lesson-settings-grid">
        <label>عنوان الدرس<input id="lessonTitle" class="ch-input" value="${esc(lesson.title)}"></label>
        <label>المدة (دقيقة)<input id="lessonDuration" type="number" class="ch-input" min="1" value="${lesson.durationMinutes}"></label>
        <label>الحالة<select id="lessonStatus" class="ch-select">${WORKFLOW.map(
          (s) => `<option value="${s}" ${lesson.status === s ? "selected" : ""}>${statusLabel(s)}</option>`
        ).join("")}</select></label>
        <label>نوع المحتوى<select id="lessonContentType" class="ch-select">${CONTENT_TYPES.map(
          (t) => `<option value="${t}" ${lesson.contentType === t ? "selected" : ""}>${t}</option>`
        ).join("")}</select></label>
      </div>
      <label>ملخص الدرس<textarea id="lessonSummary" class="ch-textarea">${esc(lesson.summary)}</textarea></label>
      <label>محتوى الدرس / رابط وسيط<textarea id="lessonContent" class="ch-textarea">${esc(lesson.content || "")}</textarea></label>
      <label class="switch-row"><input id="lessonPreviewToggle" type="checkbox" ${lesson.allowPreview ? "checked" : ""}> متاح كدرس تجريبي</label>
      <div class="inline-actions">
        <button type="button" class="ch-btn secondary" id="duplicateLesson">نسخ الدرس</button>
        <button type="button" class="ch-btn secondary" id="deleteLesson">حذف</button>
      </div>
    `;

    q("#lessonTitle").oninput = (e) => {
      lesson.title = e.target.value;
      renderModules();
      renderPreview();
      autosave();
    };
    q("#lessonDuration").oninput = (e) => {
      lesson.durationMinutes = Number(e.target.value || 1);
      renderPreview();
      autosave();
    };
    q("#lessonStatus").onchange = (e) => {
      lesson.status = e.target.value;
      renderModules();
      autosave();
    };
    q("#lessonContentType").onchange = (e) => {
      lesson.contentType = e.target.value;
      autosave();
    };
    q("#lessonSummary").oninput = (e) => {
      lesson.summary = e.target.value;
      renderPreview();
      autosave();
    };
    q("#lessonContent").oninput = (e) => {
      lesson.content = e.target.value;
      autosave();
    };
    q("#lessonPreviewToggle").onchange = (e) => {
      lesson.allowPreview = e.target.checked;
      renderPreview();
      autosave();
    };
    q("#duplicateLesson").onclick = () => {
      const mod = state.course.modules.find((m) => m.id === state.activeModuleId);
      const clone = structuredClone(lesson);
      clone.id = uid();
      clone.title += " (نسخة)";
      mod.lessons.push(clone);
      state.activeLessonId = clone.id;
      renderAll();
      autosave();
    };
    q("#deleteLesson").onclick = () => {
      const mod = state.course.modules.find((m) => m.id === state.activeModuleId);
      mod.lessons = mod.lessons.filter((l) => l.id !== lesson.id);
      if (!mod.lessons.length) mod.lessons.push(lessonTemplate(1));
      state.activeLessonId = mod.lessons[0].id;
      renderAll();
      autosave();
    };
  }

  function getSlideById(lesson, slideId) {
    return lesson?.slides?.find((item) => item.id === slideId) || null;
  }

  function renderSlides() {
    const lesson = activeLesson();
    const slideList = q("#slideList");
    const canvas = q("#slideCanvas");

    if (!lesson) {
      slideList.innerHTML = "";
      canvas.innerHTML = "";
      return;
    }

    if (!lesson.slides.length) lesson.slides = [slideTemplate(1)];
    if (!state.activeSlideId || !getSlideById(lesson, state.activeSlideId)) state.activeSlideId = lesson.slides[0].id;

    slideList.innerHTML = lesson.slides
      .map((slide, i) => {
        const thumb = renderSlideElements(slide, { scale: 0.18 });
        return `
          <article class="slide-thumb ${slide.id === state.activeSlideId ? "active" : ""}" data-slide-card="${slide.id}">
            <button class="slide-thumb-main" type="button" data-open-slide="${slide.id}">
              <div class="slide-thumb-canvas" style="${slideBackgroundStyle(slide.background)}">${thumb || `<span class="slide-thumb-empty">شريحة فارغة</span>`}</div>
              <div class="slide-thumb-title">${i + 1}. ${esc(slide.title || `شريحة ${i + 1}`)}</div>
            </button>
            <div class="slide-thumb-actions">
              <button type="button" class="ch-btn tiny secondary" data-duplicate-slide="${slide.id}">نسخ</button>
              <button type="button" class="ch-btn tiny secondary" data-delete-slide="${slide.id}">حذف</button>
            </div>
          </article>
        `;
      })
      .join("");

    const slide = activeSlide();
    if (!slide) return;

    slide.background = normalizeSlideBackground(slide.background);
    q("#slideTitle").value = slide.title || "";
    q("#slideBackground").value = slide.background.color || "#f8fafc";
    q("#slideBackgroundImage").value = slide.background.image || "";

    canvas.style.cssText = slideBackgroundStyle(slide.background);
    canvas.innerHTML =
      renderSlideElements(slide, {
        editable: true,
        selectedElementId: state.selectedElementId,
        withResizeHandle: true,
        withMediaInput: true
      }) || `<div class="empty-box">لا توجد عناصر بعد. أضف نصاً أو وسائط.</div>`;

    slideList.querySelectorAll("[data-open-slide]").forEach((btn) =>
      btn.addEventListener("click", () => {
        state.activeSlideId = btn.dataset.openSlide;
        state.selectedElementId = "";
        renderSlides();
        renderPreview();
      })
    );

    slideList.querySelectorAll("[data-duplicate-slide]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const source = getSlideById(lesson, btn.dataset.duplicateSlide);
        if (!source) return;
        const clone = structuredClone(source);
        clone.id = uid();
        clone.title = `${source.title || "شريحة"} (نسخة)`;
        clone.elements = (clone.elements || []).map((el) => ({ ...el, id: uid(), x: (el.x || 0) + 16, y: (el.y || 0) + 16 }));
        lesson.slides.push(clone);
        state.activeSlideId = clone.id;
        renderSlides();
        autosave();
        renderPreview();
      })
    );

    slideList.querySelectorAll("[data-delete-slide]").forEach((btn) =>
      btn.addEventListener("click", () => {
        if (lesson.slides.length <= 1) return;
        lesson.slides = lesson.slides.filter((s) => s.id !== btn.dataset.deleteSlide);
        if (!lesson.slides.find((s) => s.id === state.activeSlideId)) state.activeSlideId = lesson.slides[0].id;
        state.selectedElementId = "";
        renderSlides();
        autosave();
        renderPreview();
      })
    );

    q("#slideTitle").oninput = (e) => {
      slide.title = e.target.value;
      renderSlides();
      autosave();
      renderPreview();
    };

    q("#addSlide").onclick = () => {
      lesson.slides.push(slideTemplate(lesson.slides.length + 1));
      state.activeSlideId = lesson.slides.at(-1).id;
      state.selectedElementId = "";
      renderSlides();
      autosave();
      renderPreview();
    };

    q("#duplicateSlide").onclick = () => {
      const source = activeSlide();
      if (!source) return;
      const clone = structuredClone(source);
      clone.id = uid();
      clone.title = `${source.title || "شريحة"} (نسخة)`;
      clone.elements = (clone.elements || []).map((el) => ({ ...el, id: uid(), x: (el.x || 0) + 16, y: (el.y || 0) + 16 }));
      lesson.slides.push(clone);
      state.activeSlideId = clone.id;
      state.selectedElementId = "";
      renderSlides();
      autosave();
      renderPreview();
    };

    q("#deleteSlide").onclick = () => {
      lesson.slides = lesson.slides.filter((s) => s.id !== state.activeSlideId);
      if (!lesson.slides.length) lesson.slides.push(slideTemplate(1));
      state.activeSlideId = lesson.slides[0].id;
      state.selectedElementId = "";
      renderSlides();
      autosave();
      renderPreview();
    };

    q("#slideBackground").oninput = (e) => {
      const s = activeSlide();
      s.background = normalizeSlideBackground(s.background);
      s.background.color = e.target.value;
      renderSlides();
      autosave();
      renderPreview();
    };

    q("#slideBackgroundImage").oninput = (e) => {
      const s = activeSlide();
      s.background = normalizeSlideBackground(s.background);
      s.background.image = e.target.value.trim();
      s.background.type = s.background.image ? "image" : "color";
      renderSlides();
      autosave();
      renderPreview();
    };

    bindSlideTools();
    bindCanvasInteractions();
    renderElementInspector();
  }

  function renderElementInspector() {
    const panel = q("#slideElementInspector");
    if (!panel) return;

    const slide = activeSlide();
    const el = slide?.elements.find((item) => item.id === state.selectedElementId);
    if (!el) {
      panel.innerHTML = `<div class="empty-box">حدد عنصراً داخل اللوحة لتعديل خصائصه.</div>`;
      return;
    }

    el.style = {
      background: "#dbeafe",
      color: "#0f172a",
      radius: 10,
      align: "right",
      fontSize: el.type === "heading" ? 34 : 22,
      fontWeight: el.type === "heading" ? 700 : 500,
      ...(el.style || {})
    };

    panel.innerHTML = `
      <div class="element-inspector-grid">
        <label>نوع العنصر<input class="ch-input" value="${esc(el.type)}" disabled></label>
        <label>X<input class="ch-input" type="number" data-el-prop="x" value="${Math.round(el.x || 0)}"></label>
        <label>Y<input class="ch-input" type="number" data-el-prop="y" value="${Math.round(el.y || 0)}"></label>
        <label>العرض<input class="ch-input" type="number" data-el-prop="w" value="${Math.round(el.w || 120)}"></label>
        <label>الارتفاع<input class="ch-input" type="number" data-el-prop="h" value="${Math.round(el.h || 60)}"></label>
        <label>الطبقة Z<input class="ch-input" type="number" min="1" data-el-prop="z" value="${Math.round(el.z || 1)}"></label>
        ${el.type !== "image" && el.type !== "video" ? `<label class="full">النص<textarea class="ch-textarea" rows="3" data-el-prop="text">${esc(el.text || "")}</textarea></label>` : ""}
        ${(el.type === "image" || el.type === "video") ? `<label class="full">رابط الوسائط<input class="ch-input" data-el-prop="src" value="${esc(el.src || "")}" placeholder="https://..."></label>` : ""}
        <label>لون النص<input class="ch-input" type="color" data-el-style="color" value="${esc(el.style.color || "#0f172a")}"></label>
        <label>لون الخلفية<input class="ch-input" type="color" data-el-style="background" value="${esc(el.style.background || "#dbeafe")}"></label>
        <label>حجم الخط<input class="ch-input" type="number" min="12" max="80" data-el-style="fontSize" value="${Number(el.style.fontSize || 22)}"></label>
        <label>وزن الخط<input class="ch-input" type="number" min="300" max="900" step="100" data-el-style="fontWeight" value="${Number(el.style.fontWeight || 500)}"></label>
      </div>
    `;

    panel.querySelectorAll("[data-el-prop]").forEach((input) =>
      input.addEventListener("input", () => {
        const key = input.dataset.elProp;
        el[key] = ["x", "y", "w", "h", "z"].includes(key) ? Number(input.value || 0) : input.value;
        renderSlides();
        autosave();
        renderPreview();
      })
    );

    panel.querySelectorAll("[data-el-style]").forEach((input) =>
      input.addEventListener("input", () => {
        el.style[input.dataset.elStyle] = input.type === "number" ? Number(input.value || 0) : input.value;
        renderSlides();
        autosave();
        renderPreview();
      })
    );
  }

  function bindSlideTools() {
    const bind = (id, type) => (q(id).onclick = () => addElement(type));
    bind("#addTextElement", "text");
    bind("#addHeadingElement", "heading");
    bind("#addImageElement", "image");
    bind("#addVideoElement", "video");
    bind("#addShapeElement", "shape");
    q("#duplicateElement").onclick = duplicateElement;
    q("#deleteElement").onclick = deleteElement;
    q("#bringFront").onclick = () => moveLayer(1);
    q("#sendBack").onclick = () => moveLayer(-1);
  }

  function addElement(type) {
    const slide = activeSlide();
    if (!slide) return;
    const el = slideElement(type);
    el.z = slide.elements.length + 1;
    slide.elements.push(el);
    state.selectedElementId = el.id;
    renderSlides();
    autosave();
    renderPreview();
  }

  function duplicateElement() {
    const slide = activeSlide();
    const source = slide?.elements.find((e) => e.id === state.selectedElementId);
    if (!source) return;
    const cloned = structuredClone(source);
    cloned.id = uid();
    cloned.x += 20;
    cloned.y += 20;
    cloned.z = slide.elements.length + 1;
    slide.elements.push(cloned);
    state.selectedElementId = cloned.id;
    renderSlides();
    autosave();
    renderPreview();
  }

  function deleteElement() {
    const slide = activeSlide();
    if (!slide) return;
    slide.elements = slide.elements.filter((e) => e.id !== state.selectedElementId);
    state.selectedElementId = "";
    renderSlides();
    autosave();
    renderPreview();
  }

  function moveLayer(delta) {
    const slide = activeSlide();
    const target = slide?.elements.find((e) => e.id === state.selectedElementId);
    if (!target) return;
    target.z = Math.max(1, target.z + delta);
    renderSlides();
    autosave();
    renderPreview();
  }

  function bindCanvasInteractions() {
    const slide = activeSlide();
    if (!slide) return;

    q("#slideCanvas").querySelectorAll(".canvas-element").forEach((node) => {
      const elementId = node.dataset.elId;
      node.addEventListener("pointerdown", (e) => startDrag(e, elementId));
      node.querySelector("[data-resize]")?.addEventListener("pointerdown", (e) => startResize(e, elementId));
      node.querySelector("[data-el-text]")?.addEventListener("input", (e) => {
        const el = slide.elements.find((x) => x.id === elementId);
        if (!el) return;
        el.text = e.target.textContent;
        autosave();
        renderPreview();
      });
      node.querySelector("[data-el-src]")?.addEventListener("input", (e) => {
        const el = slide.elements.find((x) => x.id === elementId);
        if (!el) return;
        el.src = e.target.value;
        autosave();
        renderPreview();
      });
    });
  }

  function startDrag(event, elementId) {
    if (event.target.classList.contains("resize-handle")) return;
    if (event.target.closest("input,textarea,iframe,video") || event.target.isContentEditable) return;
    const el = activeSlide()?.elements.find((x) => x.id === elementId);
    if (!el) return;

    state.selectedElementId = elementId;
    renderSlides();

    const sx = event.clientX;
    const sy = event.clientY;
    const ox = el.x;
    const oy = el.y;

    const onMove = (m) => {
      el.x = Math.max(0, ox + (m.clientX - sx));
      el.y = Math.max(0, oy + (m.clientY - sy));
      const node = q(`#slideCanvas [data-el-id='${elementId}']`);
      if (node) {
        node.style.left = `${el.x}px`;
        node.style.top = `${el.y}px`;
      }
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      autosave();
      renderPreview();
      renderElementInspector();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function startResize(event, elementId) {
    event.stopPropagation();
    const el = activeSlide()?.elements.find((x) => x.id === elementId);
    if (!el) return;

    const sx = event.clientX;
    const sy = event.clientY;
    const ow = el.w;
    const oh = el.h;

    const onMove = (m) => {
      el.w = Math.max(80, ow + (m.clientX - sx));
      el.h = Math.max(40, oh + (m.clientY - sy));
      const node = q(`#slideCanvas [data-el-id='${elementId}']`);
      if (node) {
        node.style.width = `${el.w}px`;
        node.style.height = `${el.h}px`;
      }
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      autosave();
      renderPreview();
      renderElementInspector();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function quizEditor(quiz, key) {
    return `
      <div class="quiz-card">
        <div class="lesson-settings-grid">
          <label>عنوان الاختبار<input class="ch-input" data-quiz-meta="${key}" data-field="title" value="${esc(quiz.title || "")}"></label>
          <label>درجة النجاح<input class="ch-input" type="number" min="1" max="100" data-quiz-meta="${key}" data-field="passingScore" value="${Number(quiz.passingScore || 70)}"></label>
          <label>الوقت (دقيقة)<input class="ch-input" type="number" min="1" data-quiz-meta="${key}" data-field="timeLimitMinutes" value="${Number(quiz.timeLimitMinutes || 10)}"></label>
        </div>
        ${quiz.questions
          .map(
            (qz, i) => `
          <article class="quiz-question" data-quiz-key="${key}" data-q-id="${qz.id}">
            <h4>سؤال ${i + 1}</h4>
            <input class="ch-input" data-q-field="question" value="${esc(qz.question)}" placeholder="نص السؤال">
            <textarea class="ch-textarea" data-q-field="explanation" placeholder="توضيح الإجابة">${esc(qz.explanation || "")}</textarea>
            ${qz.options
              .map(
                (opt, oi) => `
                  <div class="quiz-option-row">
                    <input class="ch-input" data-opt-index="${oi}" value="${esc(opt)}" placeholder="الخيار ${oi + 1}">
                    <div class="inline-actions">
                      <label><input type="radio" name="correct-${esc(key)}-${esc(qz.id)}" data-correct-index="${oi}" ${qz.correctIndexes.includes(oi) ? "checked" : ""}> الصحيح</label>
                      <button type="button" class="ch-btn secondary" data-del-option="${key}:${qz.id}:${oi}" ${qz.options.length <= QUIZ_MIN_OPTIONS ? "disabled" : ""}>حذف</button>
                    </div>
                  </div>`
              )
              .join("")}
            <div class="inline-actions">
              <button type="button" class="ch-btn secondary" data-add-option="${key}:${qz.id}">+ خيار</button>
              <button type="button" class="ch-btn secondary" data-del-question="${key}:${qz.id}">حذف السؤال</button>
            </div>
          </article>
        `
          )
          .join("")}
        <button type="button" class="ch-btn secondary" data-add-question="${key}">+ إضافة سؤال</button>
      </div>
    `;
  }

  function resolveQuiz(key) {
    if (key === "final") return state.course.finalQuiz;
    return activeLesson()?.checkpointQuiz || lessonTemplate(1).checkpointQuiz;
  }

  function renderQuizzes() {
    const lesson = activeLesson();
    q("#lessonQuizEditor").innerHTML = lesson
      ? quizEditor(lesson.checkpointQuiz, "lesson")
      : `<div class="empty-box">اختر درساً أولاً.</div>`;
    q("#finalQuizEditor").innerHTML = quizEditor(state.course.finalQuiz, "final");

    document.querySelectorAll("[data-quiz-meta]").forEach((el) =>
      el.addEventListener("input", () => {
        const quiz = resolveQuiz(el.dataset.quizMeta);
        quiz[el.dataset.field] = el.type === "number" ? Number(el.value || 0) : el.value;
        autosave();
      })
    );

    document.querySelectorAll("[data-add-question]").forEach((btn) =>
      btn.addEventListener("click", () => {
        resolveQuiz(btn.dataset.addQuestion).questions.push(questionTemplate());
        renderQuizzes();
        autosave();
      })
    );

    document.querySelectorAll("[data-add-option]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const [key, qId] = btn.dataset.addOption.split(":");
        const qz = resolveQuiz(key).questions.find((q) => q.id === qId);
        if (qz) qz.options.push("");
        renderQuizzes();
        autosave();
      })
    );

    document.querySelectorAll("[data-del-option]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const [key, qId, rawOptionIndex] = btn.dataset.delOption.split(":");
        const optionIndex = Number(rawOptionIndex);
        const qz = resolveQuiz(key).questions.find((q) => q.id === qId);
        if (!qz || qz.options.length <= QUIZ_MIN_OPTIONS) return;
        qz.options.splice(optionIndex, 1);
        qz.correctIndexes = (qz.correctIndexes || [])
          .filter((idx) => idx !== optionIndex)
          .map((idx) => (idx > optionIndex ? idx - 1 : idx))
          .slice(0, 1);
        if (!qz.correctIndexes.length) qz.correctIndexes = [0];
        renderQuizzes();
        autosave();
      })
    );

    document.querySelectorAll("[data-del-question]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const [key, qId] = btn.dataset.delQuestion.split(":");
        const quiz = resolveQuiz(key);
        quiz.questions = quiz.questions.filter((q) => q.id !== qId);
        if (!quiz.questions.length) quiz.questions.push(questionTemplate());
        renderQuizzes();
        autosave();
      })
    );

    document.querySelectorAll(".quiz-question").forEach((row) => {
      const quiz = resolveQuiz(row.dataset.quizKey);
      const qz = quiz.questions.find((x) => x.id === row.dataset.qId);
      if (!qz) return;

      row.querySelectorAll("[data-q-field]").forEach((el) =>
        el.addEventListener("input", () => {
          qz[el.dataset.qField] = el.value;
          autosave();
        })
      );

      row.querySelectorAll("[data-opt-index]").forEach((el) =>
        el.addEventListener("input", () => {
          qz.options[Number(el.dataset.optIndex)] = el.value;
          autosave();
        })
      );

      row.querySelectorAll("[data-correct-index]").forEach((el) =>
        el.addEventListener("change", () => {
          const idx = Number(el.dataset.correctIndex);
          qz.correctIndexes = [idx];
          autosave();
        })
      );
    });
  }

  function validationErrors(mode = "submit") {
    const errs = [];
    if (!state.course.title.trim()) errs.push("يرجى إدخال عنوان الدورة.");
    if (!state.course.category.trim()) errs.push("يرجى تحديد تصنيف الدورة.");
    if (!state.course.description.trim()) errs.push("يرجى إدخال وصف واضح للدورة.");
    if (!state.course.modules.length) errs.push("يجب إضافة وحدة واحدة على الأقل.");

    const lessonsCount = state.course.modules.reduce((sum, m) => sum + m.lessons.length, 0);
    if (!lessonsCount) errs.push("يجب إضافة درس واحد على الأقل.");

    [state.course.finalQuiz, ...state.course.modules.flatMap((m) => m.lessons.map((l) => l.checkpointQuiz))].forEach((quiz) => {
      if (!quiz.title?.trim()) errs.push("يرجى إدخال عنوان لكل اختبار.");
      if (!quiz.questions?.length) errs.push("كل اختبار يجب أن يحتوي على سؤال واحد على الأقل.");
      if (!Number.isFinite(Number(quiz.passingScore)) || Number(quiz.passingScore) < 1 || Number(quiz.passingScore) > 100) {
        errs.push("درجة النجاح يجب أن تكون بين 1 و100.");
      }
      if (!Number.isFinite(Number(quiz.timeLimitMinutes)) || Number(quiz.timeLimitMinutes) < 1) {
        errs.push("مدة الاختبار يجب أن تكون دقيقة واحدة على الأقل.");
      }
      quiz.questions.forEach((qz) => {
        if (!qz.question.trim()) errs.push("يوجد سؤال بدون نص.");
        if ((qz.options || []).filter((x) => String(x).trim()).length < QUIZ_MIN_OPTIONS) {
          errs.push("كل سؤال يحتاج خيارين غير فارغين على الأقل.");
        }
        if (!(qz.correctIndexes || []).length) errs.push("كل سؤال يحتاج إجابة صحيحة واحدة على الأقل.");
        if ((qz.correctIndexes || []).some((i) => !String((qz.options || [])[i] || "").trim())) {
          errs.push("الإجابة الصحيحة يجب أن تشير إلى خيار غير فارغ.");
        }
      });
    });

    if (mode === "publish" && role !== "admin") errs.push("النشر المباشر متاح للمشرف فقط.");

    q("#validationList").innerHTML = errs.length
      ? errs.map((x) => `<li>${esc(x)}</li>`).join("")
      : `<li>✅ جميع عناصر النشر مكتملة.</li>`;

    return errs;
  }

  function payload(nextStatus) {
    const lessons = state.course.modules.flatMap((m) =>
      m.lessons.map((l) => ({ ...l, moduleId: m.id, moduleTitle: m.title }))
    );

    const now = serverTimestamp();

    return {
      ...state.course,
      lessons,
      status: nextStatus,
      instructorId: role === "instructor" ? state.user.uid : state.course.instructorId || "",
      instructorEmail: role === "instructor" ? state.user.email || "" : state.course.instructorEmail || "",
      updatedAt: now,
      createdAt: state.course.createdAt || now,
      workflowVersion: 2
    };
  }

  async function saveDraft(showNotice = false) {
    if (!state.user?.uid) return;

    const draft = payload(state.course.status || "draft");
    localStorage.setItem(opts.localDraftKey, JSON.stringify({ ...draft, updatedAtISO: new Date().toISOString() }));
    await setDoc(doc(db, opts.draftCollection, state.user.uid), draft, { merge: true });

    if (state.course.id) {
      await updateDoc(doc(db, "courses", state.course.id), { ...draft, status: state.course.status || "draft" }).catch(() => {});
    }

    q("#lastAutosave").textContent = new Date().toLocaleTimeString("ar");
    if (showNotice) setStatus("✅ تم حفظ المسودة بنجاح.");
  }

  async function submitForReview() {
    const errs = validationErrors("submit");
    if (errs.length) return setStatus("❌ لا يمكن الإرسال قبل معالجة الملاحظات أعلاه.", true);
    if (role !== "instructor") return;

    const next = state.course.status === "changes_requested" ? "resubmitted" : "submitted";
    const data = payload(next);

    if (!state.course.id) {
      const courseRef = await addDoc(collection(db, "courses"), data);
      state.course.id = courseRef.id;
    } else {
      await setDoc(doc(db, "courses", state.course.id), data, { merge: true });
    }

    await addDoc(collection(db, "instructorCourseSubmissions"), {
      courseId: state.course.id,
      instructorId: state.user.uid,
      instructorEmail: state.user.email || "",
      instructorName: state.user.displayName || "",
      title: state.course.title,
      summary: state.course.description.slice(0, 180),
      note: "",
      status: next,
      snapshot: data,
      timeline: [{ type: next, at: serverTimestamp(), by: state.user.uid }],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    state.course.status = next;
    setStatus("✅ تم إرسال الدورة للمراجعة.");
    renderAll();
  }

  async function publishDirect() {
    const errs = validationErrors("publish");
    if (errs.length) return setStatus("❌ لا يمكن النشر قبل استكمال المتطلبات.", true);
    if (role !== "admin") return;

    const data = payload("published");

    if (state.course.id) {
      await setDoc(doc(db, "courses", state.course.id), data, { merge: true });
    } else {
      const refDoc = await addDoc(collection(db, "courses"), data);
      state.course.id = refDoc.id;
    }

    state.course.status = "published";
    setStatus("✅ تم نشر الدورة بنجاح.");
    renderAll();
  }

  async function restoreDraft() {
    const local = parseJson(localStorage.getItem(opts.localDraftKey));
    const remoteSnap = await getDoc(doc(db, opts.draftCollection, state.user.uid));
    const remote = remoteSnap.exists() ? remoteSnap.data() : null;

    state.course = pickLatest(local, remote) || state.course;

    if (!state.course.modules?.length) state.course.modules = [moduleTemplate(1)];
    state.course.modules = state.course.modules.map((mod, mi) => ({
      ...mod,
      id: mod.id || uid(),
      title: mod.title || `وحدة ${mi + 1}`,
      lessons: Array.isArray(mod.lessons) && mod.lessons.length
        ? mod.lessons.map((lesson, li) => ({
            ...lesson,
            id: lesson.id || uid(),
            title: lesson.title || `درس ${li + 1}`,
            checkpointQuiz: normalizeQuizShape(lesson.checkpointQuiz, "اختبار نقطة تحقق")
          }))
        : [lessonTemplate(1)]
    }));
    state.course.finalQuiz = normalizeQuizShape(state.course.finalQuiz, "الاختبار النهائي");
    if (!state.course.pricing) state.course.pricing = { suggestedPrice: 0, finalPrice: 0, accessModel: "paid" };

    state.activeModuleId = state.course.modules[0].id;
    state.activeLessonId = state.course.modules[0].lessons[0].id;
    state.activeSlideId = state.course.modules[0].lessons[0].slides[0]?.id || "";

    if (role === "instructor") {
      const snap = await getDocs(
        query(
          collection(db, "instructorCourseSubmissions"),
          where("instructorId", "==", state.user.uid),
          orderBy("updatedAt", "desc"),
          limit(5)
        )
      );

      const notes = snap.docs
        .map((d) => d.data())
        .map((x) => ({ status: x.status, note: x.note || x.reviewReason || "" }))
        .filter((x) => x.note || x.status);

      if (notes.length) state.course.reviewNotes = notes;

      const recent = snap.docs[0]?.data();
      if (recent?.status) state.course.status = recent.status;
    }

    applyCourseToForm();
  }

  function renderPreview() {
    const preview = q("#realPreview");
    const lesson = activeLesson();
    const slide = lesson?.slides?.[0];
    const checkpointQuiz = lesson?.checkpointQuiz || normalizeQuizShape(null, "اختبار نقطة تحقق");
    const checkpointSample = checkpointQuiz.questions[0];
    const finalSample = state.course.finalQuiz.questions[0];
    const shownPrice = Number(state.course.pricing?.finalPrice || state.course.pricing?.suggestedPrice || 0);

    preview.innerHTML = `
      <section class="preview-landing">
        <img src="${esc(state.course.cover || "/assets/images/default-course.png")}" alt="cover">
        <div>
          <span class="ch-badge ${state.course.status || "draft"}">${statusLabel(state.course.status || "draft")}</span>
          <h3>${esc(state.course.title || "عنوان الدورة")}</h3>
          <p>${esc(state.course.description || "سيظهر وصف الدورة هنا")}</p>
          <p><strong>السعر النهائي:</strong> ${shownPrice > 0 ? `${shownPrice.toLocaleString("ar")} ر.س` : "مجانية"}</p>
        </div>
      </section>
      <section class="preview-curriculum">
        <h4>منهج الدورة</h4>
        <ul>${state.course.modules.map((m) => `<li><strong>${esc(m.title)}</strong> (${m.lessons.length} دروس)</li>`).join("")}</ul>
      </section>
      <section class="preview-lesson">
        <h4>معاينة الدرس الحالي</h4>
        <p>${esc(lesson?.title || "-")}</p>
        <p>${esc(lesson?.summary || "")}</p>
        ${
          slide
            ? `<div class="slide-preview-mini slide-preview-live" style="${slideBackgroundStyle(slide.background)}">${renderSlideElements(slide, {
                scale: 0.28,
                editable: false
              })}</div>`
            : ""
        }
      </section>
      <section class="preview-quiz">
        <h4>معاينة اختبار نقطة التحقق</h4>
        <p><strong>${esc(checkpointQuiz.title || "اختبار نقطة تحقق")}</strong> • ${checkpointQuiz.questions.length} سؤال • نجاح ${checkpointQuiz.passingScore}% • ${checkpointQuiz.timeLimitMinutes} دقيقة</p>
        ${
          checkpointSample
            ? `<div class="preview-quiz-question"><p>${esc(checkpointSample.question || "اكتب نص السؤال...")}</p><ol>${checkpointSample.options
                .filter((opt) => String(opt).trim())
                .map((opt) => `<li>${esc(opt)}</li>`)
                .join("")}</ol></div>`
            : ""
        }
        <h4>${esc(state.course.finalQuiz.title || "الاختبار النهائي")}</h4>
        <p>${state.course.finalQuiz.questions.length} سؤال • النجاح: ${state.course.finalQuiz.passingScore}% • ${state.course.finalQuiz.timeLimitMinutes} دقيقة</p>
        ${
          finalSample
            ? `<div class="preview-quiz-question"><p>${esc(finalSample.question || "اكتب نص السؤال النهائي...")}</p><ol>${finalSample.options
                .filter((opt) => String(opt).trim())
                .map((opt) => `<li>${esc(opt)}</li>`)
                .join("")}</ol></div>`
            : ""
        }
      </section>
    `;
  }

  function renderReviewNotes() {
    const notes = state.course.reviewNotes || [];
    q("#reviewTimeline").innerHTML = notes.length
      ? notes
          .map((n) => `<article><strong>${statusLabel(n.status || "")}</strong><p>${esc(n.note || "")}</p></article>`)
          .join("")
      : `<div class="empty-box">لا توجد ملاحظات مراجعة حالياً.</div>`;

    if (role !== "instructor") {
      q("#instructorReviewPanel").innerHTML = `<div class="empty-box">هذه اللوحة مخصصة للأستاذ.</div>`;
    }
  }

  function renderAll() {
    renderModules();
    renderLessonSettings();
    renderSlides();
    renderQuizzes();
    renderPreview();
    renderReviewNotes();
    updateStatusMeta();

    q("#finalPrice").disabled = role !== "admin";
    q("#finalPriceWrap").style.opacity = role === "admin" ? "1" : "0.55";
  }

  function bindActions() {
    q("#nextStep").onclick = () => setStep(state.step + 1);
    q("#prevStep").onclick = () => setStep(state.step - 1);
    q("#saveDraft").onclick = () => saveDraft(true);
    q("#addModule").onclick = () => {
      state.course.modules.push(moduleTemplate(state.course.modules.length + 1));
      const mod = state.course.modules.at(-1);
      state.activeModuleId = mod.id;
      state.activeLessonId = mod.lessons[0].id;
      renderAll();
      autosave();
    };
    q("#addFinalQuestion").onclick = () => {
      state.course.finalQuiz.questions.push(questionTemplate());
      renderQuizzes();
      autosave();
    };
    q("#submitForReview").onclick = submitForReview;
    q("#publishDirect").onclick = publishDirect;
  }

  function parseJson(raw) {
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function pickLatest(local, remote) {
    const lt = Date.parse(local?.updatedAtISO || 0);
    const rt = remote?.updatedAt?.toDate ? remote.updatedAt.toDate().getTime() : Date.parse(remote?.updatedAtISO || 0);
    if (!local && !remote) return null;
    return lt >= rt ? local : remote;
  }

  async function mount() {
    if (state.mounted) return;

    q("#builderPageTitle").textContent = role === "admin" ? "منصة إنشاء الدورات للمشرف" : "استوديو إنشاء الدورات للأستاذ";
    q("#builderRoleBadge").textContent = role === "admin" ? "صلاحية: مشرف" : "صلاحية: أستاذ";

    setLoading(true);
    bindActions();
    bindGeneralInputs();
    setStep(0);

    auth.onAuthStateChanged(async (user) => {
      if (!user) return;
      state.user = user;
      await loadCategories();
      await restoreDraft();
      renderAll();
      setLoading(false);
      state.mounted = true;
    });
  }

  return { mount };
}
