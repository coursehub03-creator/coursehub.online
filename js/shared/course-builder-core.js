import { auth, db, storage } from "/js/firebase-config.js";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getDownloadURL, ref, uploadBytes } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const STEPS = ["معلومات أساسية", "الوسائط وصفحة الهبوط", "المنهج والوحدات", "محرر الشرائح", "الاختبارات ونقاط التحقق", "التسعير والوصول", "المراجعة والمعاينة", "الإرسال/النشر"];
const LESSON_CONTENT_TYPES = ["text", "video", "image", "file", "summary", "checkpointQuiz", "slides"];
const WORKFLOW = ["draft", "submitted", "under_review", "changes_requested", "resubmitted", "approved", "rejected", "published", "archived"];

const uid = () => crypto.randomUUID();
const esc = (v = "") => String(v).replace(/[&<>\"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

function questionTemplate() { return { id: uid(), question: "", explanation: "", options: ["", "", "", ""], correctIndexes: [] }; }
function slideElementTemplate(type) { return { id: uid(), type, x: 40, y: 40, w: type === "heading" ? 320 : 260, h: type === "shape" ? 120 : 80, z: 1, text: type === "heading" ? "عنوان" : "نص", src: "", style: { background: "#ffffff", color: "#0f172a", radius: 10 } }; }
function slideTemplate(index = 1) { return { id: uid(), title: `شريحة ${index}`, background: "#f8fafc", elements: [slideElementTemplate("heading")] }; }
function lessonTemplate(index = 1) { return { id: uid(), title: `درس ${index}`, summary: "", durationMinutes: 10, allowPreview: false, status: "draft", attachments: [], contentType: "text", content: "", slides: [slideTemplate(1)], checkpointQuiz: { title: "اختبار نقطة تحقق", passingScore: 70, timeLimitMinutes: 10, questions: [questionTemplate()] } }; }
function moduleTemplate(index = 1) { return { id: uid(), title: `وحدة ${index}`, lessons: [lessonTemplate(1)] }; }
function courseTemplate() { return { id: "", title: "", subtitle: "", slug: "", category: "", description: "", outcomes: "", requirements: "", cover: "", promoVideo: "", level: "مبتدئ", language: "العربية", modules: [moduleTemplate(1)], finalQuiz: { title: "الاختبار النهائي", passingScore: 70, timeLimitMinutes: 20, questions: [questionTemplate()] }, pricing: { suggestedPrice: 0, finalPrice: 0, accessModel: "paid" }, status: "draft", reviewNotes: [], statusHistory: [] }; }

export function createCourseBuilder({ role = "instructor", selectors = {} }) {
  const opts = { root: selectors.root || "#builderRoot", localDraftKey: selectors.localDraftKey || `coursehub_${role}_builder_draft_v7`, draftCollection: selectors.draftCollection || (role === "admin" ? "adminCourseDrafts" : "instructorCourseDrafts"), titleEl: selectors.titleEl || "#builderPageTitle", roleBadgeEl: selectors.roleBadgeEl || "#builderRoleBadge", ...selectors };
  const state = { step: 0, course: courseTemplate(), activeModuleId: "", activeLessonId: "", activeSlideId: "", selectedElementId: "", user: null, categories: [], autosaveTimer: null, mounted: false };
  const q = (s) => document.querySelector(s);

  function getActiveLesson() { const module = state.course.modules.find((m) => m.id === state.activeModuleId) || state.course.modules[0]; if (!module) return null; return module.lessons.find((l) => l.id === state.activeLessonId) || module.lessons[0] || null; }
  function getActiveSlide() { const lesson = getActiveLesson(); if (!lesson) return null; return lesson.slides.find((s) => s.id === state.activeSlideId) || lesson.slides[0] || null; }
  function statusLabel(s) { return ({ draft: "مسودة", submitted: "تم الإرسال", under_review: "تحت المراجعة", changes_requested: "مطلوب تعديلات", resubmitted: "أُعيد الإرسال", approved: "معتمد", rejected: "مرفوض", published: "منشور", archived: "مؤرشف" }[s] || s); }

  async function loadCategories() { const category = q("#category"); try { const snap = await getDocs(collection(db, "courseCategories")); state.categories = snap.docs.map((d) => String(d.data()?.name || "").trim()).filter(Boolean); } catch { state.categories = ["عام", "برمجة", "تصميم", "أعمال", "تسويق"]; } category.innerHTML = state.categories.map((name) => `<option value="${esc(name)}">${esc(name)}</option>`).join(""); }
  function syncHeader() { const title = q(opts.titleEl); const badge = q(opts.roleBadgeEl); if (title) title.textContent = role === "admin" ? "منصة إنشاء الدورات للمشرف" : "استوديو إنشاء الدورات للأستاذ"; if (badge) badge.textContent = role === "admin" ? "صلاحية: مشرف" : "صلاحية: أستاذ"; }

  function bindGlobal() {
    q("#nextStep")?.addEventListener("click", () => setStep(state.step + 1)); q("#prevStep")?.addEventListener("click", () => setStep(state.step - 1)); q("#saveDraft")?.addEventListener("click", () => saveDraft(true));
    q("#addModule")?.addEventListener("click", () => { state.course.modules.push(moduleTemplate(state.course.modules.length + 1)); const mod = state.course.modules.at(-1); state.activeModuleId = mod.id; state.activeLessonId = mod.lessons[0].id; renderAll(); autosave(); });
    q("#builderForm")?.addEventListener("input", (e) => { const target = e.target; if (!(target instanceof HTMLElement)) return; if (target.matches("[data-bind]")) { const key = target.dataset.bind; applyKeyPath(state.course, key, target.type === "number" ? Number(target.value || 0) : target.value); } renderPreview(); autosave(); });
    q("#coverFile")?.addEventListener("change", () => uploadMedia("#coverFile", "covers", "#cover")); q("#promoFile")?.addEventListener("change", () => uploadMedia("#promoFile", "promo", "#promoVideo"));
    q("#addFinalQuestion")?.addEventListener("click", () => { state.course.finalQuiz.questions.push(questionTemplate()); renderFinalQuiz(); autosave(); });
    q("#submitForReview")?.addEventListener("click", submitForReview); q("#publishDirect")?.addEventListener("click", publishCourse);
  }

  function applyKeyPath(root, key, value) { const parts = key.split("."); let ptr = root; while (parts.length > 1) { const p = parts.shift(); if (!(p in ptr)) ptr[p] = {}; ptr = ptr[p]; } ptr[parts[0]] = value; }

  async function uploadMedia(inputSel, folder, targetSel) {
    const file = q(inputSel)?.files?.[0]; if (!file) return; const local = URL.createObjectURL(file); q(targetSel).value = local; renderPreview(); if (!state.user) return;
    try { const path = `${role}-courses/${state.user.uid}/${folder}/${Date.now()}-${file.name}`; const storageRef = ref(storage, path); await uploadBytes(storageRef, file); q(targetSel).value = await getDownloadURL(storageRef); state.course[targetSel.replace("#", "")] = q(targetSel).value; renderPreview(); autosave(); } catch { setStatus("⚠️ تم استخدام معاينة محلية للملف", true); }
  }

  function setStep(n) { state.step = Math.max(0, Math.min(STEPS.length - 1, n)); q("#stepBar").innerHTML = STEPS.map((s, i) => `<button type="button" class="step-pill ${i === state.step ? "active" : ""}">${i + 1}. ${s}</button>`).join(""); document.querySelectorAll(".builder-step-panel").forEach((el, i) => { el.hidden = i !== state.step; }); q("#nextStep").style.display = state.step === STEPS.length - 1 ? "none" : "inline-flex"; q("#submitActions").hidden = state.step !== STEPS.length - 1; }

  function renderModuleLessonTree() {
    const root = q("#moduleLessonTree");
    root.innerHTML = state.course.modules.map((mod) => `<article class="module-card" data-module-id="${mod.id}"><div class="module-head"><input class="ch-input" data-module-title="${mod.id}" value="${esc(mod.title)}" placeholder="عنوان الوحدة"><div class="inline-actions"><button type="button" class="ch-btn secondary" data-add-lesson="${mod.id}">+ درس</button><button type="button" class="ch-btn secondary" data-move-module="up" data-module-id="${mod.id}">↑</button><button type="button" class="ch-btn secondary" data-move-module="down" data-module-id="${mod.id}">↓</button><button type="button" class="ch-btn secondary" data-del-module="${mod.id}">حذف</button></div></div><div class="lesson-list">${mod.lessons.map((lesson) => `<button type="button" class="lesson-chip ${lesson.id === state.activeLessonId ? "active" : ""}" data-open-lesson="${lesson.id}" data-module-id="${mod.id}">${esc(lesson.title)}<span>${statusLabel(lesson.status)}</span></button>`).join("")}</div></article>`).join("");
    root.querySelectorAll("[data-module-title]").forEach((el) => el.addEventListener("input", () => { const mod = state.course.modules.find((m) => m.id === el.dataset.moduleTitle); if (mod) mod.title = el.value; autosave(); renderPreview(); }));
    root.querySelectorAll("[data-add-lesson]").forEach((btn) => btn.addEventListener("click", () => { const mod = state.course.modules.find((m) => m.id === btn.dataset.addLesson); if (!mod) return; mod.lessons.push(lessonTemplate(mod.lessons.length + 1)); state.activeModuleId = mod.id; state.activeLessonId = mod.lessons.at(-1).id; renderAll(); autosave(); }));
    root.querySelectorAll("[data-open-lesson]").forEach((btn) => btn.addEventListener("click", () => { state.activeModuleId = btn.dataset.moduleId; state.activeLessonId = btn.dataset.openLesson; renderLessonSettings(); renderSlideEditor(); renderModuleLessonTree(); renderPreview(); }));
    root.querySelectorAll("[data-del-module]").forEach((btn) => btn.addEventListener("click", () => { state.course.modules = state.course.modules.filter((m) => m.id !== btn.dataset.delModule); if (!state.course.modules.length) state.course.modules.push(moduleTemplate(1)); const mod = state.course.modules[0]; state.activeModuleId = mod.id; state.activeLessonId = mod.lessons[0]?.id || ""; renderAll(); autosave(); }));
    root.querySelectorAll("[data-move-module]").forEach((btn) => btn.addEventListener("click", () => { const index = state.course.modules.findIndex((m) => m.id === btn.dataset.moduleId); const dir = btn.dataset.moveModule === "up" ? -1 : 1; const next = index + dir; if (index < 0 || next < 0 || next >= state.course.modules.length) return; const [mod] = state.course.modules.splice(index, 1); state.course.modules.splice(next, 0, mod); renderModuleLessonTree(); renderPreview(); autosave(); }));
  }

  function renderLessonSettings() {
    const lesson = getActiveLesson(); const wrap = q("#lessonSettings"); if (!lesson) { wrap.innerHTML = "<p>اختر درساً أولاً.</p>"; return; }
    wrap.innerHTML = `<div class="lesson-settings-grid"><label>عنوان الدرس<input class="ch-input" id="lessonTitle" value="${esc(lesson.title)}"></label><label>المدة (دقيقة)<input class="ch-input" id="lessonDuration" type="number" min="1" value="${lesson.durationMinutes}"></label><label>الحالة<select class="ch-select" id="lessonStatus">${WORKFLOW.map((s) => `<option value="${s}" ${lesson.status === s ? "selected" : ""}>${statusLabel(s)}</option>`).join("")}</select></label><label>نوع المحتوى<select class="ch-select" id="lessonContentType">${LESSON_CONTENT_TYPES.map((t) => `<option value="${t}" ${lesson.contentType === t ? "selected" : ""}>${t}</option>`).join("")}</select></label></div><label>ملخص<textarea class="ch-textarea" id="lessonSummary">${esc(lesson.summary)}</textarea></label><label>محتوى نصي / رابط وسيط<textarea class="ch-textarea" id="lessonContent">${esc(lesson.content || "")}</textarea></label><label class="switch-row"><input type="checkbox" id="lessonPreviewToggle" ${lesson.allowPreview ? "checked" : ""}> متاح كدرس تجريبي</label><div class="inline-actions"><button type="button" class="ch-btn secondary" id="lessonDuplicate">نسخ الدرس</button><button type="button" class="ch-btn secondary" id="lessonMoveUp">تحريك لأعلى</button><button type="button" class="ch-btn secondary" id="lessonMoveDown">تحريك لأسفل</button><button type="button" class="ch-btn secondary" id="lessonDelete">حذف</button></div>`;
    q("#lessonTitle").addEventListener("input", (e) => { lesson.title = e.target.value; renderModuleLessonTree(); autosave(); renderPreview(); }); q("#lessonDuration").addEventListener("input", (e) => { lesson.durationMinutes = Number(e.target.value || 1); autosave(); renderPreview(); }); q("#lessonStatus").addEventListener("change", (e) => { lesson.status = e.target.value; renderModuleLessonTree(); autosave(); }); q("#lessonContentType").addEventListener("change", (e) => { lesson.contentType = e.target.value; autosave(); }); q("#lessonSummary").addEventListener("input", (e) => { lesson.summary = e.target.value; autosave(); renderPreview(); }); q("#lessonContent").addEventListener("input", (e) => { lesson.content = e.target.value; autosave(); }); q("#lessonPreviewToggle").addEventListener("change", (e) => { lesson.allowPreview = e.target.checked; autosave(); renderPreview(); });
    q("#lessonDuplicate").addEventListener("click", () => { const mod = state.course.modules.find((m) => m.id === state.activeModuleId); const clone = structuredClone(lesson); clone.id = uid(); clone.title = `${clone.title} (نسخة)`; mod.lessons.push(clone); state.activeLessonId = clone.id; renderAll(); autosave(); }); q("#lessonDelete").addEventListener("click", () => { const mod = state.course.modules.find((m) => m.id === state.activeModuleId); mod.lessons = mod.lessons.filter((l) => l.id !== lesson.id); if (!mod.lessons.length) mod.lessons.push(lessonTemplate(1)); state.activeLessonId = mod.lessons[0].id; renderAll(); autosave(); }); q("#lessonMoveUp").addEventListener("click", () => moveLesson(-1)); q("#lessonMoveDown").addEventListener("click", () => moveLesson(1));
  }

  function moveLesson(direction) { const mod = state.course.modules.find((m) => m.id === state.activeModuleId); const idx = mod.lessons.findIndex((l) => l.id === state.activeLessonId); const next = idx + direction; if (idx < 0 || next < 0 || next >= mod.lessons.length) return; const [lesson] = mod.lessons.splice(idx, 1); mod.lessons.splice(next, 0, lesson); renderAll(); autosave(); }

  function renderSlideEditor() {
    const lesson = getActiveLesson(); const slideList = q("#slideList"); const canvas = q("#slideCanvas"); if (!lesson) { slideList.innerHTML = ""; canvas.innerHTML = ""; return; }
    if (!lesson.slides?.length) lesson.slides = [slideTemplate(1)]; if (!state.activeSlideId) state.activeSlideId = lesson.slides[0].id;
    slideList.innerHTML = lesson.slides.map((s, i) => `<button type="button" class="slide-thumb ${s.id === state.activeSlideId ? "active" : ""}" data-slide-id="${s.id}">${i + 1}. ${esc(s.title)}</button>`).join("");
    const slide = getActiveSlide(); q("#slideBackground").value = slide.background || "#f8fafc"; canvas.style.background = slide.background || "#f8fafc";
    canvas.innerHTML = slide.elements.map((el) => { const content = ["image", "video"].includes(el.type) ? `<input class="media-url-inline" data-media-src="${el.id}" value="${esc(el.src || "")}" placeholder="رابط ${el.type}">` : `<div contenteditable="true" spellcheck="false" data-edit-text="${el.id}">${esc(el.text || "")}</div>`; return `<div class="canvas-element ${state.selectedElementId === el.id ? "selected" : ""}" data-el-id="${el.id}" style="left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;z-index:${el.z};background:${el.type === "shape" ? el.style.background : "transparent"};color:${el.style.color};border-radius:${el.style.radius}px">${content}<button type="button" class="resize-handle" data-resize="${el.id}"></button></div>`; }).join("");
    bindSlideEvents(); slideList.querySelectorAll("[data-slide-id]").forEach((btn) => btn.addEventListener("click", () => { state.activeSlideId = btn.dataset.slideId; state.selectedElementId = ""; renderSlideEditor(); renderPreview(); }));
  }

  function bindSlideEvents() {
    const lesson = getActiveLesson(); const slide = getActiveSlide(); if (!lesson || !slide) return;
    q("#addSlide").onclick = () => { lesson.slides.push(slideTemplate(lesson.slides.length + 1)); state.activeSlideId = lesson.slides.at(-1).id; renderSlideEditor(); autosave(); renderPreview(); };
    q("#deleteSlide").onclick = () => { lesson.slides = lesson.slides.filter((s) => s.id !== state.activeSlideId); if (!lesson.slides.length) lesson.slides.push(slideTemplate(1)); state.activeSlideId = lesson.slides[0].id; renderSlideEditor(); autosave(); renderPreview(); };
    q("#slideBackground").oninput = (e) => { const current = getActiveSlide(); current.background = e.target.value; q("#slideCanvas").style.background = current.background; autosave(); renderPreview(); };
    q("#addTextElement").onclick = () => addElement("text"); q("#addHeadingElement").onclick = () => addElement("heading"); q("#addImageElement").onclick = () => addElement("image"); q("#addVideoElement").onclick = () => addElement("video"); q("#addShapeElement").onclick = () => addElement("shape"); q("#duplicateElement").onclick = duplicateSelected; q("#deleteElement").onclick = deleteSelected; q("#bringFront").onclick = () => reorderSelected(1); q("#sendBack").onclick = () => reorderSelected(-1);
    q("#slideCanvas").querySelectorAll(".canvas-element").forEach((elNode) => { const id = elNode.dataset.elId; elNode.addEventListener("pointerdown", (ev) => startDrag(ev, id)); elNode.querySelector("[data-resize]")?.addEventListener("pointerdown", (ev) => startResize(ev, id)); elNode.querySelector("[data-edit-text]")?.addEventListener("input", (ev) => { const target = slide.elements.find((e) => e.id === id); target.text = ev.target.textContent; autosave(); renderPreview(); }); elNode.querySelector("[data-media-src]")?.addEventListener("input", (ev) => { const target = slide.elements.find((e) => e.id === id); target.src = ev.target.value; autosave(); }); });
  }

  function addElement(type) { const slide = getActiveSlide(); if (!slide) return; const element = slideElementTemplate(type); element.z = slide.elements.length + 1; slide.elements.push(element); state.selectedElementId = element.id; renderSlideEditor(); autosave(); renderPreview(); }
  function duplicateSelected() { const slide = getActiveSlide(); const source = slide?.elements.find((el) => el.id === state.selectedElementId); if (!source) return; const copy = structuredClone(source); copy.id = uid(); copy.x += 24; copy.y += 24; copy.z = slide.elements.length + 1; slide.elements.push(copy); state.selectedElementId = copy.id; renderSlideEditor(); autosave(); renderPreview(); }
  function deleteSelected() { const slide = getActiveSlide(); if (!slide) return; slide.elements = slide.elements.filter((el) => el.id !== state.selectedElementId); state.selectedElementId = ""; renderSlideEditor(); autosave(); renderPreview(); }
  function reorderSelected(dir) { const slide = getActiveSlide(); const el = slide?.elements.find((x) => x.id === state.selectedElementId); if (!el) return; el.z = Math.max(1, el.z + dir); renderSlideEditor(); autosave(); renderPreview(); }

  function startDrag(ev, elementId) { if (ev.target.classList.contains("resize-handle")) return; const slide = getActiveSlide(); const el = slide?.elements.find((x) => x.id === elementId); if (!el) return; state.selectedElementId = elementId; renderSlideEditor(); const startX = ev.clientX; const startY = ev.clientY; const originX = el.x; const originY = el.y; const onMove = (m) => { el.x = Math.max(0, originX + (m.clientX - startX)); el.y = Math.max(0, originY + (m.clientY - startY)); const node = q(`#slideCanvas [data-el-id='${elementId}']`); if (node) { node.style.left = `${el.x}px`; node.style.top = `${el.y}px`; } }; const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); autosave(); renderPreview(); }; window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp); }
  function startResize(ev, elementId) { ev.stopPropagation(); const slide = getActiveSlide(); const el = slide?.elements.find((x) => x.id === elementId); if (!el) return; const startX = ev.clientX; const startY = ev.clientY; const originW = el.w; const originH = el.h; const onMove = (m) => { el.w = Math.max(80, originW + (m.clientX - startX)); el.h = Math.max(40, originH + (m.clientY - startY)); const node = q(`#slideCanvas [data-el-id='${elementId}']`); if (node) { node.style.width = `${el.w}px`; node.style.height = `${el.h}px`; } }; const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); autosave(); renderPreview(); }; window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp); }

  function quizMarkup(quiz, key) { return `<div class="quiz-card"><div class="lesson-settings-grid"><label>العنوان<input class="ch-input" data-quiz-meta="${key}" data-field="title" value="${esc(quiz.title || "")}"></label><label>درجة النجاح<input class="ch-input" type="number" min="1" max="100" data-quiz-meta="${key}" data-field="passingScore" value="${Number(quiz.passingScore || 70)}"></label><label>الوقت بالدقائق<input class="ch-input" type="number" min="1" data-quiz-meta="${key}" data-field="timeLimitMinutes" value="${Number(quiz.timeLimitMinutes || 10)}"></label></div>${quiz.questions.map((qz, idx) => `<article class="quiz-question" data-quiz-key="${key}" data-q-id="${qz.id}"><h4>سؤال ${idx + 1}</h4><input class="ch-input" data-q-field="question" value="${esc(qz.question)}" placeholder="نص السؤال"><textarea class="ch-textarea" data-q-field="explanation" placeholder="توضيح الإجابة">${esc(qz.explanation || "")}</textarea>${qz.options.map((opt, oi) => `<div class="quiz-option-row"><input class="ch-input" data-opt-index="${oi}" value="${esc(opt)}" placeholder="خيار ${oi + 1}"><label><input type="checkbox" data-correct-index="${oi}" ${qz.correctIndexes.includes(oi) ? "checked" : ""}> صحيح</label></div>`).join("")}<div class="inline-actions"><button type="button" class="ch-btn secondary" data-add-option="${key}:${qz.id}">+ خيار</button><button type="button" class="ch-btn secondary" data-del-question="${key}:${qz.id}">حذف السؤال</button></div></article>`).join("")}<button type="button" class="ch-btn secondary" data-add-question="${key}">+ إضافة سؤال</button></div>`; }
  function resolveQuiz(key) { if (key === "final") return state.course.finalQuiz; return getActiveLesson().checkpointQuiz; }
  function renderQuizEditor() { const lesson = getActiveLesson(); q("#lessonQuizEditor").innerHTML = lesson ? quizMarkup(lesson.checkpointQuiz, "lesson") : ""; q("#finalQuizEditor").innerHTML = quizMarkup(state.course.finalQuiz, "final"); bindQuizEvents(); }

  function bindQuizEvents() {
    document.querySelectorAll("[data-quiz-meta]").forEach((el) => el.addEventListener("input", () => { const quiz = resolveQuiz(el.dataset.quizMeta); quiz[el.dataset.field] = el.type === "number" ? Number(el.value || 0) : el.value; autosave(); }));
    document.querySelectorAll("[data-add-question]").forEach((btn) => btn.addEventListener("click", () => { resolveQuiz(btn.dataset.addQuestion).questions.push(questionTemplate()); renderQuizEditor(); autosave(); }));
    document.querySelectorAll("[data-add-option]").forEach((btn) => btn.addEventListener("click", () => { const [key, qId] = btn.dataset.addOption.split(":"); const quiz = resolveQuiz(key); const qz = quiz.questions.find((q) => q.id === qId); if (qz) qz.options.push(""); renderQuizEditor(); autosave(); }));
    document.querySelectorAll("[data-del-question]").forEach((btn) => btn.addEventListener("click", () => { const [key, qId] = btn.dataset.delQuestion.split(":"); const quiz = resolveQuiz(key); quiz.questions = quiz.questions.filter((qz) => qz.id !== qId); if (!quiz.questions.length) quiz.questions.push(questionTemplate()); renderQuizEditor(); autosave(); }));
    document.querySelectorAll(".quiz-question").forEach((block) => { const quiz = resolveQuiz(block.dataset.quizKey); const qz = quiz.questions.find((q) => q.id === block.dataset.qId); if (!qz) return; block.querySelectorAll("[data-q-field]").forEach((el) => el.addEventListener("input", () => { qz[el.dataset.qField] = el.value; autosave(); })); block.querySelectorAll("[data-opt-index]").forEach((el) => el.addEventListener("input", () => { qz.options[Number(el.dataset.optIndex)] = el.value; autosave(); })); block.querySelectorAll("[data-correct-index]").forEach((el) => el.addEventListener("change", () => { const idx = Number(el.dataset.correctIndex); qz.correctIndexes = el.checked ? [...new Set([...(qz.correctIndexes || []), idx])] : (qz.correctIndexes || []).filter((v) => v !== idx); autosave(); })); });
  }

  function validateBeforeAction(type = "submit") {
    const errs = []; if (!state.course.title.trim()) errs.push("عنوان الدورة مطلوب"); if (!state.course.category.trim()) errs.push("التصنيف مطلوب"); if (!state.course.description.trim()) errs.push("الوصف مطلوب"); if (!state.course.modules.length) errs.push("يجب إضافة وحدة واحدة على الأقل");
    const lessonCount = state.course.modules.reduce((n, m) => n + m.lessons.length, 0); if (!lessonCount) errs.push("يجب إضافة درس واحد على الأقل");
    [state.course.finalQuiz, ...state.course.modules.flatMap((m) => m.lessons.map((l) => l.checkpointQuiz))].forEach((quiz) => quiz.questions.forEach((qz) => { if (!qz.question.trim()) errs.push("هناك سؤال بدون نص"); if ((qz.options || []).filter((opt) => String(opt).trim()).length < 4) errs.push("كل سؤال يجب أن يحتوي على 4 خيارات على الأقل"); if (!(qz.correctIndexes || []).length) errs.push("يجب تحديد إجابة صحيحة"); }));
    if (type === "publish" && role !== "admin") errs.push("النشر المباشر متاح للمشرف فقط"); q("#validationList").innerHTML = errs.length ? errs.map((e) => `<li>${esc(e)}</li>`).join("") : "<li>✅ جميع المتطلبات الأساسية مكتملة.</li>"; return errs;
  }

  function buildPayload(nextStatus) { const lessons = state.course.modules.flatMap((m) => m.lessons.map((lesson) => ({ ...lesson, moduleId: m.id, moduleTitle: m.title }))); const now = serverTimestamp(); return { ...state.course, lessons, status: nextStatus, instructorId: role === "instructor" ? state.user?.uid || state.course.instructorId || "" : state.course.instructorId || "", instructorEmail: role === "instructor" ? state.user?.email || "" : state.course.instructorEmail || "", updatedAt: now, createdAt: state.course.createdAt || now, workflowVersion: 2 }; }

  async function saveDraft(showMessage = false) { const payload = buildPayload("draft"); localStorage.setItem(opts.localDraftKey, JSON.stringify({ ...payload, updatedAtISO: new Date().toISOString() })); if (state.user?.uid) { await setDoc(doc(db, opts.draftCollection, state.user.uid), payload, { merge: true }); if (state.course.id) await updateDoc(doc(db, "courses", state.course.id), { ...payload, status: state.course.status || "draft" }); } if (showMessage) setStatus("✅ تم حفظ المسودة."); q("#lastAutosave").textContent = new Date().toLocaleTimeString("ar"); }
  function autosave() { clearTimeout(state.autosaveTimer); state.autosaveTimer = setTimeout(() => saveDraft(false).catch(() => {}), 450); }

  async function submitForReview() {
    const errs = validateBeforeAction("submit"); if (errs.length) return setStatus("❌ لا يمكن الإرسال قبل تصحيح الأخطاء.", true);
    const nextStatus = state.course.status === "changes_requested" ? "resubmitted" : "submitted"; const payload = buildPayload(nextStatus);
    if (role === "instructor") { if (!state.user) return setStatus("❌ يرجى تسجيل الدخول أولاً", true); if (!state.course.id) { const courseRef = await addDoc(collection(db, "courses"), payload); state.course.id = courseRef.id; } else { await setDoc(doc(db, "courses", state.course.id), payload, { merge: true }); }
      await addDoc(collection(db, "instructorCourseSubmissions"), { courseId: state.course.id, instructorId: state.user.uid, instructorEmail: state.user.email || "", instructorName: state.user.displayName || "", title: state.course.title, summary: state.course.description.slice(0, 180), status: nextStatus, note: "", snapshot: payload, timeline: [{ type: nextStatus, at: serverTimestamp(), by: state.user.uid }], createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      state.course.status = nextStatus; setStatus("✅ تم إرسال الدورة للمراجعة بنجاح."); renderAll(); return; }
    setStatus("⚠️ المشرف لا يرسل للمراجعة، يمكنه النشر مباشرة أو حفظ مسودة.", true);
  }

  async function publishCourse() { const errs = validateBeforeAction("publish"); if (errs.length) return setStatus("❌ لا يمكن النشر قبل إكمال المتطلبات.", true); if (role !== "admin") return setStatus("❌ النشر المباشر متاح للمشرف فقط.", true); const payload = buildPayload("published"); if (state.course.id) { await setDoc(doc(db, "courses", state.course.id), payload, { merge: true }); } else { const created = await addDoc(collection(db, "courses"), payload); state.course.id = created.id; } state.course.status = "published"; setStatus("✅ تم نشر الدورة بنجاح."); renderAll(); }

  async function restoreDraft() {
    const local = parseLocal(localStorage.getItem(opts.localDraftKey)); let remote = null;
    if (state.user?.uid) { const snap = await getDoc(doc(db, opts.draftCollection, state.user.uid)); remote = snap.exists() ? snap.data() : null; }
    state.course = pickLatest(local, remote) || state.course; if (!state.course.modules?.length) state.course.modules = [moduleTemplate(1)]; if (!state.course.finalQuiz?.questions?.length) state.course.finalQuiz = courseTemplate().finalQuiz;
    const firstModule = state.course.modules[0]; state.activeModuleId = firstModule.id; state.activeLessonId = firstModule.lessons[0]?.id || ""; state.activeSlideId = firstModule.lessons[0]?.slides?.[0]?.id || ""; bindModelToForm();
  }

  function bindModelToForm() { ["title", "subtitle", "slug", "category", "description", "outcomes", "requirements", "cover", "promoVideo", "level", "language"].forEach((key) => { const el = q(`#${key}`); if (el) el.value = state.course[key] || ""; }); q("#suggestedPrice").value = Number(state.course.pricing?.suggestedPrice || 0); q("#finalPrice").value = Number(state.course.pricing?.finalPrice || 0); q("#accessModel").value = state.course.pricing?.accessModel || "paid"; }

  function renderPricing() { const canEditFinal = role === "admin"; q("#finalPrice").disabled = !canEditFinal; q("#finalPriceWrap").style.opacity = canEditFinal ? 1 : 0.55; q("#publishDirect").hidden = role !== "admin"; q("#suggestedPrice").oninput = (e) => { state.course.pricing.suggestedPrice = Number(e.target.value || 0); if (role !== "admin") state.course.pricing.finalPrice = state.course.pricing.suggestedPrice; autosave(); renderPreview(); }; q("#finalPrice").oninput = (e) => { state.course.pricing.finalPrice = Number(e.target.value || 0); autosave(); renderPreview(); }; q("#accessModel").onchange = (e) => { state.course.pricing.accessModel = e.target.value; autosave(); renderPreview(); }; }

  function renderPreview() {
    const preview = q("#realPreview"); const lesson = getActiveLesson(); const slide = lesson?.slides?.[0]; const finalPrice = Number(state.course.pricing?.finalPrice || 0);
    preview.innerHTML = `<section class="preview-landing"><img src="${esc(state.course.cover || "/assets/images/default-course.png")}" alt="cover"><div><span class="ch-badge ${esc(state.course.status || "draft")}">${statusLabel(state.course.status || "draft")}</span><h3>${esc(state.course.title || "عنوان الدورة")}</h3><p>${esc(state.course.description || "وصف الدورة سيظهر هنا")}</p><p><strong>السعر:</strong> ${finalPrice.toLocaleString("ar")} ر.س</p></div></section><section class="preview-curriculum"><h4>المنهج</h4><ul>${state.course.modules.map((m) => `<li><strong>${esc(m.title)}</strong> — ${m.lessons.length} دروس</li>`).join("")}</ul></section><section class="preview-lesson"><h4>معاينة الدرس: ${esc(lesson?.title || "")}</h4><p>${esc(lesson?.summary || "")}</p>${slide ? `<div class="slide-preview-mini" style="background:${slide.background}">${slide.elements.map((el) => `<span style="left:${el.x / 4}px;top:${el.y / 4}px;width:${el.w / 4}px;height:${el.h / 4}px">${esc(el.text || el.type)}</span>`).join("")}</div>` : ""}</section><section class="preview-quiz"><h4>الاختبار النهائي</h4><p>${esc(state.course.finalQuiz.title || "")}</p><p>عدد الأسئلة: ${state.course.finalQuiz.questions.length} | درجة النجاح: ${state.course.finalQuiz.passingScore}%</p></section>`;
  }

  function renderReviewTimeline() { const root = q("#reviewTimeline"); const notes = state.course.reviewNotes || []; root.innerHTML = notes.length ? notes.map((n) => `<article><strong>${esc(statusLabel(n.status || ""))}</strong><p>${esc(n.note || "")}</p></article>`).join("") : "<p>لا توجد ملاحظات مراجعة بعد.</p>"; }
  function renderStatusMeta() { q("#courseStatusPill").textContent = statusLabel(state.course.status || "draft"); q("#courseStatusPill").className = `ch-badge ${state.course.status || "draft"}`; q("#submitForReview").textContent = state.course.status === "changes_requested" ? "إعادة الإرسال بعد التعديلات" : "إرسال للمراجعة"; }
  function renderFinalQuiz() { renderQuizEditor(); }
  function renderAll() { renderModuleLessonTree(); renderLessonSettings(); renderSlideEditor(); renderFinalQuiz(); renderPricing(); renderPreview(); renderReviewTimeline(); renderStatusMeta(); }
  function pickLatest(local, remote) { const localTime = Date.parse(local?.updatedAtISO || 0); const remoteTime = remote?.updatedAt?.toDate ? remote.updatedAt.toDate().getTime() : Date.parse(remote?.updatedAtISO || 0); if (!local && !remote) return null; return localTime >= remoteTime ? local : remote; }
  function parseLocal(raw) { try { return raw ? JSON.parse(raw) : null; } catch { return null; } }
  function setStatus(text, isError = false) { const el = q("#builderStatus"); if (!el) return; el.textContent = text; el.style.color = isError ? "#b91c1c" : "#166534"; }

  async function loadSubmissionFeedbackForInstructor() { if (role !== "instructor" || !state.user) return; const panel = q("#instructorReviewPanel"); try { const snap = await getDocs(query(collection(db, "instructorCourseSubmissions"), where("instructorId", "==", state.user.uid), orderBy("updatedAt", "desc"), limit(5))); const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })); panel.innerHTML = rows.length ? rows.map((row) => `<div class="review-row"><strong>${esc(row.title || "-")}</strong><span class="ch-badge ${row.status || "submitted"}">${statusLabel(row.status || "submitted")}</span><p>${esc(row.note || row.reviewReason || "لا توجد ملاحظات")}</p></div>`).join("") : "لا توجد مراجعات حالياً."; } catch { panel.textContent = "تعذر تحميل مراجعات الدورة حالياً."; } }

  async function mount() {
    if (state.mounted) return; syncHeader(); await loadCategories(); bindGlobal(); setStep(0);
    auth.onAuthStateChanged(async (user) => { state.user = user; if (!user && role === "instructor") return; if (!state.user && role === "admin") state.user = { uid: "admin-session" }; await restoreDraft(); renderAll(); await loadSubmissionFeedbackForInstructor(); state.mounted = true; });
    if (role === "admin") { state.user = { uid: "admin-session" }; await restoreDraft(); renderAll(); state.mounted = true; }
  }

  return { mount };
}
