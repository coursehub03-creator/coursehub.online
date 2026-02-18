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
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

const DRAFT_KEY = "coursehub_instructor_course_draft_v3";

const form = document.getElementById("instructorCourseForm");
const statusEl = document.getElementById("instructorFormStatus");
const listEl = document.getElementById("instructorSubmissions");
const draftsListEl = document.getElementById("draftsList");
const approvedListEl = document.getElementById("approvedList");
const rejectedListEl = document.getElementById("rejectedList");
const publishedListEl = document.getElementById("publishedList");
const chatMessagesEl = document.getElementById("instructorChatMessages");
const chatInputEl = document.getElementById("instructorChatInput");
const sendChatBtn = document.getElementById("sendInstructorChatBtn");
const pendingCount = document.getElementById("pendingCount");
const approvedCount = document.getElementById("approvedCount");
let currentInstructorUid = "";

const coverInput = document.getElementById("courseImage");
const coverUrlInput = document.getElementById("courseImageUrl");
const coverPreview = document.getElementById("coverPreview");
const previewCover = document.getElementById("previewCover");

const functions = getFunctions(undefined, "us-central1");
const submitInstructorCourse = httpsCallable(functions, "submitInstructorCourse");

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


function formatDate(value) {
  if (!value) return "-";
  const date = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ar-EG");
}

function renderEmpty(el, msg) {
  if (!el) return;
  el.innerHTML = `<p>${msg}</p>`;
}

function fillBuilderFromSubmission(item = {}) {
  const setVal = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value ?? "";
  };

  setVal("courseTitle", item.title || "");
  setVal("courseTitleEn", item.titleEn || "");
  setVal("courseCategory", item.category || "");
  setVal("coursePrice", item.price || "");
  setVal("courseLevel", item.level || "مبتدئ");
  setVal("courseLanguage", item.language || "العربية");
  setVal("courseDuration", item.durationHours || "");
  setVal("courseDifficulty", item.difficulty || "متوازن");
  setVal("courseDescription", item.description || "");

  const loadRows = (containerId, values = []) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    (values.length ? values : [""]).forEach((v) => container.appendChild(createDynamicRow(v)));
  };

  loadRows("objectivesList", item.objectives || []);
  loadRows("requirementsList", item.requirements || []);
  loadRows("outcomesList", item.outcomes || []);

  const modulesContainer = document.getElementById("modulesContainer");
  if (modulesContainer) {
    modulesContainer.innerHTML = "";
    const modules = Array.isArray(item.modules) && item.modules.length ? item.modules : [{}];
    modules.forEach((module) => modulesContainer.appendChild(createModuleCard(module)));
  }

  const questionsContainer = document.getElementById("assessmentQuestions");
  if (questionsContainer) {
    questionsContainer.innerHTML = "";
    const questions = Array.isArray(item.assessmentQuestions) && item.assessmentQuestions.length ? item.assessmentQuestions : [{}];
    questions.forEach((q) => questionsContainer.appendChild(createQuestionCard(q)));
  }

  if (item.image) {
    if (coverPreview) coverPreview.src = item.image;
    if (previewCover) previewCover.src = item.image;
  }

  renderPreview();
  setBuilderTab("info");
  window.scrollTo({ top: 0, behavior: "smooth" });
  setStatus("تم تحميل بيانات الدورة المرفوضة للتعديل ثم إعادة الإرسال.");
}

