import { db } from "/js/firebase-config.js";
import { protectAdmin } from "./admin-guard.js";
import {
  collection,
  getDocs,
  addDoc,
  doc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

document.addEventListener("DOMContentLoaded", () => {
  initCoursesAdmin().catch((error) => {
    console.error("فشل تهيئة إدارة الدورات:", error);
    alert("تعذر تحميل لوحة الدورات. تحقق من الصلاحيات أو قواعد Firestore.");
  });
});

/* ===== Helper ===== */
const isPermissionDenied = (error) => {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  return code.includes("permission-denied") || message.includes("insufficient permissions");
};

async function initCoursesAdmin() {
  const adminUser = await protectAdmin();
  console.log("أدمن مسجل:", adminUser?.email || "-");

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

  const functions = getFunctions(undefined, "us-central1");
  const reviewInstructorCourseSubmission = httpsCallable(functions, "reviewInstructorCourseSubmission");

  const callableAllowedHosts = new Set([
    "localhost",
    "127.0.0.1",
    "coursehub-23ed2.web.app",
    "coursehub-23ed2.firebaseapp.com"
  ]);

  const shouldUseCallable = callableAllowedHosts.has(window.location.hostname);

  if (!addBtn || !tbody) return;

  addBtn.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "/admin/add-course.html";
  });

  let allCourses = [];
  let allUsers = [];
  let allCategories = [];
  let enrollmentsMap = new Map();
  let completionsMap = new Map();
  let submissionsMap = new Map();
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
  const userEmailMap = new Map();

  const getInstructorName = (course) => {
    if (course.instructorId && userNameMap.has(course.instructorId))
      return userNameMap.get(course.instructorId);
    return course.instructorName || course.instructorEmail || "غير محدد";
  };

  const getCourseInstructorKey = (course) =>
    course.instructorId || course.instructorEmail || "unknown";

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
    const moduleLines = modules.map((m, i) => {
      const lessons = (m.lessons || []).map((l) => `- ${l.title || "بدون عنوان"}`).join("\n");
      return `الوحدة ${i + 1}: ${m.title || "بدون عنوان"}\n${lessons}`;
    }).join("\n\n");

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
      allCategories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      if (!isPermissionDenied(e)) throw e;
      allCategories = [];
    }

    if (!categoryFilter) return;

    const current = categoryFilter.value || "all";

    categoryFilter.innerHTML =
      "<option value='all'>كل التصنيفات</option>" +
      allCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join("");

    if (["all", ...allCategories.map(c => c.name)].includes(current)) {
      categoryFilter.value = current;
    }
  }

  async function loadUsers() {
    try {
      const snap = await getDocs(collection(db, "users"));
      allUsers = snap.docs.map(d => ({ id: d.id, ...d.data(), uid: d.data().uid || d.id }));
    } catch (e) {
      if (!isPermissionDenied(e)) throw e;
      allUsers = [];
    }

    userNameMap.clear();
    userEmailMap.clear();

    allUsers.forEach(u => {
      const key = u.uid || u.id;
      userNameMap.set(key, u.name || u.email || "أستاذ");
      userEmailMap.set(key, u.email || "");
    });
  }

  async function loadCourses() {
    try {
      const snap = await getDocs(collection(db, "courses"));
      allCourses = snap.docs.map(d => ({ id: d.id, data: d.data() }));
    } catch (e) {
      if (isPermissionDenied(e)) {
        tbody.innerHTML = "<tr><td colspan='8'>لا تملك صلاحية</td></tr>";
        return;
      }
      throw e;
    }
  }

  await loadUsers();
  await loadCategories();
  await loadCourses();
}