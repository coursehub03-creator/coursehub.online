import { db } from "/js/firebase-config.js";
import { protectAdmin } from "./admin-guard.js";
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

document.addEventListener("DOMContentLoaded", async () => {
  const adminUser = await protectAdmin();
  console.log("أدمن مسجل:", adminUser.email);

  const addBtn = document.getElementById("add-course-btn");
  const tbody = document.getElementById("courses-list");
  const statusFilter = document.getElementById("course-status-filter");
  const searchInput = document.getElementById("course-search");
  const categoryFilter = document.getElementById("course-category-filter");
  const submissionsTbody = document.getElementById("instructor-submissions-list");

  const functions = getFunctions(undefined, "us-central1");
  const reviewInstructorCourseSubmission = httpsCallable(functions, "reviewInstructorCourseSubmission");

  if (!addBtn || !tbody) {
    console.error("عناصر الصفحة غير موجودة");
    return;
  }

  addBtn.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "/admin/add-course.html";
  });

  let allCourses = [];
  let enrollmentsMap = new Map();
  let completionsMap = new Map();

  const statusBadge = (status) => {
    if (status === "published") return "<span class='badge success'>منشورة</span>";
    if (status === "review") return "<span class='badge warning'>قيد المراجعة</span>";
    if (status === "archived") return "<span class='badge neutral'>مؤرشفة</span>";
    return "<span class='badge neutral'>مسودة</span>";
  };

  const renderCourseActions = (id, status) => {
    const editAction = `<a class="btn outline small" href="/admin/edit-course.html?id=${id}">تعديل</a>`;
    const publishAction = `<button type="button" class="btn success small publish-btn" data-id="${id}">نشر</button>`;
    const reviewAction = `<button type="button" class="btn small review-btn" data-id="${id}">إرسال للمراجعة</button>`;
    const archiveAction = `<button type="button" class="btn outline small archive-btn" data-id="${id}">أرشفة</button>`;
    const deleteAction = `<button type="button" class="delete-btn" data-id="${id}">حذف</button>`;

    if (status === "published") {
      return `${editAction} ${archiveAction} ${deleteAction}`;
    }

    if (status === "archived") {
      return `${editAction} ${reviewAction} ${publishAction} ${deleteAction}`;
    }

    if (status === "review") {
      return `${editAction} ${publishAction} ${archiveAction} ${deleteAction}`;
    }

    // draft + unknown
    return `${editAction} ${reviewAction} ${publishAction} ${deleteAction}`;
  };

  const renderCourses = (courses) => {
    tbody.innerHTML = "";

    if (!courses.length) {
      tbody.innerHTML = "<tr><td colspan='7'>لا توجد دورات حالياً</td></tr>";
      return;
    }

    courses.forEach(({ id, data }) => {
      const startedCount = enrollmentsMap.get(id) || 0;
      const completedCount = completionsMap.get(id) || 0;
      const inProgressCount = Math.max(0, startedCount - completedCount);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${data.title || "-"}</td>
        <td>${data.description || "-"}</td>
        <td>${statusBadge(data.status)}</td>
        <td>${startedCount}</td>
        <td>${completedCount}</td>
        <td>${inProgressCount}</td>
        <td>${renderCourseActions(id, data.status)}</td>
      `;

      tbody.appendChild(tr);
    });
  };

  const applyFilters = () => {
    const statusValue = statusFilter?.value || "all";
    const categoryValue = categoryFilter?.value || "all";
    const query = searchInput?.value.toLowerCase().trim() || "";

    const filtered = allCourses.filter(({ data }) => {
      const statusMatch = statusValue === "all" || data.status === statusValue;
      const categoryMatch = categoryValue === "all" || data.category === categoryValue;
      const searchMatch = !query || (data.title || "").toLowerCase().includes(query);
      return statusMatch && categoryMatch && searchMatch;
    });

    renderCourses(filtered);
  };



  async function loadInstructorSubmissions() {
    if (!submissionsTbody) return;
    submissionsTbody.innerHTML = "<tr><td colspan='6'>جارٍ تحميل طلبات الأساتذة...</td></tr>";

    try {
      const snap = await getDocs(query(collection(db, "instructorCourseSubmissions"), orderBy("createdAt", "desc")));
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (!items.length) {
        submissionsTbody.innerHTML = "<tr><td colspan='6'>لا توجد طلبات من الأساتذة حاليًا.</td></tr>";
        return;
      }

      submissionsTbody.innerHTML = items
        .map((item) => {
          const lessons = (item.modules || []).reduce((acc, m) => acc + (m.lessons?.length || 0), 0);
          const questions = item.assessmentQuestions?.length || 0;
          const status = item.status || "pending";
          const statusText = status === "approved" ? "معتمد" : status === "rejected" ? "مرفوض" : "قيد المراجعة";
          return `
          <tr>
            <td>${item.title || "-"}</td>
            <td>${item.instructorEmail || "-"}</td>
            <td>${lessons} درس / ${questions} سؤال</td>
            <td>${statusText}</td>
            <td><input type="text" class="submission-reason" data-id="${item.id}" placeholder="سبب الرفض (اختياري)" /></td>
            <td>
              <button type="button" class="btn success small submission-approve" data-id="${item.id}">اعتماد</button>
              <button type="button" class="btn outline small submission-reject" data-id="${item.id}">رفض</button>
            </td>
          </tr>
          `;
        })
        .join("");
    } catch (error) {
      console.error("فشل تحميل طلبات دورات الأساتذة:", error);
      submissionsTbody.innerHTML = "<tr><td colspan='6'>تعذر تحميل الطلبات.</td></tr>";
    }
  }

  submissionsTbody?.addEventListener("click", async (event) => {
    const approveBtn = event.target.closest(".submission-approve");
    const rejectBtn = event.target.closest(".submission-reject");
    if (!approveBtn && !rejectBtn) return;

    const id = (approveBtn || rejectBtn)?.dataset.id;
    if (!id) return;

    const reasonInput = submissionsTbody.querySelector(`.submission-reason[data-id="${id}"]`);
    const reason = reasonInput?.value?.trim() || "";

    try {
      if (approveBtn) {
        await reviewInstructorCourseSubmission({ submissionId: id, decision: "approve" });
      } else {
        if (!reason) {
          alert("أدخل سبب الرفض قبل المتابعة.");
          return;
        }
        await reviewInstructorCourseSubmission({ submissionId: id, decision: "reject", reason });
      }

      await loadInstructorSubmissions();
      await loadCourses();
    } catch (error) {
      console.error("تعذر مراجعة الطلب:", error);
      alert("حدث خطأ أثناء مراجعة طلب الأستاذ.");
    }
  });
  async function setCourseStatus(courseId, status) {
    const payload = {
      status,
      updatedAt: serverTimestamp()
    };

    if (status === "published") payload.publishedAt = serverTimestamp();
    if (status === "archived") payload.archivedAt = serverTimestamp();

    await updateDoc(doc(db, "courses", courseId), payload);
  }

  async function loadCourses() {
    tbody.innerHTML = "<tr><td colspan='7'>جارٍ تحميل الدورات...</td></tr>";

    try {
      const enrollmentsSnap = await getDocs(collection(db, "enrollments"));
      const enrollmentKeys = new Set();
      enrollmentsMap = new Map();
      enrollmentsSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data.courseId || !data.userId) return;
        const key = `${data.courseId}_${data.userId}`;
        if (enrollmentKeys.has(key)) return;
        enrollmentKeys.add(key);
        enrollmentsMap.set(data.courseId, (enrollmentsMap.get(data.courseId) || 0) + 1);
      });

      const completionsSnap = await getDocs(collection(db, "certificates"));
      const completionKeys = new Set();
      completionsMap = new Map();
      completionsSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data.courseId || !data.userId) return;
        const key = `${data.courseId}_${data.userId}`;
        if (completionKeys.has(key)) return;
        completionKeys.add(key);
        completionsMap.set(data.courseId, (completionsMap.get(data.courseId) || 0) + 1);
      });

      const snapshot = await getDocs(collection(db, "courses"));
      allCourses = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        data: docSnap.data()
      }));

      applyFilters();
    } catch (err) {
      console.error("خطأ في تحميل الدورات:", err);
      tbody.innerHTML = "<tr><td colspan='7'>حدث خطأ أثناء التحميل</td></tr>";
    }
  }

  tbody.addEventListener("click", async (e) => {
    const actionBtn = e.target.closest("button");
    if (!actionBtn) return;

    const courseId = actionBtn.dataset.id;
    if (!courseId) return;

    try {
      if (actionBtn.classList.contains("delete-btn")) {
        if (!confirm("هل أنت متأكد من حذف الدورة؟")) return;
        await deleteDoc(doc(db, "courses", courseId));
      } else if (actionBtn.classList.contains("archive-btn")) {
        await setCourseStatus(courseId, "archived");
      } else if (actionBtn.classList.contains("publish-btn")) {
        await setCourseStatus(courseId, "published");
      } else if (actionBtn.classList.contains("review-btn")) {
        await setCourseStatus(courseId, "review");
      } else {
        return;
      }

      await loadCourses();
    } catch (err) {
      console.error("فشل تنفيذ الإجراء على الدورة:", err);
      alert("حدث خطأ أثناء تنفيذ الإجراء");
    }
  });

  await loadCourses();
  await loadInstructorSubmissions();

  statusFilter?.addEventListener("change", applyFilters);
  categoryFilter?.addEventListener("change", applyFilters);
  searchInput?.addEventListener("input", applyFilters);
});