function setupWorkspaceNav() {
  const links = document.querySelectorAll(".workspace-link");
  const panels = document.querySelectorAll(".workspace-panel");
  links.forEach((link) => {
    if (link.dataset.bound) return;
    link.addEventListener("click", () => {
      links.forEach((l) => l.classList.remove("active"));
      link.classList.add("active");

      if (link.dataset.action === "open-builder") {
        setBuilderTab(link.dataset.builderTab || "info");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      panels.forEach((p) => p.classList.remove("active"));
      document.getElementById(link.dataset.target)?.classList.add("active");
    });
    link.dataset.bound = "1";
  });
}

async function loadChat(uid) {
  if (!chatMessagesEl) return;
  try {
    const snap = await getDocs(query(collection(db, "instructorMessages"), where("instructorId", "==", uid)));
    const items = snap.docs.map((d) => d.data()).sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
    if (!items.length) {
      chatMessagesEl.innerHTML = "<p>لا توجد رسائل بعد.</p>";
      return;
    }

    chatMessagesEl.innerHTML = items.map((msg) => {
      const role = msg.senderRole === "admin" ? "admin" : "instructor";
      return `<div class="chat-bubble ${role}">${msg.text || ""}<div class="chat-meta">${role === "admin" ? "المشرف" : "أنت"} • ${formatDate(msg.createdAt)}</div></div>`;
    }).join("");
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  } catch (error) {
    console.warn("Could not load chat:", error);
    chatMessagesEl.innerHTML = "<p>تعذر تحميل الرسائل حالياً.</p>";
  }
}

async function loadSubmissions(uid) {
  try {
    const subSnap = await getDocs(query(collection(db, "instructorCourseSubmissions"), where("instructorId", "==", uid)));
    const submissions = subSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const p = submissions.filter((i) => i.status === "pending").length;
    const a = submissions.filter((i) => i.status === "approved").length;
    if (pendingCount) pendingCount.textContent = p;
    if (approvedCount) approvedCount.textContent = a;

    const approved = submissions.filter((i) => i.status === "approved");
    const rejected = submissions.filter((i) => i.status === "rejected");

    if (approvedListEl) {
      approvedListEl.innerHTML = approved.length
        ? approved.map((item) => `<div class="submission-item"><h4>${item.title || "-"}</h4><p>${statusBadge("approved")}</p><p>آخر تحديث: ${formatDate(item.updatedAt || item.reviewedAt || item.createdAt)}</p></div>`).join("")
        : "<p>لا توجد دورات مقبولة بعد.</p>";
    }

    if (rejectedListEl) {
      rejectedListEl.innerHTML = rejected.length
        ? rejected.map((item) => `<div class="submission-item"><h4>${item.title || "-"}</h4><p>${statusBadge("rejected")}</p><p class="reason">سبب الرفض: ${item.reviewReason || "غير محدد"}</p><div class="row-actions"><button type="button" class="btn ghost rejected-edit-btn" data-id="${item.id}">تعديل وإعادة الإرسال</button></div></div>`).join("")
        : "<p>لا توجد دورات مرفوضة.</p>";
    }

    rejectedListEl?.querySelectorAll('.rejected-edit-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = rejected.find((x) => x.id === btn.dataset.id);
        if (item) fillBuilderFromSubmission(item);
      });
    });

    if (listEl) {
      listEl.innerHTML = submissions.length
        ? submissions.map((item) => `<div class="submission-item"><h4>${item.title || "-"}</h4><p>${statusBadge(item.status || "pending")}</p><p>${item.reviewReason ? `ملاحظة الإدارة: ${item.reviewReason}` : ""}</p></div>`).join("")
        : "<p>لا توجد طلبات بعد.</p>";
    }
  } catch (error) {
    const denied = error?.code === "permission-denied" || String(error?.message || "").includes("Missing or insufficient permissions");
    if (!denied) console.warn("Could not load submissions:", error);
    if (pendingCount) pendingCount.textContent = "-";
    if (approvedCount) approvedCount.textContent = "-";
    renderEmpty(approvedListEl, "تعذر تحميل الدورات المقبولة.");
    renderEmpty(rejectedListEl, "تعذر تحميل الدورات المرفوضة.");
  }
}

