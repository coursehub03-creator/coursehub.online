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
import { getStorage, ref as storageRef, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

const list = document.getElementById("applicationsList");
const storage = getStorage();

// استخدام Callable Function هو الأكثر احترافية (ويتفادى مشاكل الصلاحيات عند الكتابة من الواجهة)
const functions = getFunctions(undefined, "us-central1");
const approveInstructorApplication = httpsCallable(functions, "approveInstructorApplication");

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

async function resolveWorkProofUrl(app) {
  if (app.workProofUrl) return app.workProofUrl;
  if (!app.workProofPath) return "";

  try {
    return await getDownloadURL(storageRef(storage, app.workProofPath));
  } catch (error) {
    console.warn("Failed to resolve workProof URL:", error);
    return "";
  }
}

function renderCard(app) {
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
        <p><a href="${app.workProofUrl || "#"}" target="_blank" rel="noopener">عرض شهادة العمل (PDF)</a></p>
      </div>
      <div style="display:grid;gap:8px;min-width:260px;">
        <textarea class="review-reason" rows="3" placeholder="سبب الرفض (إلزامي عند الرفض)"></textarea>
        <button class="btn approve-btn">قبول وتفعيل الأستاذ</button>
        <button class="btn danger reject-btn">رفض الطلب</button>
      </div>
    </div>
  `;
}

async function loadApplications() {
  const q = query(
    collection(db, "instructorApplications"),
    where("applicationStatus", "==", "pending")
  );

  const snap = await getDocs(q);

  const apps = await Promise.all(
    snap.docs.map(async (d) => {
      const data = { id: d.id, ...d.data() };
      const workProofUrl = await resolveWorkProofUrl(data);
      return { ...data, workProofUrl };
    })
  );

  if (!apps.length) {
    list.innerHTML = "<p>لا توجد طلبات معلقة حاليًا.</p>";
    return;
  }

  list.innerHTML = apps.map(renderCard).join("");

  // قبول الطلب
  list.querySelectorAll(".approve-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const card = btn.closest(".user-card");
      const id = card?.dataset.id;
      const app = apps.find((a) => a.id === id);
      if (!app) return;

      btn.disabled = true;

      try {
        // المسار الأفضل: Cloud Function (صلاحيات + منطق مركزي)
        await approveInstructorApplication({
          applicationId: id,
          decision: "approve"
        });
      } catch (error) {
        // fallback احتياطي إذا فشلت الدالة (مثلاً غير منشورة/خطأ شبكة)
        console.warn("approveInstructorApplication callable failed, fallback:", error);

        await updateDoc(doc(db, "instructorApplications", id), {
          applicationStatus: "approved",
          reviewedAt: serverTimestamp(),
          reviewReason: ""
        });

        // الأكثر احترافية: تفعيل أولي مع انتظار التحقق/التفعيل بدل active مباشرة
        await updateDoc(doc(db, "users", app.uid), {
          status: "pending_verification",
          role: "instructor",
          reviewReason: ""
        });

        await queueEmail({
          to: app.email,
          template: "instructor-approved",
          subject: "تم قبول طلب الأستاذ - CourseHub",
          message:
            "تمت الموافقة المبدئية على طلبك. افتح صفحة التفعيل وسجل دخولك لتأكيد البريد الإلكتروني."
        });
      } finally {
        btn.disabled = false;
      }

      card.remove();
    });
  });

  // رفض الطلب
  list.querySelectorAll(".reject-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const card = btn.closest(".user-card");
      const id = card?.dataset.id;
      const reason = card?.querySelector(".review-reason")?.value?.trim();
      const app = apps.find((a) => a.id === id);
      if (!app) return;

      if (!reason) {
        alert("يرجى إدخال سبب الرفض.");
        return;
      }

      btn.disabled = true;

      try {
        // المسار الأفضل: Cloud Function
        await approveInstructorApplication({
          applicationId: id,
          decision: "reject",
          reason
        });
      } catch (error) {
        // fallback
        console.warn("reject via callable failed, fallback:", error);

        await updateDoc(doc(db, "instructorApplications", id), {
          applicationStatus: "rejected",
          reviewedAt: serverTimestamp(),
          reviewReason: reason
        });

        await updateDoc(doc(db, "users", app.uid), {
          status: "rejected",
          role: "instructor",
          reviewReason: reason
        });

        await queueEmail({
          to: app.email,
          template: "instructor-rejected",
          subject: "نتيجة طلب الأستاذ - CourseHub",
          message: `تم رفض طلبك للأسباب التالية: ${reason}`
        });
      } finally {
        btn.disabled = false;
      }

      card.remove();
    });
  });
}

async function init() {
  await protectAdmin();
  await loadApplications();
}

init();
