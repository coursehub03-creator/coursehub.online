import { auth, db, storage } from "/js/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const DRAFT_KEY = "coursehub_instructor_course_draft_v2";

const form = document.getElementById("instructorCourseForm");
const statusEl = document.getElementById("instructorFormStatus");
const listEl = document.getElementById("instructorSubmissions");
const pendingCount = document.getElementById("pendingCount");
const approvedCount = document.getElementById("approvedCount");

const coverInput = document.getElementById("courseImage");
const coverUrlInput = document.getElementById("courseImageUrl");
const coverPreview = document.getElementById("coverPreview");
const previewCover = document.getElementById("previewCover");

function statusBadge(status) {
  const map = { pending: "قيد المراجعة", approved: "معتمدة", rejected: "مرفوضة" };
  return `<span class="badge ${status}">${map[status] || status}</span>`;
}

function setStatus(msg, isError = false) {
  if (!statusEl) return;
  statusEl.style.color = isError ? "#b91c1c" : "#1d4ed8";
  statusEl.textContent = msg || "";
}

async function loadSubmissions(uid) {
  const q = query(collection(db, "instructorCourseSubmissions"), where("instructorId", "==", uid));
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const p = items.filter((i) => i.status === "pending").length;
  const a = items.filter((i) => i.status === "approved").length;
  if (pendingCount) pendingCount.textContent = p;
  if (approvedCount) approvedCount.textContent = a;

  if (!listEl) return;
  if (!items.length) {
    listEl.innerHTML = "<p>لا توجد طلبات بعد.</p>";
    return;
  }

  listEl.innerHTML = items
    .map(
      (item) => `
    <div class="submission-item">
      <h4>${item.title}</h4>
      <p>${statusBadge(item.status || "pending")}</p>
      <p>السعر: ${item.price ?? 0}$</p>
      <p>التصنيف: ${item.category || "-"}</p>
      <p>المستوى: ${item.level || "-"} | اللغة: ${item.language || "-"}</p>
      <p>${item.reviewReason ? `ملاحظة الإدارة: ${item.reviewReason}` : ""}</p>
    </div>
  `
    )
    .join("");
}

function setupTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
  const contents = document.querySelectorAll(".tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      contents.forEach((c) => c.classList.remove("active"));
      document.getElementById(`tab-${target}`)?.classList.add("active");
      renderPreview();
    });
  });
}