async function loadInstructorDrafts(uid) {
  if (!draftsListEl) return;
  try {
    const snap = await getDoc(doc(db, "instructorCourseDrafts", uid));
    if (!snap.exists()) {
      draftsListEl.innerHTML = "<p>لا توجد مسودات سحابية بعد.</p>";
      return;
    }

    const data = snap.data() || {};
    draftsListEl.innerHTML = `<div class="submission-item"><h4>${data.title || "مسودة بدون عنوان"}</h4><p>آخر حفظ: ${formatDate(data.savedAt || data.updatedAt)}</p><div class="row-actions"><button type="button" class="btn ghost" id="loadCloudDraftBtn">فتح المسودة للتعديل</button></div></div>`;
    document.getElementById("loadCloudDraftBtn")?.addEventListener("click", () => fillBuilderFromSubmission(data));
  } catch (error) {
    console.warn("Could not load instructor drafts:", error);
    draftsListEl.innerHTML = "<p>تعذر تحميل المسودات حالياً.</p>";
  }
}

async function loadPublishedCourses(uid) {
  if (!publishedListEl) return;
  try {
    const coursesSnap = await getDocs(query(collection(db, "courses"), where("instructorId", "==", uid), where("status", "==", "published")));
    const courses = coursesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (!courses.length) {
      publishedListEl.innerHTML = "<p>لا توجد دورات منشورة بعد.</p>";
      return;
    }

    const certsSnap = await getDocs(collection(db, "certificates"));
    const certCount = new Map();
    certsSnap.forEach((docSnap) => {
      const c = docSnap.data();
      if (!c.courseId || !c.userId) return;
      certCount.set(c.courseId, (certCount.get(c.courseId) || 0) + 1);
    });

    publishedListEl.innerHTML = courses.map((course) => `<div class="submission-item"><h4>${course.title || "-"}</h4><p>${statusBadge("approved")}</p><p>عدد الطلبة الذين أنهوا الدورة وحصلوا على الشهادة: <strong>${certCount.get(course.id) || 0}</strong></p></div>`).join("");
  } catch (error) {
    console.warn("Could not load published courses:", error);
    publishedListEl.innerHTML = "<p>تعذر تحميل الدورات المنشورة.</p>";
  }
}


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
    tab.addEventListener("click", () => {
      setBuilderTab(tab.dataset.tab);
    });
  });
}

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
      });
      btn.dataset.bound = "1";
    }

    if (!container.children.length) container.appendChild(createDynamicRow());
  });
}

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
  (data.lessons || [{}]).forEach((lesson) => lessonsContainer?.appendChild(createLessonRow(lesson)));

  card.querySelector(".add-lesson-btn")?.addEventListener("click", () => {
    lessonsContainer?.appendChild(createLessonRow());
  });

  card.querySelector(".module-remove")?.addEventListener("click", () => {
    card.remove();
    renderPreview();
  });

  card.querySelector(".module-title")?.addEventListener("input", renderPreview);
  return card;
}

function gatherModules() {
  return [...document.querySelectorAll(".module-card")]
    .map((moduleCard) => {
      const title = moduleCard.querySelector(".module-title")?.value?.trim() || "";
      const lessons = [...moduleCard.querySelectorAll(".lesson-row")]
        .map((row) => ({
          title: row.querySelector(".lesson-title")?.value?.trim() || "",
          duration: Number(row.querySelector(".lesson-duration")?.value || 0)
        }))
        .filter((l) => l.title);
      return { title, lessons };
    })
    .filter((m) => m.title || m.lessons.length);
}

function initModules() {
  const modulesContainer = document.getElementById("modulesContainer");
  const addModuleBtn = document.getElementById("addModuleBtn");
  if (!modulesContainer || !addModuleBtn) return;

  if (!addModuleBtn.dataset.bound) {
    addModuleBtn.addEventListener("click", () => modulesContainer.appendChild(createModuleCard()));
    addModuleBtn.dataset.bound = "1";
  }
  if (!modulesContainer.children.length) modulesContainer.appendChild(createModuleCard());
}

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

  card.querySelector(".question-remove")?.addEventListener("click", () => card.remove());
  card.querySelectorAll("input,select").forEach((el) => el.addEventListener("input", renderPreview));
  return card;
}

function initAssessmentBuilder() {
  const container = document.getElementById("assessmentQuestions");
  const addBtn = document.getElementById("addQuestionBtn");
  if (!container || !addBtn) return;

  if (!addBtn.dataset.bound) {
    addBtn.addEventListener("click", () => container.appendChild(createQuestionCard()));
    addBtn.dataset.bound = "1";
  }
  if (!container.children.length) container.appendChild(createQuestionCard());
}

