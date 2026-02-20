import { auth, db, storage } from "/js/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  onSnapshot,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import { LessonBuilder } from "/admin/js-admin/lesson-builder.js";
import { SlideBuilder } from "/admin/js-admin/slide-builder.js";
import { QuizBuilder } from "/admin/js-admin/quiz-builder.js";

const DRAFT_KEY = "coursehub_instructor_course_draft_v3";

/* ===== DOM ===== */
const form = document.getElementById("instructorCourseForm");
const statusEl = document.getElementById("instructorFormStatus");

const listEl = document.getElementById("instructorSubmissions"); // optional (لو عندك قائمة عامة)
const draftsListEl = document.getElementById("draftsList");
const pendingListEl = document.getElementById("pendingList");
const approvedListEl = document.getElementById("approvedList");
const rejectedListEl = document.getElementById("rejectedList");
const publishedListEl = document.getElementById("publishedList");
const archivedListEl = document.getElementById("archivedList");

const chatMessagesEl = document.getElementById("instructorChatMessages");
const chatInputEl = document.getElementById("instructorChatInput");
const sendChatBtn = document.getElementById("sendInstructorChatBtn");
const chatNavBadgeEl = document.getElementById("chatNavBadge");
const chatPanelBadgeEl = document.getElementById("chatPanelBadge");

const pendingCount = document.getElementById("pendingCount");
const approvedCount = document.getElementById("approvedCount");

const coverInput = document.getElementById("courseImage");
const coverUrlInput = document.getElementById("courseImageUrl");
const coverPreview = document.getElementById("coverPreview");
const previewCover = document.getElementById("previewCover");
const addLessonBtn = document.getElementById("addLessonBtn");

const functions = getFunctions(undefined, "us-central1");
const submitInstructorCourse = httpsCallable(functions, "submitInstructorCourse");

let currentInstructorUid = "";
let chatUnsubscribe = null;
let activeWorkspaceTarget = "ws-add";
let lessonBuilder = null;
let slideBuilder = null;
let quizBuilder = null;

/* ===== UI helpers ===== */
function statusBadge(status) {
  const map = { pending: "قيد المراجعة", approved: "معتمدة", rejected: "مرفوضة" };
  return `<span class="badge ${status}">${map[status] || status}</span>`;
}

function setStatus(msg, isError = false) {
  if (!statusEl) return;
  statusEl.style.color = isError ? "#b91c1c" : "#1d4ed8";
  statusEl.textContent = msg || "";
}

function esc(value = "") {
  return String(value).replace(/"/g, "&quot;");
}

function formatDate(value) {
  if (!value) return "-";
  const date = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ar-EG");
}

function renderState(el, kind, msg) {
  if (!el) return;
  el.innerHTML = `<div class="${kind}-state">${msg}</div>`;
}

function renderEmpty(el, msg) {
  renderState(el, "empty", msg);
}

function renderLoading(el, msg = "جاري التحميل...") {
  renderState(el, "loading", msg);
}

function renderError(el, msg) {
  renderState(el, "error", msg);
}

function ensureLessonBuilders() {
  if (lessonBuilder && slideBuilder && quizBuilder) return;
  lessonBuilder = new LessonBuilder("lessonsContainer");
  slideBuilder = new SlideBuilder();
  quizBuilder = new QuizBuilder();
}

function getLessonData() {
  if (!lessonBuilder) return [];
  return lessonBuilder.getData().map((lesson) => ({
    id: lesson.id,
    title: lesson.title || "",
    duration: lesson.duration || "",
    summary: lesson.summary || "",
    slides: slideBuilder?.getSlides(lesson.id) || [],
    quiz: quizBuilder?.getQuiz(lesson.id) || []
  }));
}

function buildLegacyModulesFromLessons(lessons) {
  return lessons
    .filter((lesson) => lesson.title)
    .map((lesson) => ({
      title: lesson.title,
      lessons: (lesson.slides || []).map((slide, index) => ({
        title: slide.title || `سلايد ${index + 1}`,
        duration: Number(lesson.duration || 0)
      }))
    }));
}

function buildLegacyQuestionsFromLessons(lessons) {
  const questions = [];
  lessons.forEach((lesson) => {
    (lesson.quiz || []).forEach((q) => {
      if (!q.question) return;
      questions.push({
        question: q.question,
        options: Array.isArray(q.options) ? q.options : [],
        correctIndex: Number(q.correct || 0)
      });
    });
  });
  return questions;
}

/* ===== Text toolbar ===== */
function insertAtCursor(textarea, snippet) {
  if (!textarea) return;
  const start = textarea.selectionStart || 0;
  const end = textarea.selectionEnd || 0;
  const current = textarea.value || "";
  textarea.value = `${current.slice(0, start)}${snippet}${current.slice(end)}`;
  const cursor = start + snippet.length;
  textarea.setSelectionRange(cursor, cursor);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.focus();
}

function initDescriptionToolbar() {
  const toolbar = document.getElementById("descriptionToolbar");
  const textarea = document.getElementById("courseDescription");
  if (!toolbar || !textarea) return;

  const templates = {
    h2: "\n## عنوان فرعي\n",
    bold: " **نقطة مهمة** ",
    bullet: "\n- نقطة تعلم 1\n- نقطة تعلم 2\n",
    tip: "\n💡 نصيحة تطبيقية: ...\n"
  };

  toolbar.querySelectorAll(".toolbar-btn").forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.addEventListener("click", () => {
      const format = btn.dataset.format;
      insertAtCursor(textarea, templates[format] || "");
    });
    btn.dataset.bound = "1";
  });
}

