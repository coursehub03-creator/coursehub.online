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

/* ===== Helpers ===== */
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

/* ===== Main ===== */
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
    if (course.instructorId && userNameMap.has(course.instructorId))
      return userNameMap.get(course.instructorId);
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

    if (!categoryFilter) return;

    const current = categoryFilter.value || "all";

    categoryFilter.innerHTML =
      "<option value='all'>كل التصنيفات</option>" +
      allCategories.map((c) => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join("");

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

  await Promise.allSettled([
    loadUsers(),
    loadCategories(),
    loadCourses(),
    loadSubmissions()
  ]);
}