function gatherAssessmentQuestions() {
  return [...document.querySelectorAll(".question-card")]
    .map((card) => {
      const question = card.querySelector(".question-title")?.value?.trim() || "";
      const options = [...card.querySelectorAll(".q-option")].map((opt) => opt.value.trim());
      const correctIndex = Number(card.querySelector(".question-correct-index")?.value || 0);
      return { question, options, correctIndex };
    })
    .filter((q) => q.question && q.options.filter(Boolean).length >= 2);
}

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
    const modules = gatherModules();
    const lessonsCount = modules.reduce((acc, m) => acc + (m.lessons?.length || 0), 0);
    const questionsCount = gatherAssessmentQuestions().length;
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
    const modules = gatherModules();
    previewModules.innerHTML = modules.length
      ? modules
          .map(
            (m, index) => `
          <div class="preview-module">
            <h5>الوحدة ${index + 1}: ${m.title || "بدون عنوان"}</h5>
            <ul>
              ${
                m.lessons.length
                  ? m.lessons.map((l) => `<li>${l.title}${l.duration ? ` (${l.duration} دقيقة)` : ""}</li>`).join("")
                  : "<li>لا توجد دروس داخل هذه الوحدة بعد.</li>"
              }
            </ul>
          </div>
        `
          )
          .join("")
      : "<p>لا توجد وحدات بعد.</p>";
  }
}

function bindPreviewInputs() {
  ["courseTitle", "courseDescription", "courseCategory", "courseLevel", "courseLanguage", "courseDuration", "coursePrice"]
    .forEach((id) => {
      document.getElementById(id)?.addEventListener("input", renderPreview);
      document.getElementById(id)?.addEventListener("change", renderPreview);
    });
}

function setupCoverPreview() {
  coverInput?.addEventListener("change", () => {
    const file = coverInput.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (coverPreview) coverPreview.src = url;
    if (previewCover) previewCover.src = url;
  });

  coverUrlInput?.addEventListener("input", () => {
    const url = coverUrlInput.value.trim();
    if (!url) return;
    if (coverPreview) coverPreview.src = url;
    if (previewCover) previewCover.src = url;
  });
}

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
    modules: gatherModules(),
    assessmentQuestions: gatherAssessmentQuestions(),
    updatedAt: new Date().toISOString()
  };

  localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));

  if (currentInstructorUid) {
    try {
      await setDoc(doc(db, "instructorCourseDrafts", currentInstructorUid), {
        ...payload,
        instructorId: currentInstructorUid,
        savedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.warn("Cloud draft save failed:", error);
    }
  }

  setStatus("✅ تم حفظ المسودة (محليًا + سحابيًا لحسابك).");
}

async function loadDraft(uid) {
  let draft = null;
  try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY)); } catch { draft = null; }

  if (!draft && uid) {
    try {
      const cloudDraft = await getDoc(doc(db, "instructorCourseDrafts", uid));
      if (cloudDraft.exists()) {
        draft = cloudDraft.data();
      }
    } catch (error) {
      console.warn("Could not load cloud draft:", error);
    }
  }

  if (!draft) return;

  const setVal = (id, value) => {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null) el.value = value;
  };

  setVal("courseTitle", draft.title);
  setVal("courseTitleEn", draft.titleEn);
  setVal("courseCategory", draft.category);
  setVal("coursePrice", draft.price);
  setVal("courseLevel", draft.level);
  setVal("courseLanguage", draft.language);
  setVal("courseDuration", draft.duration);
  setVal("courseDifficulty", draft.difficulty);
  setVal("courseDescription", draft.description);
  setVal("courseImageUrl", draft.imageUrl);

  const loadRows = (containerId, values = []) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    (values.length ? values : [""]).forEach((v) => container.appendChild(createDynamicRow(v)));
  };

  loadRows("objectivesList", draft.objectives || []);
  loadRows("requirementsList", draft.requirements || []);
  loadRows("outcomesList", draft.outcomes || []);

  const modulesContainer = document.getElementById("modulesContainer");
  if (modulesContainer) {
    modulesContainer.innerHTML = "";
    const modules = Array.isArray(draft.modules) && draft.modules.length ? draft.modules : [{}];
    modules.forEach((module) => modulesContainer.appendChild(createModuleCard(module)));
  }

  const questionsContainer = document.getElementById("assessmentQuestions");
  if (questionsContainer) {
    questionsContainer.innerHTML = "";
    const questions = Array.isArray(draft.assessmentQuestions) && draft.assessmentQuestions.length
      ? draft.assessmentQuestions
      : [{}];
    questions.forEach((q) => questionsContainer.appendChild(createQuestionCard(q)));
  }

  if (draft.imageUrl) {
    if (coverPreview) coverPreview.src = draft.imageUrl;
    if (previewCover) previewCover.src = draft.imageUrl;
  }

  setStatus("تم استعادة آخر مسودة محفوظة.");
}