function createDynamicRow(value = "") {
  const row = document.createElement("div");
  row.className = "dynamic-row";
  row.innerHTML = `
    <input type="text" value="${value.replace(/"/g, "&quot;")}" placeholder="اكتب هنا..." />
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
    btn?.addEventListener("click", () => {
      container.appendChild(createDynamicRow());
    });

    container.appendChild(createDynamicRow());
  });
}

function createLessonRow(data = {}) {
  const row = document.createElement("div");
  row.className = "lesson-row";
  row.innerHTML = `
    <input type="text" class="lesson-title" placeholder="عنوان الدرس" value="${(data.title || "").replace(/"/g, "&quot;")}" />
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
      <input type="text" class="module-title" placeholder="اسم الوحدة" value="${(data.title || "").replace(/"/g, "&quot;")}" />
      <button type="button" class="btn ghost add-lesson-btn"><i class="fa-solid fa-plus"></i> إضافة درس</button>
      <button type="button" class="icon-btn" title="حذف الوحدة"><i class="fa-solid fa-trash"></i></button>
    </div>
    <div class="module-lessons"></div>
  `;

  const lessonsContainer = card.querySelector(".module-lessons");

  (data.lessons || [{}]).forEach((lesson) => {
    lessonsContainer?.appendChild(createLessonRow(lesson));
  });

  card.querySelector(".add-lesson-btn")?.addEventListener("click", () => {
    lessonsContainer?.appendChild(createLessonRow());
  });

  card.querySelector(".icon-btn")?.addEventListener("click", () => {
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

  addModuleBtn.addEventListener("click", () => {
    modulesContainer.appendChild(createModuleCard());
  });

  modulesContainer.appendChild(createModuleCard());
}

function renderPreview() {
  const previewTitle = document.getElementById("previewTitle");
  const previewDescription = document.getElementById("previewDescription");
  const previewMeta = document.getElementById("previewMeta");
  const previewObjectives = document.getElementById("previewObjectives");
  const previewModules = document.getElementById("previewModules");

  const title = document.getElementById("courseTitle")?.value?.trim() || "";
  const description = document.getElementById("courseDescription")?.value?.trim() || "";
  const category = document.getElementById("courseCategory")?.value?.trim() || "";
  const level = document.getElementById("courseLevel")?.value || "";
  const language = document.getElementById("courseLanguage")?.value || "";
  const duration = document.getElementById("courseDuration")?.value || "";
  const price = document.getElementById("coursePrice")?.value || "";

  if (previewTitle) previewTitle.textContent = title || "عنوان الدورة";
  if (previewDescription) {
    previewDescription.textContent = description || "سيظهر وصف الدورة هنا بعد إدخاله.";
  }

  if (previewMeta) {
    const chips = [
      category ? `التصنيف: ${category}` : "",
      level ? `المستوى: ${level}` : "",
      language ? `اللغة: ${language}` : "",
      duration ? `المدة: ${duration} ساعة` : "",
      price ? `السعر: ${price}$` : ""
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
  [
    "courseTitle",
    "courseDescription",
    "courseCategory",
    "courseLevel",
    "courseLanguage",
    "courseDuration",
    "coursePrice"
  ].forEach((id) => {
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

function saveDraft() {
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
    updatedAt: new Date().toISOString()
  };

  localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  setStatus("✅ تم حفظ المسودة محليًا على متصفحك.");
}

function loadDraft() {
  let draft = null;
  try {
    draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
  } catch {
    draft = null;
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
    if (!values.length) {
      container.appendChild(createDynamicRow());
      return;
    }
    values.forEach((v) => container.appendChild(createDynamicRow(v)));
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

  setupTabs();
  initDynamicLists();
  initModules();
  bindPreviewInputs();
  setupCoverPreview();
  loadDraft();
  renderPreview();

  document.getElementById("saveDraftBtn")?.addEventListener("click", saveDraft);

  await loadSubmissions(user.uid);

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!allReviewChecksMarked()) {
      setStatus("⚠️ أكمل قائمة المراجعة قبل إرسال الدورة.", true);
      return;
    }

    const title = document.getElementById("courseTitle")?.value?.trim();
    const description = document.getElementById("courseDescription")?.value?.trim();
    const price = Number(document.getElementById("coursePrice")?.value || 0);
    const category = document.getElementById("courseCategory")?.value?.trim();

    if (!title || !description || !category) {
      setStatus("يرجى إدخال العنوان + الوصف + التصنيف على الأقل.", true);
      return;
    }

    setStatus("جاري رفع الطلب...");

    try {
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

      const modules = gatherModules();
      const objectives = getListValues("objectivesList");
      const requirements = getListValues("requirementsList");
      const outcomes = getListValues("outcomesList");

      await addDoc(collection(db, "instructorCourseSubmissions"), {
        instructorId: user.uid,
        instructorEmail: user.email,
        title,
        titleEn: document.getElementById("courseTitleEn")?.value?.trim() || "",
        description,
        category,
        price,
        level: document.getElementById("courseLevel")?.value || "",
        language: document.getElementById("courseLanguage")?.value || "",
        durationHours: Number(document.getElementById("courseDuration")?.value || 0),
        difficulty: document.getElementById("courseDifficulty")?.value || "",
        objectives,
        requirements,
        outcomes,
        modules,
        image: imageUrl,
        outlineUrl,
        status: "pending",
        reviewReason: "",
        createdAt: serverTimestamp()
      });

      localStorage.removeItem(DRAFT_KEY);
      setStatus("✅ تم إرسال الدورة للمراجعة بنجاح.");
      form.reset();

      ["objectivesList", "requirementsList", "outcomesList"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          el.innerHTML = "";
          el.appendChild(createDynamicRow());
        }
      });

      const modulesContainer = document.getElementById("modulesContainer");
      if (modulesContainer) {
        modulesContainer.innerHTML = "";
        modulesContainer.appendChild(createModuleCard());
      }
      if (coverPreview) coverPreview.src = "/assets/images/default-course.png";
      if (previewCover) previewCover.src = "/assets/images/default-course.png";
      document.querySelectorAll(".review-check").forEach((check) => {
        check.checked = false;
      });

      renderPreview();
      await loadSubmissions(user.uid);
    } catch (err) {
      console.error(err);
      setStatus("❌ تعذر إرسال الدورة. تحقق من الملفات وحاول مرة أخرى.", true);
    }
  });
});