/* ===== Tabs + workspace ===== */
function setBuilderTab(target) {
  const tabs = document.querySelectorAll(".tab-btn");
  const contents = document.querySelectorAll(".tab-content");

  tabs.forEach((t) => t.classList.remove("active"));
  document.querySelector(`.tab-btn[data-tab="${target}"]`)?.classList.add("active");

  contents.forEach((c) => c.classList.remove("active"));
  document.getElementById(`tab-${target}`)?.classList.add("active");

  renderPreview();
}

function setupTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach((tab) => {
    if (tab.dataset.bound) return;
    tab.addEventListener("click", () => setBuilderTab(tab.dataset.tab));
    tab.dataset.bound = "1";
  });
}

function setWorkspacePanel(target, { smooth = false } = {}) {
  const links = document.querySelectorAll(".workspace-link");
  const panels = document.querySelectorAll(".workspace-panel");
  const panelId = target || "ws-add";

  links.forEach((l) => l.classList.toggle("active", l.dataset.target === panelId || (panelId === "ws-add" && l.dataset.action === "open-builder")));
  panels.forEach((panel) => panel.classList.toggle("active", panel.id === panelId));

  activeWorkspaceTarget = panelId;

  if (panelId === "ws-chat") {
    markAllInstructorUnreadNow(currentInstructorUid).catch(() => {});
  }

  if (smooth) {
    document.querySelector(".instructor-admin-topbar")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function closeMobileSidebar() {
  const workspace = document.getElementById("instructorWorkspace");
  const toggleBtn = document.getElementById("workspaceSidebarToggle");
  if (!workspace) return;
  workspace.classList.remove("sidebar-open");
  toggleBtn?.setAttribute("aria-expanded", "false");
}

function setupWorkspaceNav() {
  const links = document.querySelectorAll(".workspace-link");

  links.forEach((link) => {
    if (link.dataset.bound) return;

    link.addEventListener("click", () => {
      const isBuilder = link.dataset.action === "open-builder";
      const target = isBuilder ? "ws-add" : link.dataset.target;
      setWorkspacePanel(target, { smooth: !isBuilder });

      if (isBuilder) {
        setBuilderTab(link.dataset.builderTab || "info");
      }

      closeMobileSidebar();
    });

    link.dataset.bound = "1";
  });
}

function setupSidebarToggle() {
  const toggleBtn = document.getElementById("workspaceSidebarToggle");
  const workspace = document.getElementById("instructorWorkspace");
  const overlay = document.getElementById("workspaceOverlay");
  if (!toggleBtn || !workspace) return;

  if (!toggleBtn.dataset.bound) {
    toggleBtn.addEventListener("click", () => {
      const mobileMode = window.matchMedia("(max-width: 900px)").matches;
      if (mobileMode) {
        const willOpen = !workspace.classList.contains("sidebar-open");
        workspace.classList.toggle("sidebar-open", willOpen);
        toggleBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");
        return;
      }

      workspace.classList.toggle("sidebar-collapsed");
      const expanded = !workspace.classList.contains("sidebar-collapsed");
      toggleBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
    });
    toggleBtn.dataset.bound = "1";
  }

  if (overlay && !overlay.dataset.bound) {
    overlay.addEventListener("click", closeMobileSidebar);
    overlay.dataset.bound = "1";
  }

  window.addEventListener("resize", () => {
    if (!window.matchMedia("(max-width: 900px)").matches) {
      workspace.classList.remove("sidebar-open");
    }
  });
}

/* ===== Dynamic lists ===== */
function createDynamicRow(value = "") {
  const row = document.createElement("div");
  row.className = "dynamic-row";
  row.innerHTML = `
    <input type="text" value="${esc(value)}" placeholder="اكتب هنا..." />
    <button type="button" class="icon-btn" title="حذف"><i class="fa-solid fa-trash"></i></button>
  `;

  row.querySelector(".icon-btn")?.addEventListener("click", () => {
    row.remove();
    renderPreview();
  });

  row.querySelector("input")?.addEventListener("input", renderPreview);
  return row;
}

function getListValues(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return [];
  return [...container.querySelectorAll("input")]
    .map((el) => el.value.trim())
    .filter(Boolean);
}

function initDynamicLists() {
  const config = [
    ["objectives", "objectivesList"],
    ["requirements", "requirementsList"],
    ["outcomes", "outcomesList"]
  ];

  config.forEach(([target, containerId]) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const btn = document.querySelector(`.add-row-btn[data-target="${target}"]`);
    if (btn && !btn.dataset.bound) {
      btn.addEventListener("click", () => {
        container.appendChild(createDynamicRow());
        renderPreview();
      });
      btn.dataset.bound = "1";
    }

    if (!container.children.length) container.appendChild(createDynamicRow());
  });
}

/* ===== Modules/Lessons ===== */
function createLessonRow(data = {}) {
  const row = document.createElement("div");
  row.className = "lesson-row";
  row.innerHTML = `
    <input type="text" class="lesson-title" placeholder="عنوان الدرس" value="${esc(data.title || "")}" />
    <input type="number" class="lesson-duration" min="1" placeholder="الدقائق" value="${data.duration || ""}" />
    <button type="button" class="icon-btn" title="حذف"><i class="fa-solid fa-trash"></i></button>
  `;

  row.querySelector(".icon-btn")?.addEventListener("click", () => {
    row.remove();
    renderPreview();
  });

  row.querySelectorAll("input").forEach((el) => el.addEventListener("input", renderPreview));
  return row;
}

function createModuleCard(data = {}) {
  const card = document.createElement("div");
  card.className = "module-card";
  card.innerHTML = `
    <div class="module-head">
      <input type="text" class="module-title" placeholder="اسم الوحدة" value="${esc(data.title || "")}" />
      <button type="button" class="btn ghost add-lesson-btn"><i class="fa-solid fa-plus"></i> إضافة درس</button>
      <button type="button" class="icon-btn module-remove" title="حذف الوحدة"><i class="fa-solid fa-trash"></i></button>
    </div>
    <div class="module-lessons"></div>
  `;

  const lessonsContainer = card.querySelector(".module-lessons");
  (Array.isArray(data.lessons) && data.lessons.length ? data.lessons : [{}]).forEach((lesson) => {
    lessonsContainer?.appendChild(createLessonRow(lesson));
  });

  card.querySelector(".add-lesson-btn")?.addEventListener("click", () => {
    lessonsContainer?.appendChild(createLessonRow());
    renderPreview();
  });

  card.querySelector(".module-remove")?.addEventListener("click", () => {
    card.remove();
    renderPreview();
  });

  card.querySelector(".module-title")?.addEventListener("input", renderPreview);

  return card;
}

function gatherModules() {
  const lessons = getLessonData();
  return buildLegacyModulesFromLessons(lessons);
}

function initModules() {
  ensureLessonBuilders();

  if (addLessonBtn && !addLessonBtn.dataset.bound) {
    addLessonBtn.addEventListener("click", () => {
      lessonBuilder.addLesson();
      renderPreview();
    });
    addLessonBtn.dataset.bound = "1";
  }

  const lessonsContainer = document.getElementById("lessonsContainer");
  if (lessonsContainer && !lessonsContainer.dataset.boundPreview) {
    lessonsContainer.addEventListener("input", () => renderPreview());
    lessonsContainer.addEventListener("change", () => renderPreview());
    lessonsContainer.dataset.boundPreview = "1";
  }

  if (!document.body.dataset.lessonDelegationBound) {
    document.body.addEventListener("click", (event) => {
      const slideBtn = event.target.closest(".add-slide");
      if (slideBtn) {
        const lessonCard = slideBtn.closest(".lesson-card");
        const lessonId = lessonCard?.id?.replace("lesson-", "");
        const slidesContainer = lessonCard?.querySelector(".slides-container");
        if (lessonId && slidesContainer) {
          slideBuilder.addSlide(lessonId, slidesContainer);
          renderPreview();
        }
        return;
      }

      const quizBtn = event.target.closest(".add-quiz");
      if (quizBtn) {
        const lessonCard = quizBtn.closest(".lesson-card");
        const lessonId = lessonCard?.id?.replace("lesson-", "");
        const quizContainer = lessonCard?.querySelector(".quiz-container");
        if (lessonId && quizContainer) {
          quizBuilder.addQuiz(lessonId, quizContainer);
          renderPreview();
        }
      }
    });
    document.body.dataset.lessonDelegationBound = "1";
  }
}


/* ===== Quiz ===== */
function createQuestionCard(data = {}) {
  const card = document.createElement("div");
  card.className = "question-card";
  card.innerHTML = `
    <div class="question-head">
      <input type="text" class="question-title" placeholder="نص السؤال" value="${esc(data.question || "")}" />
      <button type="button" class="icon-btn question-remove" title="حذف السؤال"><i class="fa-solid fa-trash"></i></button>
    </div>
    <div class="question-options">
      <input type="text" class="q-option" placeholder="الخيار 1" value="${esc(data.options?.[0] || "")}">
      <input type="text" class="q-option" placeholder="الخيار 2" value="${esc(data.options?.[1] || "")}">
      <input type="text" class="q-option" placeholder="الخيار 3" value="${esc(data.options?.[2] || "")}">
      <input type="text" class="q-option" placeholder="الخيار 4" value="${esc(data.options?.[3] || "")}">
    </div>
    <label class="question-correct">الإجابة الصحيحة:
      <select class="question-correct-index">
        <option value="0" ${Number(data.correctIndex || 0) === 0 ? "selected" : ""}>الخيار 1</option>
        <option value="1" ${Number(data.correctIndex || 0) === 1 ? "selected" : ""}>الخيار 2</option>
        <option value="2" ${Number(data.correctIndex || 0) === 2 ? "selected" : ""}>الخيار 3</option>
        <option value="3" ${Number(data.correctIndex || 0) === 3 ? "selected" : ""}>الخيار 4</option>
      </select>
    </label>
  `;

  card.querySelector(".question-remove")?.addEventListener("click", () => {
    card.remove();
    renderPreview();
  });

  card.querySelectorAll("input,select").forEach((el) => el.addEventListener("input", renderPreview));
  return card;
}

function initAssessmentBuilder() {
  ensureLessonBuilders();
}

function gatherAssessmentQuestions() {
  const lessons = getLessonData();
  return buildLegacyQuestionsFromLessons(lessons);
}

/* ===== Preview ===== */
function renderPreview() {
  const previewTitle = document.getElementById("previewTitle");
  const previewDescription = document.getElementById("previewDescription");
  const previewMeta = document.getElementById("previewMeta");
  const previewObjectives = document.getElementById("previewObjectives");
  const previewModules = document.getElementById("previewModules");
  const previewCategoryTag = document.getElementById("previewCategoryTag");

  const title = document.getElementById("courseTitle")?.value?.trim() || "";
  const description = document.getElementById("courseDescription")?.value?.trim() || "";
  const category = document.getElementById("courseCategory")?.value?.trim() || "";
  const level = document.getElementById("courseLevel")?.value || "";
  const language = document.getElementById("courseLanguage")?.value || "";
  const duration = document.getElementById("courseDuration")?.value || "";
  const price = document.getElementById("coursePrice")?.value || "";

  if (previewTitle) previewTitle.textContent = title || "عنوان الدورة";
  if (previewDescription) previewDescription.textContent = description || "سيظهر وصف الدورة هنا بعد إدخاله.";
  if (previewCategoryTag) previewCategoryTag.textContent = category || "تصنيف الدورة";

  if (previewMeta) {
    const lessons = getLessonData();
    const lessonsCount = lessons.length;
    const questionsCount = buildLegacyQuestionsFromLessons(lessons).length;

    const chips = [
      category ? `التصنيف: ${category}` : "",
      level ? `المستوى: ${level}` : "",
      language ? `اللغة: ${language}` : "",
      duration ? `المدة: ${duration} ساعة` : "",
      price ? `السعر: ${price}$` : "",
      `الدروس: ${lessonsCount}`,
      `الأسئلة: ${questionsCount}`
    ].filter(Boolean);

    previewMeta.innerHTML = chips.map((chip) => `<span>${chip}</span>`).join("");
  }

  if (previewObjectives) {
    const objectives = getListValues("objectivesList");
    previewObjectives.innerHTML = objectives.length
      ? objectives.map((obj) => `<li>${obj}</li>`).join("")
      : "<li>لا توجد أهداف مضافة بعد.</li>";
  }

  if (previewModules) {
    const lessons = getLessonData();
    previewModules.innerHTML = lessons.length
      ? lessons
          .map(
            (lesson, index) => `
            <div class="preview-module">
              <h5>الدرس ${index + 1}: ${lesson.title || "بدون عنوان"}</h5>
              <ul>
                <li>المدة: ${lesson.duration || "-"} دقيقة</li>
                <li>عدد السلايدات: ${(lesson.slides || []).length}</li>
                <li>عدد أسئلة الاختبار: ${(lesson.quiz || []).length}</li>
              </ul>
            </div>
          `
          )
          .join("")
      : "<p>لا توجد دروس بعد.</p>";
  }
}

function bindPreviewInputs() {
  ["courseTitle", "courseDescription", "courseCategory", "courseLevel", "courseLanguage", "courseDuration", "coursePrice"]
    .forEach((id) => {
      document.getElementById(id)?.addEventListener("input", renderPreview);
      document.getElementById(id)?.addEventListener("change", renderPreview);
    });
}

/* ===== Cover preview ===== */
function setupCoverPreview() {
  if (coverInput && !coverInput.dataset.bound) {
    coverInput.addEventListener("change", () => {
      const file = coverInput.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      if (coverPreview) coverPreview.src = url;
      if (previewCover) previewCover.src = url;
    });
    coverInput.dataset.bound = "1";
  }

  if (coverUrlInput && !coverUrlInput.dataset.bound) {
    coverUrlInput.addEventListener("input", () => {
      const url = coverUrlInput.value.trim();
      if (!url) return;
      if (coverPreview) coverPreview.src = url;
      if (previewCover) previewCover.src = url;
    });
    coverUrlInput.dataset.bound = "1";
  }
}

/* ===== Fill builder from item ===== */
function fillBuilderFromSubmission(item = {}) {
  const setVal = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value ?? "";
  };

  setVal("courseTitle", item.title || "");
  setVal("courseTitleEn", item.titleEn || "");
  setVal("courseCategory", item.category || "");
  setVal("coursePrice", item.price ?? "");
  setVal("courseLevel", item.level || "مبتدئ");
  setVal("courseLanguage", item.language || "العربية");
  setVal("courseDuration", item.durationHours ?? item.duration ?? "");
  setVal("courseDifficulty", item.difficulty || "متوازن");
  setVal("courseDescription", item.description || "");
  setVal("courseImageUrl", item.imageUrl || item.image || "");

  const loadRows = (containerId, values = []) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    (values.length ? values : [""]).forEach((v) => container.appendChild(createDynamicRow(v)));
  };

  loadRows("objectivesList", item.objectives || []);
  loadRows("requirementsList", item.requirements || []);
  loadRows("outcomesList", item.outcomes || []);

  ensureLessonBuilders();
  const lessonsContainer = document.getElementById("lessonsContainer");
  const lessonsFromItem = Array.isArray(item.lessons) && item.lessons.length
    ? item.lessons
    : (Array.isArray(item.modules) ? item.modules.map((m) => ({
      title: m.title || "",
      duration: m.lessons?.[0]?.duration || "",
      summary: "",
      slides: (m.lessons || []).map((lesson) => ({
        title: lesson.title || "",
        text: "",
        type: "text"
      })),
      quiz: []
    })) : []);

  if (lessonsContainer) lessonsContainer.innerHTML = "";
  if (lessonBuilder) {
    lessonBuilder.lessons = [];
  }
  if (slideBuilder) {
    slideBuilder.slides = {};
  }
  if (quizBuilder) {
    quizBuilder.quizzes = {};
  }

  lessonsFromItem.forEach((lessonItem) => {
    lessonBuilder.addLesson();
    const lesson = lessonBuilder.lessons[lessonBuilder.lessons.length - 1];
    if (!lesson) return;

    lesson.title = lessonItem.title || "";
    lesson.duration = lessonItem.duration || "";
    lesson.summary = lessonItem.summary || "";

    const lessonCard = document.getElementById(`lesson-${lesson.id}`);
    lessonCard?.querySelector(".lesson-title")?.setAttribute("value", lesson.title);
    if (lessonCard?.querySelector(".lesson-title")) lessonCard.querySelector(".lesson-title").value = lesson.title;
    if (lessonCard?.querySelector(".lesson-duration")) lessonCard.querySelector(".lesson-duration").value = lesson.duration;
    if (lessonCard?.querySelector(".lesson-summary")) lessonCard.querySelector(".lesson-summary").value = lesson.summary;

    const slidesContainer = lessonCard?.querySelector(".slides-container");
    (lessonItem.slides || []).forEach((slide) => {
      slideBuilder.addSlide(lesson.id, slidesContainer);
      const createdSlide = (slideBuilder.slides[lesson.id] || [])[slideBuilder.slides[lesson.id].length - 1];
      if (!createdSlide) return;
      createdSlide.type = slide.type || "text";
      createdSlide.title = slide.title || "";
      createdSlide.text = slide.text || slide.content || "";
      createdSlide.mediaUrl = slide.mediaUrl || "";
      createdSlide.mediaPreview = slide.mediaUrl || "";
      createdSlide.textColor = slide.style?.textColor || "#0f172a";
      createdSlide.backgroundColor = slide.style?.backgroundColor || "#ffffff";
      createdSlide.fontSize = Number(slide.style?.fontSize || 24);
      createdSlide.fontWeight = Number(slide.style?.fontWeight || 600);
      createdSlide.textAlign = slide.style?.textAlign || "right";
      createdSlide.layout = slide.style?.layout || "media-right";
    });

    const quizContainer = lessonCard?.querySelector(".quiz-container");
    (lessonItem.quiz || []).forEach((q) => {
      quizBuilder.addQuiz(lesson.id, quizContainer);
      const createdQuiz = (quizBuilder.quizzes[lesson.id] || [])[quizBuilder.quizzes[lesson.id].length - 1];
      if (!createdQuiz) return;
      createdQuiz.question = q.question || "";
      createdQuiz.options = Array.isArray(q.options) ? q.options : ["", "", "", ""];
      createdQuiz.correct = Number(q.correct ?? q.correctIndex ?? 0);
    });
  });

  lessonBuilder.updateEmptyState();

  const image = item.image || item.imageUrl || "";
  if (image) {
    if (coverPreview) coverPreview.src = image;
    if (previewCover) previewCover.src = image;
  }

  renderPreview();
  setBuilderTab("info");

  document.querySelector(".instructor-admin-topbar")?.scrollIntoView({ behavior: "smooth", block: "start" });
  setStatus("تم تحميل بيانات الدورة للتعديل.");
}