function allReviewChecksMarked() {
  const checks = [...document.querySelectorAll(".review-check")];
  return checks.every((check) => check.checked);
}

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

function resetBuilderState() {
  form?.reset();
  ["objectivesList", "requirementsList", "outcomesList", "assessmentQuestions"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });

  const modulesContainer = document.getElementById("modulesContainer");
  if (modulesContainer) modulesContainer.innerHTML = "";

  initDynamicLists();
  initModules();
  initAssessmentBuilder();

  if (coverPreview) coverPreview.src = "/assets/images/default-course.png";
  if (previewCover) previewCover.src = "/assets/images/default-course.png";
  document.querySelectorAll(".review-check").forEach((check) => (check.checked = false));
}

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
}

  currentInstructorUid = user.uid;

  setupTabs();
  setupWorkspaceNav();
  initDynamicLists();
  initModules();
  initAssessmentBuilder();
  bindPreviewInputs();
  setupCoverPreview();
  initDescriptionToolbar();
  await loadDraft(user.uid);
  renderPreview();

  document.getElementById("saveDraftBtn")?.addEventListener("click", saveDraft);
  await loadSubmissions(user.uid);
  await loadInstructorDrafts(user.uid);
  await loadPublishedCourses(user.uid);
  await loadChat(user.uid);

  sendChatBtn?.addEventListener("click", async () => {
    const text = chatInputEl?.value?.trim();
    if (!text) return;
    try {
      await addDoc(collection(db, "instructorMessages"), {
        instructorId: user.uid,
        instructorEmail: user.email || "",
        senderId: user.uid,
        senderRole: "instructor",
        text,
        createdAt: serverTimestamp()
      });
      if (chatInputEl) chatInputEl.value = "";
      await loadChat(user.uid);
    } catch (error) {
      console.error("Failed to send chat message:", error);
      setStatus("تعذر إرسال الرسالة للمشرف حالياً.", true);
    }
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!allReviewChecksMarked()) {
      setStatus("⚠️ أكمل قائمة المراجعة قبل إرسال الدورة.", true);
      return;
    }

    const title = document.getElementById("courseTitle")?.value?.trim();
    const description = document.getElementById("courseDescription")?.value?.trim();
    const category = document.getElementById("courseCategory")?.value?.trim();
    const modules = gatherModules();
    const assessmentQuestions = gatherAssessmentQuestions();

    if (!title || !description || !category) {
      setStatus("يرجى إدخال العنوان + الوصف + التصنيف على الأقل.", true);
      return;
    }

    if (!modules.length) {
      setStatus("أضف وحدة واحدة على الأقل مع درس قبل الإرسال.", true);
      return;
    }

    if (!assessmentQuestions.length) {
      setStatus("أضف سؤالين على الأقل في اختبار الدورة قبل الإرسال.", true);
      return;
    }

    if (assessmentQuestions.length < 2) {
      setStatus("الحد الأدنى المطلوب هو سؤالان في الاختبار.", true);
      return;
    }

    setStatus("جاري رفع الطلب...");

    try {
      const { imageUrl, outlineUrl } = await uploadFiles(user);

      const payload = {
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
        modules,
        assessmentQuestions,
        image: imageUrl,
        outlineUrl
      };

      try {
        await submitInstructorCourse(payload);
      } catch (callableError) {
        console.error("submitInstructorCourse callable failed:", callableError);
        const code = String(callableError?.code || "");
        const msg = String(callableError?.message || "");
        const functionNotReady = code.includes("unavailable")
          || code.includes("not-found")
          || msg.includes("not-found")
          || msg.includes("internal")
          || msg.includes("Failed to fetch");

        if (functionNotReady) {
          throw new Error("callable-not-ready");
        }

        throw callableError;
      }

      localStorage.removeItem(DRAFT_KEY);
      setStatus("✅ تم إرسال الدورة للمراجعة بنجاح. ستظهر للمشرف ضمن طلبات المراجعة.");
      resetBuilderState();
      renderPreview();
      await loadSubmissions(user.uid);
    } catch (err) {
      console.error(err);
      const denied = err?.code === "permission-denied" || err?.message?.includes("Missing or insufficient permissions");
      const callableNotReady = err?.message?.includes("callable-not-ready");
      if (callableNotReady) {
        setStatus("❌ خدمة الإرسال غير جاهزة حالياً. تأكد من نشر آخر نسخة من Cloud Functions وربطها بالمنطقة us-central1 (submitInstructorCourse).", true);
      } else if (denied) {
        setStatus("❌ تم رفض الإرسال بسبب الصلاحيات. استخدم مسار Cloud Function المنشور على us-central1 وتأكد أن حساب الأستاذ مفعل.", true);
      } else {
        setStatus("❌ تعذر إرسال الدورة. تحقق من الملفات وحاول مرة أخرى.", true);
      }
    }

    if (!container.children.length) container.appendChild(createDynamicRow());
  });
}

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
  (data.lessons || [{}]).forEach((lesson) => lessonsContainer?.appendChild(createLessonRow(lesson)));

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
  return [...document.querySelectorAll(".module-card")]
    .map((moduleCard) => {
      const title = moduleCard.querySelector(".module-title")?.value?.trim() || "";
      const lessons = [...moduleCard.querySelectorAll(".lesson-row")]
        .map((row) => ({
          title: row.querySelector(".lesson-title")?.value?.trim() || "",
          duration: Number(row.querySelector(".lesson-duration")?.value || 0)
        }))
        .filter((l) => l.title);
      return { title, lessons };
    })
    .filter((m) => m.title || m.lessons.length);
}

