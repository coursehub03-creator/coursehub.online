const steps = ["Basic Info","Media","Curriculum","Pricing","Landing","Review"];
let currentStep = 0;
let lessons = [];
const key = "coursehub_builder_v3";

function stepDots() {
  const wrap = document.getElementById("builderSteps");
  wrap.innerHTML = steps.map((s, i) => `<span class="step-dot ${i===currentStep?"active":""}">${i+1}. ${s}</span>`).join("");
  document.querySelectorAll(".wizard-panel").forEach((p, i) => p.hidden = i !== currentStep);
}

function renderLessons() {
  const root = document.getElementById("lessons");
  root.innerHTML = lessons.map((l, i) => `<div class="lesson-row"><input class="ch-input" value="${l.title}" data-i="${i}" data-f="title"><select class="ch-select" data-i="${i}" data-f="type"><option ${l.type==='video'?'selected':''}>video</option><option ${l.type==='text'?'selected':''}>text</option><option ${l.type==='quiz'?'selected':''}>quiz</option><option ${l.type==='assignment'?'selected':''}>assignment</option></select><select class="ch-select" data-i="${i}" data-f="status"><option ${l.status==='draft'?'selected':''}>draft</option><option ${l.status==='published'?'selected':''}>published</option></select><div><button class="ch-btn secondary" type="button" data-move="up" data-i="${i}">↑</button> <button class="ch-btn secondary" type="button" data-move="down" data-i="${i}">↓</button></div></div>`).join('');
}

function collectState() {
  const obj = {
    title: val("title"), subtitle: val("subtitle"), slug: val("slug"), category: val("category"), level: val("level"), language: val("language"),
    description: val("description"), cover: val("cover"), previewVideo: val("previewVideo"), price: val("price"), visibility: val("visibility"),
    headline: val("headline"), faq: val("faq"), lessons, status: "draft"
  };
  return obj;
}
const val = (id) => document.getElementById(id)?.value || "";

function completionScore(st) {
  const checks = [st.title, st.category, st.description, st.cover, st.price, st.headline, st.lessons.length > 0];
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
  document.getElementById("missingChecklist").innerHTML = missing.map((m) => `<li>${m}</li>`).join("") || "<li>جاهز للنشر المبدئي ✅</li>";
  document.getElementById("qualityScore").textContent = `Quality score: ${score}/100`;
  document.getElementById("missing").textContent = missing.length ? `حقول ناقصة: ${missing.join("، ")}` : "كل شيء جاهز للإرسال.";
}

function saveDraft(showToast = false) {
  const st = collectState();
  localStorage.setItem(key, JSON.stringify(st));
  document.getElementById("lastSaved").textContent = new Date().toLocaleTimeString("ar");
  if (showToast) toast("تم حفظ المسودة بنجاح");
  refreshSidebar();
}

function restore() {
  const raw = localStorage.getItem(key);
  if (!raw) return;
  const st = JSON.parse(raw);
  Object.entries(st).forEach(([k,v]) => { if (document.getElementById(k)) document.getElementById(k).value = v; });
  lessons = st.lessons || [];
}

function toast(msg){const d=document.createElement('div');d.className='ch-toast';d.textContent=msg;document.body.appendChild(d);setTimeout(()=>d.remove(),1800)}

document.addEventListener("DOMContentLoaded", () => {
  restore(); stepDots(); renderLessons(); refreshSidebar();

  document.getElementById("addLesson").addEventListener("click", () => { lessons.push({ title:`Lesson ${lessons.length+1}`, type:"video", status:"draft" }); renderLessons(); saveDraft(); });
  document.getElementById("lessons").addEventListener("input", (e) => {
    const i = Number(e.target.dataset.i); const f = e.target.dataset.f; if (Number.isInteger(i) && f) lessons[i][f]=e.target.value; saveDraft();
  });
  document.getElementById("lessons").addEventListener("click", (e)=>{
    const b = e.target.closest("[data-move]"); if(!b) return; const i=Number(b.dataset.i), dir=b.dataset.move==='up'?-1:1, t=i+dir; if(t<0||t>=lessons.length) return; [lessons[i],lessons[t]]=[lessons[t],lessons[i]]; renderLessons(); saveDraft();
  });

  document.getElementById("nextStep").addEventListener("click", ()=>{ currentStep = Math.min(steps.length-1, currentStep+1); stepDots(); refreshSidebar(); });
  document.getElementById("prevStep").addEventListener("click", ()=>{ currentStep = Math.max(0, currentStep-1); stepDots(); });
  document.getElementById("saveDraft").addEventListener("click", ()=> saveDraft(true));
  document.getElementById("builderForm").addEventListener("input", ()=> saveDraft(false));
  document.getElementById("builderForm").addEventListener("submit", (e)=>{e.preventDefault(); document.getElementById("courseState").textContent="in_review"; document.getElementById("courseState").className="ch-badge in_review"; saveDraft(); toast("تم إرسال الدورة للمراجعة");});
  window.addEventListener("beforeunload", (e)=>{e.preventDefault(); e.returnValue="";});
});