/* ===== Draft save/load ===== */
async function saveDraft() {
  const payload = {
    title: document.getElementById("courseTitle")?.value || "",
    titleEn: document.getElementById("courseTitleEn")?.value || "",
    category: document.getElementById("courseCategory")?.value || "",
    price: document.getElementById("coursePrice")?.value || "",
    level: document.getElementById("courseLevel")?.value || "",
    language: document.getElementById("courseLanguage")?.value || "",
    duration: document.getElementById("courseDuration")?.value || "",
    difficulty: document.getElementById("courseDifficulty")?.value || "",
    description: document.getElementById("courseDescription")?.value || "",
    imageUrl: document.getElementById("courseImageUrl")?.value || "",
    objectives: getListValues("objectivesList"),
    requirements: getListValues("requirementsList"),
    outcomes: getListValues("outcomesList"),
    lessons: getLessonData(),
    modules: gatherModules(),
    assessmentQuestions: gatherAssessmentQuestions(),
    updatedAt: new Date().toISOString()
  };

  localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));

  if (currentInstructorUid) {
    try {
      await setDoc(
        doc(db, "instructorCourseDrafts", currentInstructorUid),
        { ...payload, instructorId: currentInstructorUid, savedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (error) {
      console.warn("Cloud draft save failed:", error);
    }
  }

  setStatus("✅ تم حفظ المسودة (محليًا + سحابيًا لحسابك).");
}

async function loadDraft(uid) {
  let draft = null;

  try {
    draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
  } catch {
    draft = null;
  }

  if (!draft && uid) {
    try {
      const cloudDraft = await getDoc(doc(db, "instructorCourseDrafts", uid));
      if (cloudDraft.exists()) draft = cloudDraft.data();
    } catch (error) {
      console.warn("Could not load cloud draft:", error);
    }
  }

  if (!draft) return;

  fillBuilderFromSubmission(draft);

  const img = draft.imageUrl || draft.image || "";
  if (img) {
    if (coverPreview) coverPreview.src = img;
    if (previewCover) previewCover.src = img;
  }

  setStatus("تم استعادة آخر مسودة محفوظة.");
}

/* ===== Upload files ===== */
async function uploadFiles(user) {
  let imageUrl = "";
  let outlineUrl = "";

  const imageFile = document.getElementById("courseImage")?.files?.[0] || null;
  const imageUrlInput = document.getElementById("courseImageUrl")?.value?.trim() || "";
  const outlineFile = document.getElementById("courseOutline")?.files?.[0] || null;

  if (imageFile) {
    const imageRef = ref(storage, `instructor-courses/${user.uid}/cover-${Date.now()}-${imageFile.name}`);
    await uploadBytes(imageRef, imageFile);
    imageUrl = await getDownloadURL(imageRef);
  } else if (imageUrlInput) {
    imageUrl = imageUrlInput;
  }

  if (outlineFile) {
    const outlineRef = ref(storage, `instructor-courses/${user.uid}/outline-${Date.now()}-${outlineFile.name}`);
    await uploadBytes(outlineRef, outlineFile);
    outlineUrl = await getDownloadURL(outlineRef);
  }

  return { imageUrl, outlineUrl };
}

/* ===== Lists ===== */
async function loadSubmissions(uid) {
  renderLoading(pendingListEl, "جاري تحميل الدورات قيد المراجعة...");
  renderLoading(approvedListEl, "جاري تحميل الدورات المقبولة...");
  renderLoading(rejectedListEl, "جاري تحميل الدورات المرفوضة...");

  try {
    const subSnap = await getDocs(query(collection(db, "instructorCourseSubmissions"), where("instructorId", "==", uid)));
    const submissions = subSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const p = submissions.filter((i) => i.status === "pending").length;
    const a = submissions.filter((i) => i.status === "approved").length;

    if (pendingCount) pendingCount.textContent = String(p);
    if (approvedCount) approvedCount.textContent = String(a);

    const pending = submissions.filter((i) => i.status === "pending");
    const approved = submissions.filter((i) => i.status === "approved");
    const rejected = submissions.filter((i) => i.status === "rejected");

    if (pendingListEl) {
      pendingListEl.innerHTML = pending.length
        ? pending
            .map(
              (item) =>
                `<div class="submission-item"><h4>${item.title || "-"}</h4><p>${statusBadge("pending")}</p><p>تم الإرسال: ${formatDate(item.createdAt)}</p></div>`
            )
            .join("")
        : "<p>لا توجد دورات قيد المراجعة.</p>";
    }

    if (approvedListEl) {
      approvedListEl.innerHTML = approved.length
        ? approved
            .map(
              (item) =>
                `<div class="submission-item"><h4>${item.title || "-"}</h4><p>${statusBadge("approved")}</p><p>آخر تحديث: ${formatDate(item.updatedAt || item.reviewedAt || item.createdAt)}</p></div>`
            )
            .join("")
        : "<p>لا توجد دورات مقبولة بعد.</p>";
    }

    if (rejectedListEl) {
      rejectedListEl.innerHTML = rejected.length
        ? rejected
            .map(
              (item) =>
                `<div class="submission-item">
                  <h4>${item.title || "-"}</h4>
                  <p>${statusBadge("rejected")}</p>
                  <p class="reason">سبب الرفض: ${item.reviewReason || "غير محدد"}</p>
                  <div class="row-actions">
                    <button type="button" class="btn ghost rejected-edit-btn" data-id="${item.id}">تعديل وإعادة الإرسال</button>
                  </div>
                </div>`
            )
            .join("")
        : "<p>لا توجد دورات مرفوضة.</p>";
    }

    rejectedListEl?.querySelectorAll(".rejected-edit-btn").forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.addEventListener("click", () => {
        const item = rejected.find((x) => x.id === btn.dataset.id);
        if (item) fillBuilderFromSubmission(item);
      });
      btn.dataset.bound = "1";
    });

    if (listEl) {
      listEl.innerHTML = submissions.length
        ? submissions
            .map(
              (item) =>
                `<div class="submission-item"><h4>${item.title || "-"}</h4><p>${statusBadge(item.status || "pending")}</p><p>${item.reviewReason ? `ملاحظة الإدارة: ${item.reviewReason}` : ""}</p></div>`
            )
            .join("")
        : "<p>لا توجد طلبات بعد.</p>";
    }
  } catch (error) {
    const denied =
      error?.code === "permission-denied" ||
      String(error?.message || "").includes("Missing or insufficient permissions");

    if (!denied) console.warn("Could not load submissions:", error);

    if (pendingCount) pendingCount.textContent = "-";
    if (approvedCount) approvedCount.textContent = "-";

    renderError(pendingListEl, "تعذر تحميل الدورات قيد المراجعة.");
    renderError(approvedListEl, "تعذر تحميل الدورات المقبولة.");
    renderError(rejectedListEl, "تعذر تحميل الدورات المرفوضة.");
  }
}