function initModules() {
  const modulesContainer = document.getElementById("modulesContainer");
  const addModuleBtn = document.getElementById("addModuleBtn");
  if (!modulesContainer || !addModuleBtn) return;

  if (!addModuleBtn.dataset.bound) {
    addModuleBtn.addEventListener("click", () => {
      modulesContainer.appendChild(createModuleCard());
      renderPreview();
    });
    addModuleBtn.dataset.bound = "1";
  }

  if (!modulesContainer.children.length) modulesContainer.appendChild(createModuleCard());
}

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
  const container = document.getElementById("assessmentQuestions");
  const addBtn = document.getElementById("addQuestionBtn");
  if (!container || !addBtn) return;

  if (!addBtn.dataset.bound) {
    addBtn.addEventListener("click", () => {
      container.appendChild(createQuestionCard());
      renderPreview();
    });
    addBtn.dataset.bound = "1";
  }

  if (!container.children.length) container.appendChild(createQuestionCard());
}

function gatherAssessmentQuestions() {
  return [...document.querySelectorAll(".question-card")]
    .map((card) => {
      const question = card.querySelector(".question-title")?.value?.trim() || "";
      const options = [...card.querySelectorAll(".q-option")].map((opt) => opt.value.trim());
      const correctIndex = Number(card.querySelector(".question-correct-index")?.value || 0);
      return { question, options, correctIndex };
    })
    .filter((q) => q.question && q.options.filter(Boolean).length >= 2);
}

