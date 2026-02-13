import { db } from "/js/firebase-config.js";
import { protectAdmin } from "./admin-guard.js";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const list = document.getElementById("applicationsList");

async function queueEmail(payload) {
  try {
    await addDoc(collection(db, "emailQueue"), {
      ...payload,
      createdAt: serverTimestamp(),
      status: "pending"
    });
  } catch (error) {
    if (error?.code === "permission-denied") {
      console.warn("emailQueue write blocked by Firestore rules:", error);
      return;
    }
    throw error;
  }
}

function renderCard(app){
  return `
    <div class="user-card" data-id="${app.id}">
      <div>
        <h3>${app.name || "-"}</h3>
        <p>البريد: ${app.email || "-"}</p>
        <p>الهاتف: ${app.phone || "-"}</p>
        <p>الجهة: ${app.university || "-"}</p>
        <p>التخصص: ${app.specialization || "-"}</p>
        <p>الخبرة: ${app.experienceYears || 0} سنة</p>
        <p>${app.bio || ""}</p>
        <p><a href="${app.workProofUrl || '#'}" target="_blank" rel="noopener">عرض شهادة العمل (PDF)</a></p>
      </div>
      <div style="display:grid;gap:8px;min-width:260px;">
        <textarea class="review-reason" rows="3" placeholder="سبب الرفض (إلزامي عند الرفض)"></textarea>
        <button class="btn approve-btn">قبول وتفعيل الأستاذ</button>
        <button class="btn danger reject-btn">رفض الطلب</button>
      </div>
    </div>
  `;
}

async function loadApplications(){
  const q = query(collection(db,"instructorApplications"), where("applicationStatus","==","pending"));
  const snap = await getDocs(q);
  const apps = snap.docs.map(d=>({id:d.id,...d.data()}));
  if(!apps.length){
    list.innerHTML = "<p>لا توجد طلبات معلقة حاليًا.</p>";
    return;
  }
  list.innerHTML = apps.map(renderCard).join("");

  list.querySelectorAll(".approve-btn").forEach((btn)=>{
    btn.addEventListener("click", async ()=>{
      const card = btn.closest(".user-card");
      const id = card?.dataset.id;
      const app = apps.find(a=>a.id===id);
      if(!app) return;

      await updateDoc(doc(db,"instructorApplications",id),{
        applicationStatus:"approved",
        reviewedAt:serverTimestamp(),
        reviewReason:""
      });
      await updateDoc(doc(db,"users",app.uid),{status:"active", role:"instructor"});
      await queueEmail({
        to: app.email,
        template: "instructor-approved",
        subject: "تم قبول طلب الأستاذ - CourseHub",
        message: "تم قبول طلبك كأستاذ في CourseHub ويمكنك الآن تسجيل الدخول ورفع دوراتك للمراجعة."
      });
      card.remove();
    });
  });

  list.querySelectorAll(".reject-btn").forEach((btn)=>{
    btn.addEventListener("click", async ()=>{
      const card = btn.closest(".user-card");
      const id = card?.dataset.id;
      const reason = card?.querySelector(".review-reason")?.value?.trim();
      const app = apps.find(a=>a.id===id);
      if(!app) return;
      if(!reason){ alert("يرجى إدخال سبب الرفض."); return; }

      await updateDoc(doc(db,"instructorApplications",id),{
        applicationStatus:"rejected",
        reviewedAt:serverTimestamp(),
        reviewReason:reason
      });
      await updateDoc(doc(db,"users",app.uid),{status:"rejected", role:"instructor", reviewReason:reason});
      await queueEmail({
        to: app.email,
        template: "instructor-rejected",
        subject: "نتيجة طلب الأستاذ - CourseHub",
        message: `تم رفض طلبك للأسباب التالية: ${reason}`
      });
      card.remove();
    });
  });
}

async function init(){
  await protectAdmin();
  await loadApplications();
}

init();