async function loadInstructorDrafts(uid) {
  if (!draftsListEl) return;
  renderLoading(draftsListEl, "جاري تحميل المسودات...");
  try {
    const snap = await getDoc(doc(db, "instructorCourseDrafts", uid));
    if (!snap.exists()) {
      draftsListEl.innerHTML = "<p>لا توجد مسودات سحابية بعد.</p>";
      return;
    }

    const data = snap.data() || {};
    draftsListEl.innerHTML = `
      <div class="submission-item">
        <h4>${data.title || "مسودة بدون عنوان"}</h4>
        <p>آخر حفظ: ${formatDate(data.savedAt || data.updatedAt)}</p>
        <div class="row-actions">
          <button type="button" class="btn ghost" id="loadCloudDraftBtn">فتح المسودة للتعديل</button>
        </div>
      </div>
    `;

    const btn = document.getElementById("loadCloudDraftBtn");
    if (btn && !btn.dataset.bound) {
      btn.addEventListener("click", () => fillBuilderFromSubmission(data));
      btn.dataset.bound = "1";
    }
  } catch (error) {
    console.warn("Could not load instructor drafts");
    renderError(draftsListEl, "تعذر تحميل المسودات حالياً.");
  }
}

async function loadPublishedCourses(uid) {
  if (!publishedListEl || !archivedListEl) return;
  renderLoading(publishedListEl, "جاري تحميل الدورات المنشورة...");
  renderLoading(archivedListEl, "جاري تحميل الدورات المؤرشفة...");

  try {
    const coursesSnap = await getDocs(query(collection(db, "courses"), where("instructorId", "==", uid)));
    const courses = coursesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const published = courses.filter((c) => c.status === "published");
    const archived = courses.filter((c) => c.status === "archived");

    const certsSnap = await getDocs(collection(db, "certificates"));
    const certCount = new Map();
    certsSnap.forEach((docSnap) => {
      const c = docSnap.data();
      if (!c.courseId || !c.userId) return;
      certCount.set(c.courseId, (certCount.get(c.courseId) || 0) + 1);
    });

    publishedListEl.innerHTML = published.length
      ? published
          .map(
            (course) =>
              `<div class="submission-item">
                <h4>${course.title || "-"}</h4>
                <p><span class="badge approved">منشورة</span></p>
                <p>عدد الطلبة الذين أنهوا الدورة وحصلوا على الشهادة: <strong>${certCount.get(course.id) || 0}</strong></p>
              </div>`
          )
          .join("")
      : "<p>لا توجد دورات منشورة بعد.</p>";

    archivedListEl.innerHTML = archived.length
      ? archived
          .map(
            (course) =>
              `<div class="submission-item">
                <h4>${course.title || "-"}</h4>
                <p><span class="badge pending">مؤرشفة</span></p>
                <p>آخر تحديث: ${formatDate(course.updatedAt || course.archivedAt || course.createdAt)}</p>
              </div>`
          )
          .join("")
      : "<p>لا توجد دورات مؤرشفة.</p>";
  } catch (error) {
    console.warn("Could not load published/archived courses");
    renderError(publishedListEl, "تعذر تحميل الدورات المنشورة.");
    renderError(archivedListEl, "تعذر تحميل الدورات المؤرشفة.");
  }
}