/* ===== preview ===== */
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
    const modules = gatherModules();
    const lessonsCount = modules.reduce((acc, m) => acc + (m.lessons?.length || 0), 0);
    const questionsCount = gatherAssessmentQuestions().length;

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
    const modules = gatherModules();
    previewModules.innerHTML = modules.length
      ? modules
          .map(
            (m, index) => `
            <div class="preview-module">
              <h5>الوحدة ${index + 1}: ${m.title || "بدون عنوان"}</h5>
              <ul>
                ${
                  m.lessons.length
                    ? m.lessons
                        .map((l) => `<li>${l.title}${l.duration ? ` (${l.duration} دقيقة)` : ""}</li>`)
                        .join("")
                    : "<li>لا توجد دروس داخل هذه الوحدة بعد.</li>"
                }
              </ul>
            </div>
          `
          )
          .join("")
      : "<p>لا توجد وحدات بعد.</p>";
  }
}

function bindPreviewInputs() {
  ["courseTitle", "courseDescription", "courseCategory", "courseLevel", "courseLanguage", "courseDuration", "coursePrice"]
    .forEach((id) => {
      document.getElementById(id)?.addEventListener("input", renderPreview);
      document.getElementById(id)?.addEventListener("change", renderPreview);
    });
}

/* ===== cover ===== */
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

/* ===== draft save/load (local + cloud) ===== */
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
    modules: gatherModules(),
    assessmentQuestions: gatherAssessmentQuestions(),
    updatedAt: new Date().toISOString()
  };

  // 1) local
  localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));

  // 2) cloud (اختياري حسب rules)
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

  // 1) local first
  try {
    draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
  } catch {
    draft = null;
  }

  // 2) cloud fallback
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
  setStatus("تم استعادة آخر مسودة محفوظة.");
}

/* ===== upload ===== */
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

/* ===== fill builder from submission/draft ===== */
function fillBuilderFromSubmission(item = {}) {
  const setVal = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value ?? "";
  };

  setVal("courseTitle", item.title || "");
  setVal("courseTitleEn", item.titleEn || "");
  setVal("courseCategory", item.category || "");
  setVal("coursePrice", item.price || "");
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

  const modulesContainer = document.getElementById("modulesContainer");
  if (modulesContainer) {
    modulesContainer.innerHTML = "";
    const modules = Array.isArray(item.modules) && item.modules.length ? item.modules : [{}];
    modules.forEach((module) => modulesContainer.appendChild(createModuleCard(module)));
  }

  const questionsContainer = document.getElementById("assessmentQuestions");
  if (questionsContainer) {
    questionsContainer.innerHTML = "";
    const questions =
      Array.isArray(item.assessmentQuestions) && item.assessmentQuestions.length ? item.assessmentQuestions : [{}];
    questions.forEach((q) => questionsContainer.appendChild(createQuestionCard(q)));
  }

  const image = item.image || item.imageUrl || "";
  if (image) {
    if (coverPreview) coverPreview.src = image;
    if (previewCover) previewCover.src = image;
  }

  renderPreview();

  // switch to info tab
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
  document.querySelector('.tab-btn[data-tab="info"]')?.classList.add("active");
  document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
  document.getElementById("tab-info")?.classList.add("active");

  window.scrollTo({ top: 0, behavior: "smooth" });
  setStatus("تم تحميل بيانات الدورة للتعديل.");
}

/* ===== submit + reset ===== */
function allReviewChecksMarked() {
  const checks = [...document.querySelectorAll(".review-check")];
  return checks.every((check) => check.checked);
}

function resetBuilderState() {
  form?.reset();

  ["objectivesList", "requirementsList", "outcomesList", "assessmentQuestions"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });

  const modulesContainer = document.getElementById("modulesContainer");
  if (modulesContainer) modulesContainer.innerHTML = "";

  initDynamicLists();
  initModules();
  initAssessmentBuilder();

  if (coverPreview) coverPreview.src = "/assets/images/default-course.png";
  if (previewCover) previewCover.src = "/assets/images/default-course.png";

  document.querySelectorAll(".review-check").forEach((check) => (check.checked = false));
  renderPreview();
}

