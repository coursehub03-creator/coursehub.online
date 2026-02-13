import { db } from "/js/firebase-config.js";
import { protectAdmin } from "./admin-guard.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const DEFAULT_TEXT = "-";

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function badgeClass(status) {
  return status === "published" ? "success" : "neutral";
}

function addSecuritySignal(listEl, text) {
  if (!listEl) return;
  const li = document.createElement("li");
  li.textContent = text;
  listEl.appendChild(li);
}

document.addEventListener("DOMContentLoaded", async () => {
  await protectAdmin();

  const topCoursesBody = document.getElementById("analyticsTopCourses");
  const lowCompletionAlert = document.getElementById("analyticsLowCompletion");
  const pendingReviewAlert = document.getElementById("analyticsPendingReview");
  const securitySummaryAlert = document.getElementById("analyticsSecuritySignals");
  const securitySignalsList = document.getElementById("securitySignalsList");

  try {
    const [coursesSnap, enrollmentsSnap, certificatesSnap, reviewsSnap, usersSnap] = await Promise.all([
      getDocs(collection(db, "courses")),
      getDocs(collection(db, "enrollments")),
      getDocs(collection(db, "certificates")),
      getDocs(collection(db, "courseReviews")),
      getDocs(collection(db, "users"))
    ]);

    const courses = coursesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    const enrollments = enrollmentsSnap.docs.map((docSnap) => docSnap.data());
    const completions = certificatesSnap.docs.map((docSnap) => docSnap.data());
    const reviews = reviewsSnap.docs.map((docSnap) => docSnap.data());
    const users = usersSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

    const enrollmentKeys = new Set();
    const enrollmentCounts = new Map();
    enrollments.forEach((item) => {
      if (!item.courseId || !item.userId) return;
      const key = `${item.courseId}_${item.userId}`;
      if (enrollmentKeys.has(key)) return;
      enrollmentKeys.add(key);
      enrollmentCounts.set(item.courseId, (enrollmentCounts.get(item.courseId) || 0) + 1);
    });

    const completionKeys = new Set();
    const completionCounts = new Map();
    completions.forEach((item) => {
      if (!item.courseId || !item.userId) return;
      const key = `${item.courseId}_${item.userId}`;
      if (completionKeys.has(key)) return;
      completionKeys.add(key);
      completionCounts.set(item.courseId, (completionCounts.get(item.courseId) || 0) + 1);
    });

    const totalEnrollments = enrollmentKeys.size;
    const totalCompletions = completionKeys.size;
    const completionRate = totalEnrollments ? Math.round((totalCompletions / totalEnrollments) * 100) : 0;

    const avgRating = reviews.length
      ? (reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / reviews.length).toFixed(1)
      : "0.0";

    setText("analyticsEnrollments", totalEnrollments);
    setText("analyticsCompletionRate", `${completionRate}%`);
    setText("analyticsCourses", courses.filter((course) => course.status === "published").length);
    setText("analyticsRating", avgRating);

    if (topCoursesBody) {
      topCoursesBody.innerHTML = "";
      const enriched = courses.map((course) => {
        const started = enrollmentCounts.get(course.id) || 0;
        const completed = completionCounts.get(course.id) || 0;
        const rate = started ? Math.round((completed / started) * 100) : 0;
        return { ...course, started, rate };
      });

      const topCourses = enriched.sort((a, b) => b.rate - a.rate).slice(0, 5);

      if (!topCourses.length) {
        const tr = document.createElement("tr");
        tr.innerHTML = "<td colspan='5'>لا توجد بيانات بعد.</td>";
        topCoursesBody.appendChild(tr);
      } else {
        topCourses.forEach((course) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${course.title || DEFAULT_TEXT}</td>
            <td>${course.started || 0}</td>
            <td>${course.rate}%</td>
            <td>${course.rating || "—"}</td>
            <td><span class="badge ${badgeClass(course.status)}">${course.status || "draft"}</span></td>
          `;
          topCoursesBody.appendChild(tr);
        });
      }
    }

    const lowCount = courses.filter((course) => {
      const started = enrollmentCounts.get(course.id) || 0;
      const completed = completionCounts.get(course.id) || 0;
      const rate = started ? (completed / started) * 100 : 0;
      return started > 0 && rate < 40;
    }).length;

    const reviewCount = courses.filter((course) => course.status === "review").length;

    if (lowCompletionAlert) {
      lowCompletionAlert.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> توجد ${lowCount} دورة بنسب إكمال أقل من 40%.`;
    }

    if (pendingReviewAlert) {
      pendingReviewAlert.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${reviewCount} دورة بحاجة مراجعة قبل النشر.`;
    }

    // ---- Security monitoring signals ----
    const unverifiedUsers = users.filter((u) => u.email && u.emailVerified === false).length;
    const noAvatarUsers = users.filter((u) => !u.picture || !String(u.picture).trim()).length;
    const weakProfileUsers = users.filter((u) => !u.country || !u.gender || !u.birthDate).length;

    const securitySignalCount =
      (unverifiedUsers > 0 ? 1 : 0) +
      (noAvatarUsers > 0 ? 1 : 0) +
      (weakProfileUsers > 0 ? 1 : 0);

    if (securitySummaryAlert) {
      if (securitySignalCount === 0) {
        securitySummaryAlert.innerHTML = '<i class="fa-solid fa-shield-check"></i> لا توجد إشارات أمنية حرجة حاليًا.';
      } else {
        securitySummaryAlert.innerHTML = `<i class="fa-solid fa-shield-halved"></i> يوجد ${securitySignalCount} مؤشرات أمنية تتطلب تدخل.`;
      }
    }

    if (securitySignalsList) {
      securitySignalsList.innerHTML = "";

      if (unverifiedUsers > 0) {
        addSecuritySignal(securitySignalsList, `يوجد ${unverifiedUsers} حساب غير مفعل عبر البريد الإلكتروني.`);
      }
      if (noAvatarUsers > 0) {
        addSecuritySignal(securitySignalsList, `يوجد ${noAvatarUsers} حساب بدون صورة شخصية (تحقق من اكتمال ملف المستخدم).`);
      }
      if (weakProfileUsers > 0) {
        addSecuritySignal(securitySignalsList, `يوجد ${weakProfileUsers} حساب ببيانات ناقصة (جنس/بلد/ميلاد).`);
      }

      if (!securitySignalsList.children.length) {
        addSecuritySignal(securitySignalsList, "✅ كل مؤشرات الأمان الأساسية ضمن الحدود الطبيعية.");
      }
    }
  } catch (error) {
    console.error("فشل تحميل التحليلات:", error);
  }
});
