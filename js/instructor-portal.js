import { auth, db } from "/js/firebase-config.js";
import { collection, getDocs, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const page = document.body.dataset.instructorPage;

function getStoredUser() {
  const u = JSON.parse(localStorage.getItem("coursehub_user") || "null");
  if (u && u.role === "user") u.role = "student";
  return u;
}

function guardInstructor() {
  const user = getStoredUser();
  if (!user) {
    window.location.href = "/login.html";
    return null;
  }
  if (user.role !== "instructor") {
    window.location.href = "/my-courses.html";
    return null;
  }
  document.getElementById("instructorName") && (document.getElementById("instructorName").textContent = user.name || "الأستاذ");
  return user;
}

function setActiveNav() {
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === page));
}

function badge(status) {
  const s = String(status || "draft").toLowerCase();
  const normalized = s === "pending" ? "submitted" : s;
  return `<span class="ch-badge ${normalized === "under_review" ? "in_review" : normalized}">${normalized}</span>`;
}

async function loadMetrics(uid) {
  const isPermissionDenied = (error) => {
    const code = String(error?.code || "");
    const msg = String(error?.message || "");
    return code.includes("permission-denied") || msg.includes("Missing or insufficient permissions");
  };

  const safeGetDocs = async (label, resolver) => {
    try {
      return await resolver();
    } catch (error) {
      if (!isPermissionDenied(error)) {
        console.warn(`تعذر تحميل ${label} بسبب خطأ غير متوقع`, error);
      }
      return { docs: [] };
    }
  };

  const [coursesSnap, enrollmentsSnap, certsSnap, submissionsSnap, attemptsSnap] = await Promise.all([
    safeGetDocs("الدورات", () => getDocs(query(collection(db, "courses"), where("instructorId", "==", uid)))),
    safeGetDocs("التسجيلات", () => getDocs(collection(db, "enrollments"))),
    safeGetDocs("الشهادات", () => getDocs(collection(db, "certificates"))),
    safeGetDocs("طلبات المراجعة", () =>
      getDocs(query(collection(db, "instructorCourseSubmissions"), where("instructorId", "==", uid), orderBy("createdAt", "desc"), limit(10)))
    ),
    safeGetDocs("محاولات الاختبار", () => getDocs(collection(db, "quizAttempts")))
  ]);

  const courses = coursesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const courseIds = new Set(courses.map((c) => c.id));
  const enrollments = enrollmentsSnap.docs.map((d) => d.data()).filter((x) => courseIds.has(x.courseId));
  const certs = certsSnap.docs.map((d) => d.data()).filter((x) => courseIds.has(x.courseId));
  const submissions = submissionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const attempts = attemptsSnap.docs.map((d) => d.data()).filter((x) => courseIds.has(x.courseId));

  return { courses, enrollments, certs, submissions, attempts };
}

function fillDashboard(data) {
  const totalStudents = new Set(data.enrollments.map((x) => x.userId)).size;
  const completions = new Set(data.certs.map((x) => `${x.courseId}_${x.userId}`)).size;
  const completionRate = totalStudents ? Math.round((completions / totalStudents) * 100) : 0;
  const published = data.courses.filter((c) => c.status === "published").length;
  const draft = data.courses.filter((c) => c.status === "draft").length;
  const inReview = data.submissions.filter((s) => ["pending", "submitted", "under_review", "resubmitted"].includes(String(s.status || ""))).length;

  const set = (id, value) => document.getElementById(id) && (document.getElementById(id).textContent = String(value));
  set("metricStudents", totalStudents);
  set("metricCompletions", completions);
  set("metricCompletionRate", `${completionRate}%`);
  set("metricPublished", published);
  set("metricDraft", draft);
  set("metricInReview", inReview);

  const latestReviews = document.getElementById("latestReviews");
  if (latestReviews) {
    latestReviews.innerHTML = data.submissions.length
      ? data.submissions.map((s) => `<div style="padding:8px 0;border-bottom:1px solid var(--color-border)"><strong>${s.title || "دورة بدون عنوان"}</strong> ${badge(s.status || "submitted")} ${(s.reviewReason || s.note) ? `<p>ملاحظات المراجعة: ${s.reviewReason || s.note}</p>` : ""}</div>`).join("")
      : "لا توجد عمليات مراجعة حتى الآن.";
  }
}

