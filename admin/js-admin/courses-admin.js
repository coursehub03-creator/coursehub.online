import { db } from "/js/firebase-config.js";
import { protectAdmin } from "./admin-guard.js";
import {
  collection,
  getDocs,
  addDoc,
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
  const reviewInstructorCourseSubmission = httpsCallable(functions, "reviewInstructorCourseSubmission");
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
  let enrollmentsMap = new Map();
  let completionsMap = new Map();
  let selectedInstructorId = "all";

  const statusBadge = (status) => {
    if (status === "published") return "<span class='badge success'>منشورة</span>";
    if (status === "review") return "<span class='badge warning'>قيد المراجعة</span>";
    if (status === "archived") return "<span class='badge neutral'>مؤرشفة</span>";
    return "<span class='badge neutral'>مسودة</span>";
  };

  const submissionStatusBadge = (status) => {
    if (status === "approved") return "<span class='badge success'>معتمدة</span>";
    if (status === "rejected") return "<span class='badge danger'>مرفوضة</span>";
    return "<span class='badge warning'>قيد المراجعة</span>";
  };

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
    if (course.instructorId && userNameMap.has(course.instructorId)) return userNameMap.get(course.instructorId);
    if (course.instructorEmail) return course.instructorEmail;
    return "أستاذ بدون اسم";
  };

  const getCourseInstructorKey = (course) => course.instructorId || course.instructorEmail || "unknown";

  const renderCourseActions = (id, status) => {
    const edit = `<a class="btn outline small" href="/admin/edit-course.html?id=${id}">تعديل</a>`;
    const publish = `<button class="btn success small publish-btn" data-id="${id}">نشر</button>`;
    const review = `<button class="btn small review-btn" data-id="${id}">إرسال للمراجعة</button>`;
    const archive = `<button class="btn outline small archive-btn" data-id="${id}">أرشفة</button>`;
    const del = `<button class="delete-btn" data-id="${id}">حذف</button>`;

    if (status === "published") return `${edit} ${archive} ${del}`;
    if (status === "archived") return `${edit} ${review} ${publish} ${del}`;
    if (status === "review") return `${edit} ${publish} ${archive} ${del}`;
    return `${edit} ${review} ${publish} ${del}`;
  };

  function buildSubmissionPreview(item) {
    const modules = item.modules || [];
    const moduleLines = modules
      .map((m, i) => {
        const lessons = (m.lessons || []).map((l) => `- ${l.title || "بدون عنوان"}`).join("\n");
        return `الوحدة ${i + 1}: ${m.title || "بدون عنوان"}\n${lessons}`;
      })
      .join("\n\n");

    return [
      `العنوان: ${item.title || "-"}`,
      `الأستاذ: ${item.instructorEmail || "-"}`,
      "",
      "المنهج:",
      moduleLines || "لا توجد وحدات"
    ].join("\n");
  }

  async function loadCategories() {
    try {
      const snap = await getDocs(collection(db, "courseCategories"));
      allCategories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      if (!isPermissionDenied(e)) throw e;
      allCategories = [];
    }

    if (!categoryFilter) return;
    const current = categoryFilter.value || "all";
    categoryFilter.innerHTML =
      "<option value='all'>كل التصنيفات</option>" +
      allCategories.map((c) => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join("");
    if (["all", ...allCategories.map((c) => c.name)].includes(current)) categoryFilter.value = current;
  }

  async function loadUsers() {
    try {
      const snap = await getDocs(collection(db, "users"));
      allUsers = snap.docs.map((d) => ({ id: d.id, ...d.data(), uid: d.data().uid || d.id }));
    } catch (e) {
      if (!isPermissionDenied(e)) throw e;
      allUsers = [];
    }
    fillUserMaps();
  }

  async function loadCourses() {
    try {
      const snap = await getDocs(collection(db, "courses"));
      allCourses = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      if (isPermissionDenied(e)) {
        tbody.innerHTML = "<tr><td colspan='8'>لا تملك صلاحية</td></tr>";
        allCourses = [];
        return;
      }
      throw e;
    }
  }

  async function loadEnrollmentStats() {
    try {
      const [enrollSnap, certSnap] = await Promise.all([
        getDocs(collection(db, "enrollments")),
        getDocs(collection(db, "certificates"))
      ]);

      enrollmentsMap = new Map();
      completionsMap = new Map();
      enrollSnap.docs.forEach((d) => {
        const { courseId } = d.data() || {};
        if (!courseId) return;
        enrollmentsMap.set(courseId, (enrollmentsMap.get(courseId) || 0) + 1);
      });
      certSnap.docs.forEach((d) => {
        const { courseId } = d.data() || {};
        if (!courseId) return;
        completionsMap.set(courseId, (completionsMap.get(courseId) || 0) + 1);
      });
    } catch (e) {
      if (!isPermissionDenied(e)) throw e;
      enrollmentsMap = new Map();
      completionsMap = new Map();
    }
  }

  async function loadSubmissions() {
    try {
      const snap = await getDocs(collection(db, "instructorCourseSubmissions"));
      allSubmissions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (e) {
      if (isPermissionDenied(e)) {
        submissionsTbody.innerHTML = "<tr><td colspan='6'>لا تملك صلاحية لطلبات الأساتذة.</td></tr>";
        allSubmissions = [];
        return;
      }
      throw e;
    }
  }

  function renderInstructors() {
    if (!instructorsList) return;

    const counts = new Map();
    allCourses.forEach((course) => {
      const key = getCourseInstructorKey(course);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const instructorRows = [...counts.keys()].map((key) => {
      const user = allUsers.find((u) => (u.uid || u.id) === key || u.email === key);
      const sampleCourse = allCourses.find((course) => getCourseInstructorKey(course) === key);
      const derivedName =
        sampleCourse?.instructorName ||
        sampleCourse?.instructorEmail ||
        user?.name ||
        user?.email ||
        "أستاذ بدون اسم";
      return {
        key,
        name: derivedName,
        email: sampleCourse?.instructorEmail || user?.email || "",
        count: counts.get(key) || 0
      };
    });

    const q = (instructorSearch?.value || "").trim().toLowerCase();
    const filtered = instructorRows.filter((i) => !q || i.name.toLowerCase().includes(q) || i.email.toLowerCase().includes(q));

    if (instructorsCount) instructorsCount.textContent = String(instructorRows.length);

    instructorsList.innerHTML = [
      `<button type="button" class="instructor-pill ${selectedInstructorId === "all" ? "active" : ""}" data-id="all">كل الأساتذة <span>${allCourses.length}</span></button>`,
      ...filtered.map(
        (i) => `<button type="button" class="instructor-pill ${selectedInstructorId === i.key ? "active" : ""}" data-id="${escapeHtml(i.key)}">${escapeHtml(i.name)} <span>${i.count}</span></button>`
      )
    ].join("");

    instructorsList.querySelectorAll(".instructor-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedInstructorId = btn.dataset.id || "all";
        renderInstructors();
        renderCourses();
      });
    });
  }

  function renderCourses() {
    let rows = allCourses.slice();

    const status = statusFilter?.value || "all";
    const category = categoryFilter?.value || "all";
    const q = (searchInput?.value || "").trim().toLowerCase();

    if (selectedInstructorId !== "all") {
      rows = rows.filter((c) => getCourseInstructorKey(c) === selectedInstructorId);
    }
    if (status !== "all") rows = rows.filter((c) => String(c.status || "draft") === status);
    if (category !== "all") rows = rows.filter((c) => String(c.category || "") === category);
    if (q) {
      rows = rows.filter((c) => {
        const title = String(c.title || "").toLowerCase();
        const instructor = String(getInstructorName(c) || "").toLowerCase();
        return title.includes(q) || instructor.includes(q);
      });
    }

    if (!rows.length) {
      tbody.innerHTML = "<tr><td colspan='8'>لا توجد دورات مطابقة للفلاتر.</td></tr>";
      return;
    }

    tbody.innerHTML = rows
      .map((course) => {
        const started = enrollmentsMap.get(course.id) || 0;
        const completed = completionsMap.get(course.id) || 0;
        const notCompleted = Math.max(started - completed, 0);
        return `
          <tr>
            <td>${escapeHtml(course.title || "-")}</td>
            <td>${escapeHtml(getInstructorName(course))}</td>
            <td>${escapeHtml(course.category || "-")}</td>
            <td>${statusBadge(String(course.status || "draft"))}</td>
            <td>${started}</td>
            <td>${completed}</td>
            <td>${notCompleted}</td>
            <td class="actions-cell">${renderCourseActions(course.id, String(course.status || "draft"))}</td>
          </tr>
        `;
      })
      .join("");

    tbody.querySelectorAll(".publish-btn").forEach((btn) => {
      btn.addEventListener("click", () => updateCourseStatus(btn.dataset.id, "published"));
    });
    tbody.querySelectorAll(".review-btn").forEach((btn) => {
      btn.addEventListener("click", () => updateCourseStatus(btn.dataset.id, "review"));
    });
    tbody.querySelectorAll(".archive-btn").forEach((btn) => {
      btn.addEventListener("click", () => updateCourseStatus(btn.dataset.id, "archived"));
    });
    tbody.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", () => deleteCourse(btn.dataset.id));
    });
  }

  function renderSubmissions() {
    let rows = allSubmissions.slice().sort((a, b) => {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    });

    const status = submissionStatusFilter?.value || "all";
    const q = (submissionSearch?.value || "").trim().toLowerCase();

    if (status !== "all") rows = rows.filter((s) => String(s.status || "pending") === status);
    if (q) {
      rows = rows.filter((s) => {
        const title = String(s.title || "").toLowerCase();
        const email = String(s.instructorEmail || "").toLowerCase();
        return title.includes(q) || email.includes(q);
      });
    }

    if (!rows.length) {
      submissionsTbody.innerHTML = "<tr><td colspan='6'>لا توجد طلبات مطابقة.</td></tr>";
      return;
    }

    submissionsTbody.innerHTML = rows
      .map((s) => {
        const preview = escapeHtml(buildSubmissionPreview(s));
        const reason = escapeHtml(s.reviewReason || "-");
        const id = escapeHtml(s.id);
        const statusValue = String(s.status || "pending");

        return `
          <tr>
            <td>${escapeHtml(s.title || "-")}</td>
            <td>${escapeHtml(s.instructorEmail || "-")}</td>
            <td><details><summary>عرض</summary><pre style="white-space:pre-wrap">${preview}</pre></details></td>
            <td>${submissionStatusBadge(statusValue)}</td>
            <td>${reason}</td>
            <td class="actions-cell">
              <button class="btn success small approve-submission-btn" data-id="${id}" ${statusValue === "approved" ? "disabled" : ""}>اعتماد</button>
              <button class="btn outline small reject-submission-btn" data-id="${id}">رفض</button>
            </td>
          </tr>
        `;
      })
      .join("");

    submissionsTbody.querySelectorAll(".approve-submission-btn").forEach((btn) => {
      btn.addEventListener("click", () => reviewSubmission(btn.dataset.id, "approved"));
    });

    submissionsTbody.querySelectorAll(".reject-submission-btn").forEach((btn) => {
      btn.addEventListener("click", () => reviewSubmission(btn.dataset.id, "rejected"));
    });
  }

  async function updateCourseStatus(courseId, status) {
    if (!courseId) return;
    try {
      await updateDoc(doc(db, "courses", courseId), { status, updatedAt: serverTimestamp() });
      const item = allCourses.find((c) => c.id === courseId);
      if (item) item.status = status;
      renderCourses();
    } catch (error) {
      console.error("تعذر تحديث حالة الدورة", error);
      alert("تعذر تحديث حالة الدورة.");
    }
  }

  async function deleteCourse(courseId) {
    if (!courseId) return;
    if (!confirm("هل تريد حذف الدورة نهائيًا؟")) return;
    try {
      await deleteDoc(doc(db, "courses", courseId));
      allCourses = allCourses.filter((c) => c.id !== courseId);
      renderInstructors();
      renderCourses();
    } catch (error) {
      console.error("تعذر حذف الدورة", error);
      alert("تعذر حذف الدورة.");
    }
  }

  async function reviewSubmission(submissionId, action) {
    const row = allSubmissions.find((item) => item.id === submissionId);
    if (!row) return;

    const reason = action === "rejected"
      ? (prompt("سبب الرفض (إلزامي):") || "").trim()
      : (prompt("ملاحظة للإرسال (اختياري):") || "").trim();

    if (action === "rejected" && !reason) {
      alert("يرجى كتابة سبب الرفض.");
      return;
    }

    try {
      if (shouldUseCallable) {
        await reviewInstructorCourseSubmission({
          submissionId,
          action,
          reviewReason: reason
        });
      } else {
        if (action === "approved") {
          const payload = {
            title: row.title || "دورة بدون عنوان",
            description: row.description || "",
            category: row.category || "general",
            level: row.level || "beginner",
            image: row.cover || "/assets/images/default-course.png",
            status: "published",
            modules: row.modules || [],
            lessons: row.lessons || [],
            objectives: row.objectives || [],
            instructorId: row.instructorId || "",
            instructorEmail: row.instructorEmail || "",
            instructorName: row.instructorName || "",
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp()
          };

          if (row.courseId) {
            await updateDoc(doc(db, "courses", row.courseId), payload);
          } else {
            const created = await addDoc(collection(db, "courses"), payload);
            row.courseId = created.id;
          }
        }

        await updateDoc(doc(db, "instructorCourseSubmissions", submissionId), {
          status: action,
          reviewReason: reason,
          reviewedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          courseId: row.courseId || null
        });
      }

      row.status = action;
      row.reviewReason = reason;
      await Promise.all([loadCourses(), loadSubmissions()]);
      renderInstructors();
      renderCourses();
      renderSubmissions();
    } catch (error) {
      console.error("تعذر معالجة طلب الأستاذ", error);
      alert("تعذر معالجة طلب النشر.");
    }
  }

  statusFilter?.addEventListener("change", renderCourses);
  categoryFilter?.addEventListener("change", renderCourses);
  searchInput?.addEventListener("input", renderCourses);
  instructorSearch?.addEventListener("input", renderInstructors);
  submissionStatusFilter?.addEventListener("change", renderSubmissions);
  submissionSearch?.addEventListener("input", renderSubmissions);

  await Promise.all([loadUsers(), loadCategories(), loadCourses(), loadEnrollmentStats(), loadSubmissions()]);
  renderInstructors();
  renderCourses();
  renderSubmissions();
}