/* ===== Chat ===== */
function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function updateChatBadges(items) {
  const unreadCount = items.filter((msg) => msg.senderRole === "admin" && !msg.readByInstructor).length;

  if (chatNavBadgeEl) {
    chatNavBadgeEl.hidden = unreadCount === 0;
    chatNavBadgeEl.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
  }

  if (chatPanelBadgeEl) {
    chatPanelBadgeEl.hidden = unreadCount === 0;
    chatPanelBadgeEl.textContent = `${unreadCount} جديد`;
  }
}

function renderChatMessages(items) {
  if (!chatMessagesEl) return;

  if (!items.length) {
    chatMessagesEl.innerHTML = '<p class="helper-text">لا توجد رسائل بعد.</p>';
    return;
  }

  chatMessagesEl.innerHTML = items
    .map((msg) => {
      const role = msg.senderRole === "admin" ? "admin" : "instructor";
      return `<article class="chat-bubble ${role}">
        <p>${escapeHtml(msg.text || "")}</p>
        <div class="chat-meta">${role === "admin" ? "المشرف" : "أنت"} • ${formatDate(msg.createdAt)}</div>
      </article>`;
    })
    .join("");

  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

async function markAllInstructorUnreadNow(uid) {
  if (!uid) return;

  try {
    const snap = await getDocs(query(collection(db, "instructorMessages"), where("instructorId", "==", uid)));
    const unreadDocs = snap.docs.filter((d) => {
      const msg = d.data();
      return msg.senderRole === "admin" && !msg.readByInstructor;
    });

    if (!unreadDocs.length) return;

    const batch = writeBatch(db);
    unreadDocs.forEach((msgDoc) => batch.update(msgDoc.ref, { readByInstructor: true }));
    await batch.commit();
  } catch (error) {
    if (error?.code === "permission-denied") return;
    throw error;
  }
}

async function markChatMessagesReadByInstructor(items) {
  const chatPanelActive = document.getElementById("ws-chat")?.classList.contains("active");
  if (!chatPanelActive) return;

  const unread = items.filter((msg) => msg.senderRole === "admin" && !msg.readByInstructor && msg.id);
  if (!unread.length) return;

  try {
    const batch = writeBatch(db);
    unread.forEach((msg) => {
      batch.update(doc(db, "instructorMessages", msg.id), { readByInstructor: true });
    });
    await batch.commit();
  } catch (error) {
    if (error?.code === "permission-denied") return;
    throw error;
  }
}

function subscribeChat(uid) {
  if (!chatMessagesEl) return;
  if (chatUnsubscribe) chatUnsubscribe();

  chatUnsubscribe = onSnapshot(
    query(collection(db, "instructorMessages"), where("instructorId", "==", uid)),
    async (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));

      renderChatMessages(items);
      updateChatBadges(items);

      try {
        await markChatMessagesReadByInstructor(items);
      } catch (error) {
        console.warn("Could not mark instructor messages as read:", error);
      }
    },
    (error) => {
      console.warn("Could not load chat");
      renderError(chatMessagesEl, "تعذر تحميل الرسائل حالياً.");
    }
  );
}

