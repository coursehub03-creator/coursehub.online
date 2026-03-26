import { db } from "/js/firebase-config.js";
import { protectAdmin } from "./admin-guard.js";
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

document.addEventListener("DOMContentLoaded", () => {
  initCoursesAdmin().catch((error) => {
    console.error("فشل تهيئة إدارة الدورات:", error);
    alert("تعذر تحميل لوحة الدورات. تحقق من الصلاحيات أو قواعد Firestore.");
  });
});

const isPermissionDenied = (error) => {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  return code.includes("permission-denied") || message.includes("insufficient permissions");
};

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const formatNumber = (value) => Number(value || 0).toLocaleString("ar");

async function initCoursesAdmin() {
  await protectAdmin();

  const addBtn = document.getElementById("add-course-btn");
  const tbody = document.getElementById("courses-list");
  const statusFilter = document.getElementById("course-status-filter");
  const searchInput = document.getElementById("course-search");
  const categoryFilter = document.getElementById("course-category-filter");
  const submissionsTbody = document.getElementById("instructor-submissions-list");
  const instructorsList = document.getElementById("instructors-list");
  const instructorsCount = document.getElementById("instructorsCount");
  const instructorSearch = document.getElementById("instructor-search");
  const submissionStatusFilter = document.getElementById("submission-status-filter");
  const submissionSearch = document.getElementById("submission-search");

  if (!addBtn || !tbody || !submissionsTbody) return;

  const functions = getFunctions(undefined, "us-central1");
  const reviewInstructorCourseSubmission = httpsCallable(
    functions,
    "reviewInstructorCourseSubmission"
  );

  const callableAllowedHosts = new Set([
    "localhost",
    "127.0.0.1",
    "coursehub-23ed2.web.app",
    "coursehub-23ed2.firebaseapp.com"
  ]);

  const shouldUseCallable = callableAllowedHosts.has(window.location.hostname);

  addBtn.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "/admin/add-course.html";
  });

  let allCourses = [];
  let allUsers = [];
  let allCategories = [];
  let allSubmissions = [];
  let selectedInstructorId = "all";

  const userNameMap = new Map();

  function fillUserMaps() {
    userNameMap.clear();
    allUsers.forEach((u) => {
      const key = u.uid || u.id;
      userNameMap.set(key, u.name || u.email || "أستاذ");
    });
  }

  const getInstructorName = (course) => {
    if (course.instructorName) return course.instructorName;
    if (course.instructorId && userNameMap.has(course.instructorId)) {
      return userNameMap.get(course.instructorId);
    }
    if (course.instructorEmail) return course.instructorEmail;
    return "أستاذ بدون اسم";
  };

  const getCourseInstructorKey = (course) =>
    course.instructorId || course.instructorEmail || "unknown";

  async function loadCategories() {
    try {
      const snap = await getDocs(collection(db, "courseCategories"));
      allCategories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn("تعذر تحميل التصنيفات:", e);
      allCategories = [];
    }

    if (!allCategories.length && allCourses.length) {
      const inferred = [
        ...new Set(
          allCourses
            .map((c) => String(c.category || "").trim())
            .filter(Boolean)
        )
      ];
      allCategories = inferred.map((name) => ({ id: `inferred-${name}`, name }));
    }

    if (!categoryFilter) return;

    const current = categoryFilter.value || "all";
    categoryFilter.innerHTML =
      "<option value='all'>كل التصنيفات</option>" +
      allCategories
        .map(
          (c) =>
            `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`
        )
        .join("");

    if (["all", ...allCategories.map((c) => c.name)].includes(current)) {
      categoryFilter.value = current;
    }
  }

  async function loadUsers() {
    try {
      const snap = await getDocs(collection(db, "users"));
      allUsers = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        uid: d.data().uid || d.id
      }));
    } catch (e) {
      console.warn("تعذر تحميل المستخدمين:", e);
      allUsers = [];
    }

    fillUserMaps();
  }

  async function loadCourses() {
    try {
      const snap = await getDocs(collection(db, "courses"));
      allCourses = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn("تعذر تحميل الدورات:", e);
      tbody.innerHTML = isPermissionDenied(e)
        ? "<tr><td colspan='8'>لا تملك صلاحية لقراءة الدورات.</td></tr>"
        : "<tr><td colspan='8'>تعذر تحميل الدورات حالياً.</td></tr>";
      allCourses = [];
    }
  }

  async function updateCourseStatus(id, nextStatus) {
    if (!id || !nextStatus) return;

    const allowedStatuses = new Set(["draft", "review", "published", "archived"]);
    if (!allowedStatuses.has(nextStatus)) {
      alert("حالة الدورة غير صالحة.");
      return;
    }

    const storedUser = JSON.parse(localStorage.getItem("coursehub_user") || "null");
    const actor = storedUser?.uid || storedUser?.email || "admin";

    const currentCourse = allCourses.find((item) => item.id === id) || null;
    const currentStatus = String(currentCourse?.status || "draft");

    const payload = {
      status: nextStatus,
      updatedAt: serverTimestamp(),
      statusChangedAt: serverTimestamp(),
      statusChangedBy: actor
    };

    if (nextStatus === "published" && currentStatus !== "published") {
      payload.publishedAt = serverTimestamp();
    }

    if (currentStatus === "published" && nextStatus !== "published") {
      payload.unpublishedAt = serverTimestamp();
    }

    try {
      await updateDoc(doc(db, "courses", id), payload);

      const idx = allCourses.findIndex((item) => item.id === id);
      if (idx >= 0) {
        allCourses[idx] = {
          ...allCourses[idx],
          status: nextStatus
        };
      }

      renderInstructors();
      renderCourses();
    } catch (error) {
      console.error("تعذر تحديث حالة الدورة:", error);
      alert(
        isPermissionDenied(error)
          ? "لا تملك صلاحية تحديث حالة الدورة."
          : "تعذر تحديث حالة الدورة حالياً."
      );
    }
  }

  async function loadSubmissions() {
    try {
      const snap = await getDocs(collection(db, "instructorCourseSubmissions"));
      allSubmissions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn("تعذر تحميل طلبات الأساتذة:", e);
      submissionsTbody.innerHTML = isPermissionDenied(e)
        ? "<tr><td colspan='6'>لا تملك صلاحية لطلبات الأساتذة.</td></tr>"
        : "<tr><td colspan='6'>تعذر تحميل طلبات الأساتذة حالياً.</td></tr>";
      allSubmissions = [];
    }
  }

  function renderInstructors() {
    if (!instructorsList || !instructorsCount) return;

    const q = String(instructorSearch?.value || "").trim().toLowerCase();
    const map = new Map();

    allCourses.forEach((course) => {
      const key = getCourseInstructorKey(course);
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: getInstructorName(course),
          count: 0
        });
      }
      map.get(key).count += 1;
    });

    let instructors = [...map.values()].sort((a, b) => b.count - a.count);
    if (q) {
      instructors = instructors.filter((item) =>
        String(item.name).toLowerCase().includes(q)
      );
    }

    instructorsCount.textContent = formatNumber(instructors.length);

    const allActive = selectedInstructorId === "all" ? "active" : "";
    const allCount = formatNumber(allCourses.length);
    const baseItem = `<button class="instructor-item ${allActive}" data-instructor-id="all">كل الأساتذة <span>${allCount}</span></button>`;

    if (!instructors.length) {
      instructorsList.innerHTML = `${baseItem}<div class="empty-note">لا يوجد أساتذة مطابقون.</div>`;
    } else {
      instructorsList.innerHTML =
        baseItem +
        instructors
          .map((item) => {
            const active = selectedInstructorId === item.key ? "active" : "";
            return `<button class="instructor-item ${active}" data-instructor-id="${escapeHtml(item.key)}">${escapeHtml(item.name)} <span>${formatNumber(item.count)}</span></button>`;
          })
          .join("");
    }

    instructorsList.querySelectorAll("[data-instructor-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedInstructorId = btn.dataset.instructorId || "all";
        renderInstructors();
        renderCourses();
      });
    });
  }

  function renderCourses() {
    const q = String(searchInput?.value || "").trim().toLowerCase();
    const status = statusFilter?.value || "all";
    const category = categoryFilter?.value || "all";

    const rows = allCourses
      .filter((course) => {
        if (
          selectedInstructorId !== "all" &&
          getCourseInstructorKey(course) !== selectedInstructorId
        ) {
          return false;
        }
        if (status !== "all" && String(course.status || "draft") !== status) {
          return false;
        }
        if (category !== "all" && String(course.category || "") !== category) {
          return false;
        }
        if (q) {
          const text = [
            course.title,
            course.description,
            course.instructorName,
            course.instructorEmail
          ]
            .map((x) => String(x || "").toLowerCase())
            .join(" ");
          if (!text.includes(q)) return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          Number(b.updatedAt?.seconds || b.createdAt?.seconds || 0) -
          Number(a.updatedAt?.seconds || a.createdAt?.seconds || 0)
      );

    if (!rows.length) {
      tbody.innerHTML =
        "<tr><td colspan='8'>لا توجد دورات مطابقة للفلاتر الحالية.</td></tr>";
      return;
    }

    tbody.innerHTML = rows
      .map((course) => {
        const enrolled = Number(course.enrollmentsCount || 0);
        const completed = Number(course.completedCount || 0);
        const inProgress = Math.max(enrolled - completed, 0);
        const currentStatus = String(course.status || "draft");
        const allStatuses = [
          { value: "draft", label: "مسودة" },
          { value: "review", label: "قيد المراجعة" },
          { value: "published", label: "منشورة" },
          { value: "archived", label: "مؤرشفة" }
        ];
        const statusOptions = allStatuses
          .filter((option) => option.value !== currentStatus)
          .map(
            (option) => `<option value="${option.value}">${option.label}</option>`
          )
          .join("");

        return `
          <tr>
            <td>${escapeHtml(course.title || "(بدون عنوان)")}</td>
            <td>${escapeHtml(getInstructorName(course))}</td>
            <td>${escapeHtml(course.category || "-")}</td>
            <td><span class="badge neutral">${escapeHtml(currentStatus)}</span></td>
            <td>${formatNumber(enrolled)}</td>
            <td>${formatNumber(completed)}</td>
            <td>${formatNumber(inProgress)}</td>
            <td>
              <a class="btn outline small" href="/admin/edit-course.html?id=${encodeURIComponent(course.id)}">تعديل</a>
              <select class="status-select" data-course-status-select="${escapeHtml(course.id)}">
                <option value="">غيّر الحالة…</option>
                ${statusOptions}
              </select>
              <button class="btn small" data-course-status-apply="${escapeHtml(course.id)}">تطبيق</button>
              <button class="btn danger small" data-delete-course="${escapeHtml(course.id)}">حذف</button>
            </td>
          </tr>
        `;
      })
      .join("");

    tbody.querySelectorAll("[data-delete-course]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.deleteCourse;
        if (!id) return;
        if (!confirm("هل تريد حذف هذه الدورة؟")) return;

        try {
          await deleteDoc(doc(db, "courses", id));
          allCourses = allCourses.filter((item) => item.id !== id);
          renderInstructors();
          renderCourses();
        } catch (error) {
          console.error("تعذر حذف الدورة:", error);
          alert(
            isPermissionDenied(error)
              ? "لا تملك صلاحية حذف الدورة."
              : "تعذر حذف الدورة حالياً."
          );
        }
      });
    });

    tbody.querySelectorAll("[data-course-status-apply]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.courseStatusApply;
        const select = btn.parentElement?.querySelector("[data-course-status-select]");
        const nextStatus = String(select?.value || "");

        if (!id || !nextStatus) {
          alert("اختر حالة جديدة أولاً.");
          return;
        }

        const statusLabels = {
          draft: "مسودة",
          review: "قيد المراجعة",
          published: "منشورة",
          archived: "مؤرشفة"
        };

        if (
          !confirm(
            `تأكيد نقل الدورة إلى حالة: ${statusLabels[nextStatus] || nextStatus}؟`
          )
        ) {
          return;
        }

        btn.disabled = true;
        try {
          await updateCourseStatus(id, nextStatus);
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  async function updateSubmissionStatus(id, decision, reason = "") {
    if (!id) return;

    try {
      if (shouldUseCallable) {
        await reviewInstructorCourseSubmission({ submissionId: id, decision, reason });
      } else {
        const status = decision === "approve" ? "approved" : "rejected";
        await updateDoc(doc(db, "instructorCourseSubmissions", id), {
          status,
          reviewReason: status === "rejected" ? reason : "",
          reviewedAt: serverTimestamp()
        });
      }

      if (decision === "approve") {
        await loadCourses();
      }

      await loadSubmissions();
      renderCourses();
      renderSubmissions();
    } catch (error) {
      console.error("تعذر تحديث حالة الطلب:", error);
      alert(
        isPermissionDenied(error)
          ? "لا تملك صلاحية مراجعة الطلب."
          : "تعذر تحديث حالة الطلب."
      );
    }
  }

  function renderSubmissions() {
    const q = String(submissionSearch?.value || "").trim().toLowerCase();
    const status = submissionStatusFilter?.value || "all";

    const rows = allSubmissions
      .filter((item) => {
        if (status !== "all" && String(item.status || "pending") !== status) {
          return false;
        }
        if (!q) return true;
        const searchable = [
          item.title,
          item.instructorName,
          item.instructorEmail,
          item.note
        ]
          .map((x) => String(x || "").toLowerCase())
          .join(" ");
        return searchable.includes(q);
      })
      .sort((a, b) => Number(b.createdAt?.seconds || 0) - Number(a.createdAt?.seconds || 0));

    if (!rows.length) {
      submissionsTbody.innerHTML =
        "<tr><td colspan='6'>لا توجد طلبات مطابقة.</td></tr>";
      return;
    }

    submissionsTbody.innerHTML = rows
      .map((item) => {
        const currentStatus = String(item.status || "pending");
        return `
          <tr>
            <td>${escapeHtml(item.title || "-")}</td>
            <td>${escapeHtml(item.instructorName || item.instructorEmail || "-")}</td>
            <td>${escapeHtml(item.summary || "-")}</td>
            <td>${escapeHtml(currentStatus)}</td>
            <td>${escapeHtml(item.note || "-")}</td>
            <td>
              <button class="btn small" data-review-id="${escapeHtml(item.id)}" data-decision="approve">اعتماد وتحويل لمسودة</button>
              <button class="btn danger small" data-review-id="${escapeHtml(item.id)}" data-decision="reject">رفض</button>
            </td>
          </tr>
        `;
      })
      .join("");

    submissionsTbody.querySelectorAll("[data-review-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.reviewId;
        const decision = String(btn.dataset.decision || "");
        if (!id || !decision) return;

        let reason = "";
        if (decision === "reject") {
          reason = prompt("اكتب سبب الرفض (إلزامي):", "")?.trim() || "";
          if (!reason) {
            alert("سبب الرفض مطلوب.");
            return;
          }
        }

        const decisionText =
          decision === "approve" ? "اعتماد الطلب وتحويله لمسودة" : "رفض الطلب";

        if (!confirm(`تأكيد ${decisionText}؟`)) return;

        btn.disabled = true;
        try {
          await updateSubmissionStatus(id, decision, reason);
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  await Promise.allSettled([loadUsers(), loadCourses(), loadSubmissions()]);
  await loadCategories();

  renderInstructors();
  renderCourses();
  renderSubmissions();

  [statusFilter, categoryFilter, searchInput].forEach((input) =>
    input?.addEventListener("input", renderCourses)
  );

  [submissionStatusFilter, submissionSearch].forEach((input) =>
    input?.addEventListener("input", renderSubmissions)
  );

  instructorSearch?.addEventListener("input", renderInstructors);
}