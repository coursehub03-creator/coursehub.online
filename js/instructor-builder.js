import { auth, db, storage } from "/js/firebase-config.js";
import { collection, addDoc, getDocs, query, where, orderBy, limit, serverTimestamp, setDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const steps = ["Basic Info", "Media", "Curriculum", "Pricing", "Landing", "Review"];
let currentStep = 0;
let lessons = [];
let currentUser = null;
let uploadedCoverUrl = "";
let uploadedVideoUrl = "";
const key = "coursehub_builder_v4";

const val = (id) => document.getElementById(id)?.value || "";

function stepDots() {
  const wrap = document.getElementById("builderSteps");
  if (!wrap) return;
  wrap.innerHTML = steps
    .map((s, i) => `<span class="step-dot ${i === currentStep ? "active" : ""}">${i + 1}. ${s}</span>`)
    .join("");
  document.querySelectorAll(".wizard-panel").forEach((p, i) => {
    p.hidden = i !== currentStep;
  });
}

function renderLessons() {
  const root = document.getElementById("lessons");
  if (!root) return;
  root.innerHTML = lessons
    .map(
      (l, i) => `
    <div class="lesson-row">
      <input class="ch-input" value="${l.title}" data-i="${i}" data-f="title" aria-label="عنوان الدرس">
      <select class="ch-select" data-i="${i}" data-f="type" aria-label="نوع الدرس">
        <option ${l.type === "video" ? "selected" : ""}>video</option>
        <option ${l.type === "text" ? "selected" : ""}>text</option>
        <option ${l.type === "quiz" ? "selected" : ""}>quiz</option>
        <option ${l.type === "assignment" ? "selected" : ""}>assignment</option>
      </select>
      <select class="ch-select" data-i="${i}" data-f="status" aria-label="حالة الدرس">
        <option ${l.status === "draft" ? "selected" : ""}>draft</option>
        <option ${l.status === "published" ? "selected" : ""}>published</option>
      </select>
      <div>
        <button class="ch-btn secondary" type="button" data-move="up" data-i="${i}">↑</button>
        <button class="ch-btn secondary" type="button" data-move="down" data-i="${i}">↓</button>
      </div>
    </div>`
    )
    .join("");
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
    status: "draft"
  };
}

