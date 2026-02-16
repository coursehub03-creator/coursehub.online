import { auth, db } from "/js/firebase-config.js";
import { protectAdmin } from "./admin-guard.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

document.addEventListener("DOMContentLoaded", async () => {
  await protectAdmin();

  const tbody = document.getElementById("users-list");
  const roleFilter = document.getElementById("user-role-filter");
  const statusFilter = document.getElementById("user-status-filter");
  const searchInput = document.getElementById("user-search");

  if (!tbody) return;

  let allUsers = [];

  const normalizeRole = (roleValue) => {
    const role = roleValue || "student";
    return role === "user" ? "student" : role;
  };

  const getDisplayName = (user) => {
    return (
      user.name ||
      user.displayName ||
      user.fullName ||
      (user.email ? user.email.split("@")[0] : "") ||
      user.uid ||
      user.id ||
      "-"
    );
  };

  const statusClass = (status) => {
    if (status === "active") return "success";
    if (status === "pending" || status === "pending_verification") return "warning";
    if (status === "blocked" || status === "rejected") return "danger";
    if (status === "deleted") return "neutral";
    return "neutral";
  };

  const isPermissionDenied = (error) => {
    return (
      error?.code === "permission-denied" ||
      /insufficient permissions/i.test(error?.message || "")
    );
  };

  // Cloud Function (Callable) للحذف النهائي (Auth + Firestore cleanup) إن وُجدت
  const functions = getFunctions(undefined, "us-central1");
  const hardDeleteUser = httpsCallable(functions, "hardDeleteUser");

  // Best-effort: يضيف طلب لحذف المستخدم من Firebase Auth عبر Cloud Function لاحقاً
  const queueAuthDeletion = async (user) => {
    try {
      await addDoc(collection(db, "authDeletionQueue"), {
        uid: user.uid || user.id || null,
        email: user.email || null,
        displayName: getDisplayName(user),
        requestedBy: auth.currentUser?.uid || null,
        status: "pending",
        createdAt: serverTimestamp()
      });
      return true;
    } catch (error) {
      // لو ممنوع/غير موجود في rules، لا نكسر العملية الأساسية
      if (!isPermissionDenied(error)) {
        console.warn("authDeletionQueue write failed:", error);
      }
      return false;
    }
  };

  /**
   * تنظيف البيانات المرتبطة بالمستخدم:
   * - instructorApplications: نحاول delete، وإن فشل بسبب rules → نعمل archive
   * - باقي المجموعات: best-effort delete، وإن فشل permission-denied نتجاهل
   */
  const purgeLinkedCollectionsBestEffort = async (targetUid) => {
    // 1) instructorApplications: delete ثم archive fallback عند permission-denied
    try {
      const appQuery = query(collection(db, "instructorApplications"), where("uid", "==", targetUid));
      const appSnap = await getDocs(appQuery);

      await Promise.all(
        appSnap.docs.map(async (snap) => {
          try {
            await deleteDoc(snap.ref);
          } catch (error) {
            if (!isPermissionDenied(error)) throw error;

            // fallback: archive instead of delete
            await updateDoc(snap.ref, {
              applicationStatus: "archived",
              reviewReason: "Archived after account deletion request",
              reviewedAt: serverTimestamp()
            });
          }
        })
      );
    } catch (error) {
      // لو ممنوع قراءة/استعلام على المجموعة أساساً، نتجاهل بدون كسر
      if (!isPermissionDenied(error)) throw error;
      console.info("Skip cleanup for instructorApplications: missing Firestore permission.");
    }

    // 2) باقي الـ collections: best-effort delete (مع تجاهل permission-denied)
    const cleanupTargets = [
      { collectionName: "certificates", field: "userId" },
      { collectionName: "enrollments", field: "userId" },
      { collectionName: "notifications", field: "userId" },
      { collectionName: "quizAttempts", field: "userId" },
      { collectionName: "user_courses", field: "uid" }
    ];

    for (const target of cleanupTargets) {
      try {
        const q = query(collection(db, target.collectionName), where(target.field, "==", targetUid));
        const snap = await getDocs(q);

        await Promise.all(
          snap.docs.map(async (docSnap) => {
            try {
              await deleteDoc(docSnap.ref);
            } catch (error) {
              if (!isPermissionDenied(error)) throw error;
            }
          })
        );
      } catch (error) {
        if (!isPermissionDenied(error)) throw error;
        console.info(`Skip cleanup for ${target.collectionName}: missing Firestore permission.`);
      }
    }
  };

  const removeUserRecord = async (user) => {
    const targetUid = user.uid || user.id;
    const targetEmail = user.email || "";
    if (!targetUid && !targetEmail) throw new Error("User UID/email not found");

    if (auth.currentUser?.uid && auth.currentUser.uid === targetUid) {
      alert("لا يمكنك حذف حسابك الحالي من هذه الواجهة.");
      return;
    }

    const confirmDelete = window.confirm(
      `هل أنت متأكد من الحذف النهائي للمستخدم ${getDisplayName(user)}؟\n\n` +
        "سيتم محاولة الحذف النهائي (Authentication + Firestore). وفي حال تعذر ذلك سيتم الحذف/الأرشفة حسب الصلاحيات وإرسال طلب حذف Authentication."
    );

    if (!confirmDelete) return;

    // 1) جرّب الحذف النهائي عبر Cloud Function callable
    // إذا نجح: حذف من القائمة مباشرة + رسالة نجاح (مع احترام حقول authDeleted/authDeletionError إن أُرسلت)
    // إذا فشل: fallback للطريقة الحالية (Firestore delete/archive + cleanup + authDeletionQueue)
    try {
      const response = await hardDeleteUser({ uid: targetUid, email: targetEmail });

      const deletedDocsCount = Number(response?.data?.deletedDocsCount || 0);

      // ميزات إضافية إن كانت الدالة تُرجعها
      const authDeleted = response?.data?.authDeleted !== false; // الافتراضي true إن لم تُرسل
      const authDeletionError = String(response?.data?.authDeletionError || "");

      allUsers = allUsers.filter((item) => (item.uid || item.id) !== targetUid);
      applyFilters();

      const authPart = authDeleted
        ? "تم حذف حساب Authentication."
        : `تعذر حذف Authentication حاليًا: ${authDeletionError || "unknown error"}`;

      alert(`✅ تم تنظيف بيانات المستخدم من Firestore. العناصر المحذوفة: ${deletedDocsCount}\n${authPart}`);
      return;
    } catch (fnError) {
      console.warn("hardDeleteUser failed; falling back to best-effort flow:", fnError);
      // نكمل fallback بدون كسر
    }

    // 2) Fallback: Firestore delete/archive حسب الصلاحيات
    let hardDeleted = false;

    try {
      if (targetUid) {
        await deleteDoc(doc(db, "users", targetUid));
        hardDeleted = true;
      } else {
        // لو ما عندنا uid (نادر) ما نقدر نحذف doc users مباشرة
        hardDeleted = false;
      }
    } catch (error) {
      if (!isPermissionDenied(error)) throw error;

      if (targetUid) {
        await updateDoc(doc(db, "users", targetUid), {
          status: "deleted",
          role: "deleted",
          deletedAt: serverTimestamp(),
          deletedBy: auth.currentUser?.uid || null
        });
      }
    }

    // 3) Best-effort cleanup للبيانات المرتبطة إن توفر uid
    if (targetUid) {
      await purgeLinkedCollectionsBestEffort(targetUid);
    }

    // 4) تحديث الكاش/الواجهة
    if (hardDeleted && targetUid) {
      allUsers = allUsers.filter((item) => (item.uid || item.id) !== targetUid);
    } else if (targetUid) {
      allUsers = allUsers.map((item) => {
        if ((item.uid || item.id) !== targetUid) return item;
        return { ...item, status: "deleted", role: "deleted" };
      });
    }

    applyFilters();

    // 5) Best-effort: queue auth deletion (حتى لو فشل الحذف النهائي)
    const queued = await queueAuthDeletion(user);

    // 6) رسائل للمستخدم
    if (!hardDeleted) {
      alert(
        "تمت أرشفة الحساب بدل الحذف الكامل لأن قواعد Firestore تمنع delete أو تعذر الحذف النهائي.\n" +
          (queued
            ? "كما تم إرسال طلب حذف حسابه من Firebase Authentication (authDeletionQueue)."
            : "لم نتمكن من إرسال طلب حذف Firebase Authentication (تحقق من Rules لمجموعة authDeletionQueue).")
      );
      return;
    }

    if (queued) {
      alert("تم حذف بيانات المستخدم من Firestore وإضافة طلب حذف حسابه من Firebase Authentication (authDeletionQueue).");
    } else {
      alert("تم حذف بيانات المستخدم من Firestore. لم نتمكن من إرسال طلب حذف Firebase Authentication (authDeletionQueue).");
    }
  };

  const renderUsers = (users) => {
    tbody.innerHTML = "";
    if (!users.length) {
      tbody.innerHTML = "<tr><td colspan='5'>لا يوجد مستخدمون بعد.</td></tr>";
      return;
    }

    users.forEach((user) => {
      const displayName = getDisplayName(user);
      const roleLabel = normalizeRole(user.role);
      const userStatus = user.status || "active";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${displayName}</td>
        <td>${user.email || "-"}</td>
        <td>${roleLabel}</td>
        <td><span class="badge ${statusClass(userStatus)}">${userStatus}</span></td>
        <td>
          <button class="btn danger small delete-user-btn" data-user-id="${user.uid || user.id || ""}">
            <i class="fa-solid fa-trash"></i>
            حذف
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".delete-user-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        const targetId = button.dataset.userId;
        const user = allUsers.find((item) => (item.uid || item.id) === targetId);
        if (!user) return;

        button.disabled = true;
        try {
          await removeUserRecord(user);
        } catch (error) {
          console.error("Delete user failed:", error);
          alert("تعذّر الحذف. تحقق من Firestore Rules أو نشر Cloud Functions وصلاحيات الأدمن.");
        } finally {
          button.disabled = false;
        }
      });
    });
  };

  const applyFilters = () => {
    const role = roleFilter?.value || "all";
    const status = statusFilter?.value || "all";
    const queryText = searchInput?.value.toLowerCase().trim() || "";

    const filtered = allUsers.filter((user) => {
      const normalizedRole = normalizeRole(user.role);
      const roleMatch = role === "all" || normalizedRole === role;

      const userStatus = user.status || "active";
      const statusMatch = status === "all" || userStatus === status;

      const normalizedName = (user.name || user.displayName || user.fullName || "").toLowerCase();
      const normalizedEmail = (user.email || "").toLowerCase();
      const normalizedUid = (user.uid || user.id || "").toLowerCase();

      const searchMatch =
        !queryText ||
        normalizedName.includes(queryText) ||
        normalizedEmail.includes(queryText) ||
        normalizedUid.includes(queryText);

      return roleMatch && statusMatch && searchMatch;
    });

    renderUsers(filtered);
  };

  try {
    const snapshot = await getDocs(collection(db, "users"));
    allUsers = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    applyFilters();
  } catch (error) {
    console.error("خطأ في تحميل المستخدمين:", error);
    tbody.innerHTML = "<tr><td colspan='5'>حدث خطأ أثناء التحميل.</td></tr>";
  }

  roleFilter?.addEventListener("change", applyFilters);
  statusFilter?.addEventListener("change", applyFilters);
  searchInput?.addEventListener("input", applyFilters);

  document.addEventListener("adminSearch", (event) => {
    if (!searchInput) return;
    searchInput.value = event.detail?.query || "";
    applyFilters();
  });
});
