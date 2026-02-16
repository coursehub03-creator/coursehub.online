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


  const purgeLinkedCollectionsBestEffort = async (targetUid) => {
    const cleanupTargets = [
      { collectionName: "instructorApplications", field: "uid" },
      { collectionName: "certificates", field: "userId" },
      { collectionName: "enrollments", field: "userId" },
      { collectionName: "notifications", field: "userId" },
      { collectionName: "quizAttempts", field: "userId" },
      { collectionName: "user_courses", field: "uid" }
    ];

    for (const target of cleanupTargets) {
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
    }
  };

  const removeUserRecord = async (user) => {
    const targetUid = user.uid || user.id;
    if (!targetUid) throw new Error("User UID not found");

    if (auth.currentUser?.uid === targetUid) {
      alert("لا يمكنك حذف حسابك الحالي من هذه الواجهة.");
      return;
    }

    const confirmDelete = window.confirm(
      `هل أنت متأكد من حذف المستخدم ${getDisplayName(user)} نهائيًا؟\n\n` +
        `سيتم حذف/أرشفة سجل المستخدم من قاعدة البيانات وطلبات الأستاذ المرتبطة به.`
    );

    if (!confirmDelete) return;

    let hardDeleted = false;

    // 1) users/{uid}: حاول حذف، وإن فشل بسبب rules → أرشف
    try {
      await deleteDoc(doc(db, "users", targetUid));
      hardDeleted = true;
    } catch (error) {
      if (!isPermissionDenied(error)) throw error;

      await updateDoc(doc(db, "users", targetUid), {
        status: "deleted",
        role: "deleted",
        deletedAt: serverTimestamp(),
        deletedBy: auth.currentUser?.uid || null
      });
    }

    // 2) linked collections cleanup (best-effort)
    await purgeLinkedCollectionsBestEffort(targetUid);

    // 3) Update UI cache
    if (hardDeleted) {
      allUsers = allUsers.filter((item) => (item.uid || item.id) !== targetUid);
    } else {
      allUsers = allUsers.map((item) => {
        if ((item.uid || item.id) !== targetUid) return item;
        return { ...item, status: "deleted", role: "deleted" };
      });
    }

    applyFilters();

    // 4) Best-effort: queue auth deletion
    const queued = await queueAuthDeletion(user);

    // 5) User feedback
    if (!hardDeleted) {
      alert(
        "تمت أرشفة الحساب بدل الحذف الكامل لأن قواعد Firestore تمنع delete.\n" +
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
          alert("تعذّر حذف/أرشفة المستخدم. تحقق من Firestore Rules أو صلاحيات الأدمن.");
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