async function notifyAdminsAboutInstructorMessage(text, instructorName) {
  try {
    const adminsSnap = await getDocs(query(collection(db, "users"), where("role", "==", "admin")));
    const jobs = adminsSnap.docs.map((adminDoc) =>
      addDoc(collection(db, "notifications"), {
        userId: adminDoc.id,
        title: "رسالة جديدة من أستاذ",
        message: `${instructorName || "أستاذ"}: ${text.length > 90 ? `${text.slice(0, 90)}...` : text}`,
        link: "/admin/instructor-chat.html",
        read: false,
        createdAt: serverTimestamp()
      })
    );
    await Promise.all(jobs);
  } catch (error) {
    console.warn("Could not notify admins about instructor message:", error);
  }
}

async function sendChatMessage(user, profileData) {
  const text = chatInputEl?.value?.trim();
  if (!text) return;

  try {
    await addDoc(collection(db, "instructorMessages"), {
      instructorId: user.uid,
      instructorName: profileData?.name || user.displayName || "",
      instructorEmail: user.email || "",
      senderId: user.uid,
      senderRole: "instructor",
      text,
      readByAdmin: false,
      readByInstructor: true,
      createdAt: serverTimestamp()
    });

    await notifyAdminsAboutInstructorMessage(text, profileData?.name || user.displayName || "أستاذ");

    if (chatInputEl) chatInputEl.value = "";
  } catch (error) {
    console.error("Failed to send chat message:", error);
    setStatus("تعذر إرسال الرسالة للمشرف حالياً.", true);
  }
}