async function submitCourse(user) {
  if (!allReviewChecksMarked()) {
    setStatus("⚠️ أكمل قائمة المراجعة قبل إرسال الدورة.", true);
    return;
  }

  const title = document.getElementById("courseTitle")?.value?.trim();
  const description = document.getElementById("courseDescription")?.value?.trim();
  const category = document.getElementById("courseCategory")?.value?.trim();
  const modules = gatherModules();
  const assessmentQuestions = gatherAssessmentQuestions();

  if (!title || !description || !category) {
    setStatus("يرجى إدخال العنوان + الوصف + التصنيف على الأقل.", true);
    return;
  }

  if (!modules.length) {
    setStatus("أضف وحدة واحدة على الأقل مع درس قبل الإرسال.", true);
    return;
  }

  if (assessmentQuestions.length < 2) {
    setStatus("الحد الأدنى المطلوب هو سؤالان في الاختبار.", true);
    return;
  }

  setStatus("جاري رفع الطلب...");

  try {
    const { imageUrl, outlineUrl } = await uploadFiles(user);

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
      modules,
      assessmentQuestions,
      image: imageUrl,
      outlineUrl
    };

    try {
      await submitInstructorCourse(payload);
    } catch (callableError) {
      console.error("submitInstructorCourse callable failed:", callableError);

      const code = String(callableError?.code || "");
      const msg = String(callableError?.message || "");
      const functionNotReady =
        code.includes("unavailable") ||
        code.includes("not-found") ||
        msg.includes("not-found") ||
        msg.includes("internal") ||
        msg.includes("Failed to fetch");

      if (functionNotReady) throw new Error("callable-not-ready");
      throw callableError;
    }

    localStorage.removeItem(DRAFT_KEY);
    setStatus("✅ تم إرسال الدورة للمراجعة بنجاح. ستظهر للمشرف ضمن طلبات المراجعة.");
    resetBuilderState();
    await loadSubmissions(user.uid);
    await loadInstructorDrafts(user.uid);
    await loadPublishedCourses(user.uid);
    await loadChat(user.uid);
  } catch (err) {
    console.error(err);

    const denied =
      err?.code === "permission-denied" ||
      String(err?.message || "").includes("Missing or insufficient permissions");

    const callableNotReady = String(err?.message || "").includes("callable-not-ready");

    if (callableNotReady) {
      setStatus(
        "❌ خدمة الإرسال غير جاهزة حالياً. تأكد من نشر آخر نسخة من Cloud Functions وربطها بالمنطقة us-central1 (submitInstructorCourse).",
        true
      );
      return;
    }

    if (denied) {
      setStatus(
        "❌ تم رفض الإرسال بسبب الصلاحيات. تأكد أن Cloud Function منشورة وتتحقق من دور الأستاذ (instructor) وحالته (active).",
        true
      );
      return;
    }

    setStatus("❌ تعذر إرسال الدورة. تحقق من الملفات وحاول مرة أخرى.", true);
  }
}

/* ===== auth gate + init ===== */
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
  initDynamicLists();
  initModules();
  initAssessmentBuilder();
  bindPreviewInputs();
  setupCoverPreview();
  initDescriptionToolbar();

  await loadDraft(user.uid);
  renderPreview();

  // save draft (avoid double bind)
  const saveBtn = document.getElementById("saveDraftBtn");
  if (saveBtn && !saveBtn.dataset.bound) {
    saveBtn.addEventListener("click", saveDraft);
    saveBtn.dataset.bound = "1";
  }

  // send chat (avoid double bind)
  if (sendChatBtn && !sendChatBtn.dataset.bound) {
    sendChatBtn.addEventListener("click", () => sendChatMessage(user));
    sendChatBtn.dataset.bound = "1";
  }

  // submit (avoid double bind)
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
  await loadChat(user.uid);
});