function completionScore(st) {
  const checks = [
    st.title,
    st.category,
    st.description,
    st.cover,
    st.price >= 0,
    st.headline,
    st.lessons.length > 0
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function refreshSidebar() {
  const st = collectState();
  const score = completionScore(st);

  document.getElementById("completion").textContent = `${score}%`;
  document.getElementById("moduleCount").textContent = st.lessons.length;
  document.getElementById("publishedLessons").textContent = st.lessons.filter((l) => l.status === "published").length;

  const missing = [];
  if (!st.title) missing.push("أضف عنوان الدورة");
  if (!st.description) missing.push("أضف وصفاً تفصيلياً");
  if (!st.cover) missing.push("أضف صورة الغلاف");
  if (!st.lessons.length) missing.push("أضف درساً واحداً على الأقل");

  document.getElementById("missingChecklist").innerHTML =
    missing.map((m) => `<li>${m}</li>`).join("") || "<li>جاهز للإرسال ✅</li>";

  document.getElementById("qualityScore").textContent = `Quality score: ${score}/100`;
  document.getElementById("missing").textContent = missing.length
    ? `حقول ناقصة: ${missing.join("، ")}`
    : "كل شيء جاهز للإرسال.";
}

function toast(msg) {
  const d = document.createElement("div");
  d.className = "ch-toast";
  d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 1800);
}

async function uploadFile(file, type) {
  if (!currentUser || !file) return "";
  const path = `instructor-courses/${currentUser.uid}/${type}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

async function handleMediaPreview() {
  const coverFile = document.getElementById("coverFile")?.files?.[0];
  const videoFile = document.getElementById("previewVideoFile")?.files?.[0];

  if (coverFile) {
    const localUrl = URL.createObjectURL(coverFile);
    document.getElementById("coverPreview").src = localUrl;
    try {
      uploadedCoverUrl = await uploadFile(coverFile, "images");
      document.getElementById("cover").value = uploadedCoverUrl;
      toast("تم رفع صورة الغلاف بنجاح");
    } catch {
      toast("تعذر رفع صورة الغلاف الآن، سيتم استخدام المعاينة المحلية");
    }
  }

  if (videoFile) {
    const localVideo = URL.createObjectURL(videoFile);
    document.getElementById("videoPreview").src = localVideo;
    try {
      uploadedVideoUrl = await uploadFile(videoFile, "videos");
      document.getElementById("previewVideo").value = uploadedVideoUrl;
      toast("تم رفع الفيديو التعريفي بنجاح");
    } catch {
      toast("تعذر رفع الفيديو الآن، سيتم استخدام المعاينة المحلية");
    }
  }

  saveDraft(false);
}

async function saveDraft(showToast = false) {
  const st = collectState();
  localStorage.setItem(key, JSON.stringify(st));
  document.getElementById("lastSaved").textContent = new Date().toLocaleTimeString("ar");

  if (currentUser) {
    try {
      await setDoc(
        doc(db, "instructorCourseDrafts", currentUser.uid),
        {
          ...st,
          instructorId: currentUser.uid,
          instructorEmail: currentUser.email || "",
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    } catch (e) {
      console.warn("تعذر حفظ المسودة في Firestore", e);
    }
  }

  if (showToast) toast("تم حفظ المسودة بنجاح");
  refreshSidebar();
}

function restore() {
  const raw = localStorage.getItem(key);
  if (!raw) return;

  const st = JSON.parse(raw);
  Object.entries(st).forEach(([k, v]) => {
    if (document.getElementById(k) && typeof v !== "object") {
      document.getElementById(k).value = v;
    }
  });

  lessons = st.lessons || [];

  if (st.cover) {
    document.getElementById("coverPreview").src = st.cover;
  }

  if (st.previewVideo) {
    document.getElementById("videoPreview").src = st.previewVideo;
  }
}

async function loadFeedback() {
  if (!currentUser) return;

  const el = document.getElementById("submissionFeedback");
  const hint = document.getElementById("reviewStatusHint");

  try {
    const snap = await getDocs(
      query(
        collection(db, "instructorCourseSubmissions"),
        where("instructorId", "==", currentUser.uid),
        orderBy("createdAt", "desc"),
        limit(5)
      )
    );

    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (!items.length) {
      el.textContent = "لا توجد مراجعات بعد.";
      return;
    }

    el.innerHTML = items
      .map(
        (i) => `
        <div style="padding:6px 0;border-bottom:1px solid var(--color-border)">
          <strong>${i.title || "-"}</strong>
          <span class="ch-badge ${i.status === "pending" ? "in_review" : i.status}">${i.status || "pending"}</span>
          ${i.reviewReason ? `<p>السبب: ${i.reviewReason}</p>` : ""}
        </div>`
      )
      .join("");

    const latest = items[0];
    if (latest.status === "rejected") {
      hint.textContent = `آخر قرار: تم الرفض. السبب: ${latest.reviewReason || "غير محدد"}. يرجى التعديل وإعادة الإرسال.`;
    } else if (latest.status === "approved") {
      hint.textContent = "آخر قرار: تم قبول الدورة ونقلها لمسودة المشرف، يمكنك متابعة حالة النشر من صفحة دوراتي.";
    } else {
      hint.textContent = "آخر قرار: الدورة قيد المراجعة لدى المسؤول.";
    }
  } catch (e) {
    el.textContent = "تعذر تحميل المراجعات حالياً.";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  restore();
  stepDots();
  renderLessons();
  refreshSidebar();

  auth.onAuthStateChanged((u) => {
    currentUser = u;
  });

  document.getElementById("coverFile")?.addEventListener("change", handleMediaPreview);
  document.getElementById("previewVideoFile")?.addEventListener("change", handleMediaPreview);

  document.getElementById("addLesson").addEventListener("click", () => {
    lessons.push({
      title: `Lesson ${lessons.length + 1}`,
      type: "video",
      status: "draft"
    });
    renderLessons();
    saveDraft();
  });

  document.getElementById("lessons").addEventListener("input", (e) => {
    const i = Number(e.target.dataset.i);
    const f = e.target.dataset.f;
    if (Number.isInteger(i) && f) {
      lessons[i][f] = e.target.value;
    }
    saveDraft();
  });

  document.getElementById("lessons").addEventListener("click", (e) => {
    const b = e.target.closest("[data-move]");
    if (!b) return;

    const i = Number(b.dataset.i);
    const t = b.dataset.move === "up" ? i - 1 : i + 1;

    if (t < 0 || t >= lessons.length) return;

    [lessons[i], lessons[t]] = [lessons[t], lessons[i]];
    renderLessons();
    saveDraft();
  });

  document.getElementById("nextStep").addEventListener("click", () => {
    currentStep = Math.min(steps.length - 1, currentStep + 1);
    stepDots();
    refreshSidebar();
    loadFeedback();
  });

  document.getElementById("prevStep").addEventListener("click", () => {
    currentStep = Math.max(0, currentStep - 1);
    stepDots();
  });

  document.getElementById("saveDraft").addEventListener("click", () => saveDraft(true));
  document.getElementById("builderForm").addEventListener("input", () => saveDraft(false));

  document.getElementById("builderForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const st = collectState();
    if (!currentUser) {
      return toast("يرجى تسجيل الدخول كأستاذ أولاً");
    }

    try {
      await addDoc(collection(db, "instructorCourseSubmissions"), {
        ...st,
        status: "pending",
        instructorId: currentUser.uid,
        instructorEmail: currentUser.email || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      document.getElementById("courseState").textContent = "in_review";
      document.getElementById("courseState").className = "ch-badge in_review";
      toast("تم إرسال الدورة للمراجعة لدى المسؤول");
      await loadFeedback();
    } catch (err) {
      console.error(err);
      toast("تعذر إرسال الدورة للمراجعة حالياً");
    }
  });

  loadFeedback();

  window.addEventListener("beforeunload", (e) => {
    e.preventDefault();
    e.returnValue = "";
  });
});