function fillCourses(data) {
  const rows = document.getElementById("coursesRows");
  if (!rows) return;
  const enrollByCourse = new Map();
  data.enrollments.forEach((x) => enrollByCourse.set(x.courseId, (enrollByCourse.get(x.courseId) || 0) + 1));
  const doneByCourse = new Map();
  data.certs.forEach((x) => doneByCourse.set(x.courseId, (doneByCourse.get(x.courseId) || 0) + 1));

  const latestSubmissionByCourse = new Map();
  data.submissions.forEach((sub) => {
    const key = sub.courseId || sub.linkedCourseId || sub.title || sub.id;
    const prev = latestSubmissionByCourse.get(key);
    const ts = Number(sub.updatedAt?.seconds || sub.createdAt?.seconds || 0);
    const prevTs = Number(prev?.updatedAt?.seconds || prev?.createdAt?.seconds || 0);
    if (!prev || ts >= prevTs) latestSubmissionByCourse.set(key, sub);
  });

  rows.innerHTML = data.courses.length ? data.courses.map((c) => {
    const s = enrollByCourse.get(c.id) || 0;
    const d = doneByCourse.get(c.id) || 0;
    const r = s ? Math.round((d / s) * 100) : 0;
    const submission = latestSubmissionByCourse.get(c.id);
    const note = submission?.note || submission?.reviewReason || c.lastReviewNote || "-";
    const needsAction = ["changes_requested", "rejected"].includes(String(c.status || ""));
    return `<tr><td>${c.title || "-"}</td><td>${badge(c.status)}</td><td>${s}</td><td>${r}%</td><td>${note}</td><td>${needsAction ? "<a class='ch-btn secondary' href='/instructor-builder.html'>تعديل وإعادة إرسال</a>" : "-"}</td></tr>`;
  }).join("") : "<tr><td colspan='6'>لا توجد دورات بعد.</td></tr>";
}

function fillStudents(data) {
  const rows = document.getElementById("studentsRows");
  if (!rows) return;
  const byCourse = new Map();
  data.courses.forEach((c) => byCourse.set(c.id, { title: c.title || "-", enrolled: 0, completed: 0 }));
  data.enrollments.forEach((e) => byCourse.get(e.courseId) && (byCourse.get(e.courseId).enrolled += 1));
  data.certs.forEach((c) => byCourse.get(c.courseId) && (byCourse.get(c.courseId).completed += 1));

  rows.innerHTML = [...byCourse.values()].length ? [...byCourse.values()].map((x) => `<tr><td>${x.title}</td><td>${x.enrolled}</td><td>${x.completed}</td><td>${x.enrolled ? Math.round((x.completed / x.enrolled) * 100) : 0}%</td></tr>`).join("") : "<tr><td colspan='4'>لا توجد بيانات.</td></tr>";
}

function fillTests(data) {
  const rows = document.getElementById("testsRows");
  if (!rows) return;
  const map = new Map();
  data.attempts.forEach((a) => {
    const courseId = a.courseId || "-";
    if (!map.has(courseId)) map.set(courseId, { attempts: 0, total: 0 });
    map.get(courseId).attempts += 1;
    map.get(courseId).total += Number(a.score || 0);
  });

  rows.innerHTML = map.size ? [...map.entries()].map(([courseId, x]) => {
    const title = data.courses.find((c) => c.id === courseId)?.title || courseId;
    return `<tr><td>${title}</td><td>${x.attempts}</td><td>${Math.round(x.total / x.attempts)}</td></tr>`;
  }).join("") : "<tr><td colspan='3'>لا توجد محاولات اختبارات بعد.</td></tr>";

  const totalAttempts = [...map.values()].reduce((a, b) => a + b.attempts, 0);
  const totalScore = [...map.values()].reduce((a, b) => a + b.total, 0);
  document.getElementById("reportTotalAttempts") && (document.getElementById("reportTotalAttempts").textContent = totalAttempts);
  document.getElementById("reportAvgScore") && (document.getElementById("reportAvgScore").textContent = totalAttempts ? Math.round(totalScore / totalAttempts) : 0);
  document.getElementById("reportTotalCourses") && (document.getElementById("reportTotalCourses").textContent = data.courses.length);
}

document.addEventListener("DOMContentLoaded", async () => {
  setActiveNav();
  const user = guardInstructor();
  if (!user) return;
  try {
    const data = await loadMetrics(user.uid);
    fillDashboard(data);
    fillCourses(data);
    fillStudents(data);
    fillTests(data);
  } catch (e) {
    console.warn("تعذر تحميل بيانات الأستاذ", e);
  }

  auth.onAuthStateChanged((u) => {
    if (!u) window.location.href = "/login.html";
  });
});
