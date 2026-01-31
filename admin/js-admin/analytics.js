import { db } from "/js/firebase-config.js";
import { protectAdmin } from "./admin-guard.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", async () => {
  await protectAdmin();

  const enrollmentsEl = document.getElementById("analyticsEnrollments");
  const completionEl = document.getElementById("analyticsCompletionRate");
  const coursesEl = document.getElementById("analyticsCourses");
  const ratingEl = document.getElementById("analyticsRating");
  const topCoursesBody = document.getElementById("analyticsTopCourses");
  const lowCompletionAlert = document.getElementById("analyticsLowCompletion");
  const pendingReviewAlert = document.getElementById("analyticsPendingReview");

  try {
    const [coursesSnap, enrollmentsSnap, certificatesSnap, reviewsSnap] = await Promise.all([
      getDocs(collection(db, "courses")),
      getDocs(collection(db, "enrollments")),
      getDocs(collection(db, "certificates")),
      getDocs(collection(db, "courseReviews"))
    ]);

    const courses = coursesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    const enrollments = enrollmentsSnap.docs.map((docSnap) => docSnap.data());
    const completions = certificatesSnap.docs.map((docSnap) => docSnap.data());
    const reviews = reviewsSnap.docs.map((docSnap) => docSnap.data());

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
    const completionRate = totalEnrollments
      ? Math.round((totalCompletions / totalEnrollments) * 100)
      : 0;

    const avgRating = reviews.length
      ? (reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / reviews.length).toFixed(1)
      : "0.0";

    if (enrollmentsEl) enrollmentsEl.textContent = totalEnrollments;
    if (completionEl) completionEl.textContent = `${completionRate}%`;
    if (coursesEl) coursesEl.textContent = courses.filter((course) => course.status === "published").length;
    if (ratingEl) ratingEl.textContent = avgRating;

    if (topCoursesBody) {
      const enriched = courses.map((course) => {
        const started = enrollmentCounts.get(course.id) || 0;
        const completed = completionCounts.get(course.id) || 0;
        const rate = started ? Math.round((completed / started) * 100) : 0;
        return { ...course, started, rate };
      });

      const topCourses = enriched
        .sort((a, b) => b.rate - a.rate)
        .slice(0, 5);

      if (!topCourses.length) {
        topCoursesBody.innerHTML = "<tr><td colspan='5'>لا توجد بيانات بعد.</td></tr>";
      } else {
        topCoursesBody.innerHTML = topCourses.map((course) => `
          <tr>
            <td>${course.title || "-"}</td>
            <td>${course.started || 0}</td>
            <td>${course.rate}%</td>
            <td>${course.rating || "—"}</td>
            <td><span class="badge ${course.status === "published" ? "success" : "neutral"}">${course.status || "draft"}</span></td>
          </tr>
        `).join("");
      }
    }

    if (lowCompletionAlert) {
      const lowCount = courses.filter((course) => {
        const started = enrollmentCounts.get(course.id) || 0;
        const completed = completionCounts.get(course.id) || 0;
        const rate = started ? (completed / started) * 100 : 0;
        return started > 0 && rate < 40;
      }).length;
      lowCompletionAlert.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> توجد ${lowCount} دورة بنسب إكمال أقل من 40%.`;
    }

    if (pendingReviewAlert) {
      const reviewCount = courses.filter((course) => course.status === "review").length;
      pendingReviewAlert.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${reviewCount} دورة بحاجة مراجعة قبل النشر.`;
    }
  } catch (error) {
    console.error("فشل تحميل التحليلات:", error);
  }
});