/* ===== Review checklist ===== */
function allReviewChecksMarked() {
  const checks = [...document.querySelectorAll(".review-check")];
  return checks.every((check) => check.checked);
}

/* ===== Reset builder ===== */
function resetBuilderState() {
  form?.reset();

  ["objectivesList", "requirementsList", "outcomesList", "assessmentQuestions", "lessonsContainer"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });

  if (lessonBuilder) lessonBuilder.lessons = [];
  if (slideBuilder) slideBuilder.slides = {};
  if (quizBuilder) quizBuilder.quizzes = {};
  lessonBuilder?.updateEmptyState();

  initDynamicLists();
  initModules();
  initAssessmentBuilder();

  if (coverPreview) coverPreview.src = "/assets/images/default-course.png";
  if (previewCover) previewCover.src = "/assets/images/default-course.png";

  document.querySelectorAll(".review-check").forEach((check) => (check.checked = false));
  renderPreview();
}

/* ===== Submit ===== */
async function submitCourse(user) {
  if (!allReviewChecksMarked()) {
    setStatus("⚠️ أكمل قائمة المراجعة قبل إرسال الدورة.", true);
    return;
  }

  const title = document.getElementById("courseTitle")?.value?.trim();
  const description = document.getElementById("courseDescription")?.value?.trim();
  const category = document.getElementById("courseCategory")?.value?.trim();
  const draftLessons = getLessonData();

  if (!title || !description || !category) {
    setStatus("يرجى إدخال العنوان + الوصف + التصنيف على الأقل.", true);
    return;
  }

  if (!draftLessons.length) {
    setStatus("أضف درسًا واحدًا على الأقل قبل الإرسال.", true);
    return;
  }

  setStatus("جاري رفع الطلب...");

  try {
    const { imageUrl, outlineUrl } = await uploadFiles(user);

    const lessons = [];
    for (const lesson of draftLessons) {
      const slides = await slideBuilder.getSlidesForSave(lesson.id, storage);
      const quiz = quizBuilder.getQuiz(lesson.id);
      lessons.push({
        title: lesson.title,
        duration: lesson.duration || "",
        summary: lesson.summary || "",
        slides,
        quiz,
        passScore: 80
      });
    }

    const modules = buildLegacyModulesFromLessons(lessons);
    const assessmentQuestions = buildLegacyQuestionsFromLessons(lessons);

    const payload = {
      instructorId: user.uid,
      instructorEmail: user.email || "",
      title,
      titleEn: document.getElementById("courseTitleEn")?.value?.trim() || "",
      description,
      category,
      price: Number(document.getElementById("coursePrice")?.value || 0),
      level: document.getElementById("courseLevel")?.value || "",
      language: document.getElementById("courseLanguage")?.value || "",
      durationHours: Number(document.getElementById("courseDuration")?.value || 0),
      difficulty: document.getElementById("courseDifficulty")?.value || "",
      objectives: getListValues("objectivesList"),
      requirements: getListValues("requirementsList"),
      outcomes: getListValues("outcomesList"),
      lessons,
      modules,
      assessmentQuestions,
      image: imageUrl,
      outlineUrl,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    let usedFallbackPath = false;

    try {
  await submitInstructorCourse(payload);
} catch (callableError) {
  console.warn("submitInstructorCourse callable failed", callableError);

  const code = String(callableError?.code || "");
  const msg = String(callableError?.message || "");
  const functionNotReady =
    code.includes("unavailable") ||
    code.includes("not-found") ||
    msg.includes("not-found") ||
    msg.includes("internal") ||
    msg.includes("Failed to fetch");

  if (!functionNotReady) throw callableError;

  await addDoc(collection(db, "instructorCourseSubmissions"), payload);
  usedFallbackPath = true;
}

    localStorage.removeItem(DRAFT_KEY);
    setStatus(
      usedFallbackPath
        ? "✅ تم إرسال الدورة عبر المسار الاحتياطي بنجاح (تعطل مؤقت بخدمة Cloud Function)."
        : "✅ تم إرسال الدورة للمراجعة بنجاح. ستظهر للمشرف ضمن طلبات المراجعة."
    );
    resetBuilderState();

    await loadSubmissions(user.uid);
    await loadInstructorDrafts(user.uid);
    await loadPublishedCourses(user.uid);
} catch (err) {
  console.warn("Course submission failed", err);

  const denied =
    err?.code === "permission-denied" ||
    String(err?.message || "").includes("Missing or insufficient permissions");

  if (denied) {
    setStatus(
      "❌ تم رفض الإرسال بسبب الصلاحيات. تأكد أن الأستاذ دوره instructor وحالته active، وأن Cloud Function تتحقق من ذلك.",
      true
    );
    return;
  }

  setStatus("❌ تعذر إرسال الدورة. تحقق من الاتصال وإعدادات Cloud Functions/CORS ثم حاول مرة أخرى.", true);
}
}

/* ===== Auth gate + init ===== */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  const profile = await getDoc(doc(db, "users", user.uid));
  const data = profile.exists() ? profile.data() : null;

  if (!data || data.role !== "instructor" || data.status !== "active") {
    window.location.href = "/instructor-pending.html";
    return;
  }

  currentInstructorUid = user.uid;

  setupTabs();
  setupWorkspaceNav();
  setupSidebarToggle();
  setWorkspacePanel(activeWorkspaceTarget);
  initDynamicLists();
  initModules();
  initAssessmentBuilder();
  bindPreviewInputs();
  setupCoverPreview();
  initDescriptionToolbar();

  await loadDraft(user.uid);
  renderPreview();

  const saveBtn = document.getElementById("saveDraftBtn");
  if (saveBtn && !saveBtn.dataset.bound) {
    saveBtn.addEventListener("click", saveDraft);
    saveBtn.dataset.bound = "1";
  }

  if (sendChatBtn && !sendChatBtn.dataset.bound) {
    sendChatBtn.addEventListener("click", () => sendChatMessage(user, data));
    sendChatBtn.dataset.bound = "1";
  }

  if (form && !form.dataset.bound) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await submitCourse(user);
    });
    form.dataset.bound = "1";
  }

  await loadSubmissions(user.uid);
  await loadInstructorDrafts(user.uid);
  await loadPublishedCourses(user.uid);
  subscribeChat(user.uid);
});
