import { auth, db, storage } from "/js/firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const form = document.getElementById("instructorCourseForm");
const statusEl = document.getElementById("instructorFormStatus");
const listEl = document.getElementById("instructorSubmissions");
const pendingCount = document.getElementById("pendingCount");
const approvedCount = document.getElementById("approvedCount");

function statusBadge(status){
  const map={pending:"قيد المراجعة",approved:"معتمدة",rejected:"مرفوضة"};
  return `<span class="badge ${status}">${map[status]||status}</span>`;
}

async function loadSubmissions(uid){
  const q = query(collection(db,"instructorCourseSubmissions"), where("instructorId","==",uid));
  const snap = await getDocs(q);
  const items = snap.docs.map(d=>({id:d.id,...d.data()}));

  const p = items.filter(i=>i.status==="pending").length;
  const a = items.filter(i=>i.status==="approved").length;
  if (pendingCount) pendingCount.textContent = p;
  if (approvedCount) approvedCount.textContent = a;

  if (!listEl) return;
  if (!items.length){
    listEl.innerHTML = "<p>لا توجد طلبات بعد.</p>";
    return;
  }
  listEl.innerHTML = items.map(item=>`
    <div class="submission-item">
      <h4>${item.title}</h4>
      <p>${statusBadge(item.status||"pending")}</p>
      <p>السعر: ${item.price ?? 0}$</p>
      <p>${item.reviewReason ? `ملاحظة الإدارة: ${item.reviewReason}` : ""}</p>
    </div>
  `).join("");
}

onAuthStateChanged(auth, async (user)=>{
  if(!user){ window.location.href="/login.html"; return; }
  const profile = await getDoc(doc(db,"users",user.uid));
  const data = profile.exists()?profile.data():null;
  if(!data || data.role!=="instructor" || data.status!=="active"){
    window.location.href="/instructor-pending.html";
    return;
  }

  await loadSubmissions(user.uid);

  form?.addEventListener("submit", async (e)=>{
    e.preventDefault();
    if (statusEl) statusEl.textContent = "جاري رفع الطلب...";

    try{
      const title = document.getElementById("courseTitle")?.value?.trim();
      const description = document.getElementById("courseDescription")?.value?.trim();
      const price = Number(document.getElementById("coursePrice")?.value || 0);
      const category = document.getElementById("courseCategory")?.value?.trim();
      const imageFile = document.getElementById("courseImage")?.files?.[0] || null;
      const outlineFile = document.getElementById("courseOutline")?.files?.[0] || null;

      let imageUrl = "";
      let outlineUrl = "";

      if (imageFile){
        const imageRef = ref(storage, `instructor-courses/${user.uid}/${Date.now()}-${imageFile.name}`);
        await uploadBytes(imageRef, imageFile);
        imageUrl = await getDownloadURL(imageRef);
      }

      if (outlineFile){
        const outlineRef = ref(storage, `instructor-courses/${user.uid}/${Date.now()}-${outlineFile.name}`);
        await uploadBytes(outlineRef, outlineFile);
        outlineUrl = await getDownloadURL(outlineRef);
      }

      await addDoc(collection(db,"instructorCourseSubmissions"),{
        instructorId:user.uid,
        instructorEmail:user.email,
        title,
        description,
        price,
        category,
        image:imageUrl,
        outlineUrl,
        status:"pending",
        reviewReason:"",
        createdAt:serverTimestamp()
      });

      if (statusEl) statusEl.textContent = "تم إرسال الدورة للمراجعة بنجاح.";
      form.reset();
      await loadSubmissions(user.uid);
    }catch(err){
      console.error(err);
      if (statusEl) statusEl.textContent = "تعذر إرسال الدورة. حاول مرة أخرى.";
    }
  });
});
