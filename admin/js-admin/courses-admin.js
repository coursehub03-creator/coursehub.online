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

document.addEventListener("DOMContentLoaded", async () => {
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

  const callableAllowedHosts = new Set(["localhost", "127.0.0.1", "coursehub-23ed2.web.app", "coursehub-23ed2.firebaseapp.com"]);
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
    if (course.instructorId && userNameMap.has(course.instructorId)) return userNameMap.get(course.instructorId);
    return course.instructorName || course.instructorEmail || "غير محدد";
  };

  const getCourseInstructorKey = (course) => course.instructorId || course.instructorEmail || "unknown";

  const renderCourseActions = (id, status) => {
    const editAction = `<a class="btn outline small" href="/admin/edit-course.html?id=${id}">تعديل</a>`;
    const publishAction = `<button type="button" class="btn success small publish-btn" data-id="${id}">نشر</button>`;
    const reviewAction = `<button type="button" class="btn small review-btn" data-id="${id}">إرسال للمراجعة</button>`;
    const archiveAction = `<button type="button" class="btn outline small archive-btn" data-id="${id}">أرشفة</button>`;
    const deleteAction = `<button type="button" class="delete-btn" data-id="${id}">حذف</button>`;

    if (status === "published") return `${editAction} ${archiveAction} ${deleteAction}`;
    if (status === "archived") return `${editAction} ${reviewAction} ${publishAction} ${deleteAction}`;
    if (status === "review") return `${editAction} ${publishAction} ${archiveAction} ${deleteAction}`;
    return `${editAction} ${reviewAction} ${publishAction} ${deleteAction}`;
  };

  const renderCourses = (courses) => {
    tbody.innerHTML = "";
    if (!courses.length) {
      tbody.innerHTML = "<tr><td colspan='8'>لا توجد دورات مطابقة للفلاتر.</td></tr>";
      return;
    }

    courses.forEach(({ id, data }) => {
      const startedCount = enrollmentsMap.get(id) || 0;
      const completedCount = completionsMap.get(id) || 0;
      const inProgressCount = Math.max(0, startedCount - completedCount);
      const instructorName = getInstructorName(data);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${data.title || "-"}</td>
        <td>${instructorName}</td>
        <td>${data.category || "-"}</td>
        <td>${statusBadge(data.status)}</td>
        <td>${startedCount}</td>
        <td>${completedCount}</td>
        <td>${inProgressCount}</td>
        <td>${renderCourseActions(id, data.status)}</td>
      `;
      tbody.appendChild(tr);
    });
  };

  const renderInstructors = () => {
    const qText = instructorSearch?.value?.toLowerCase().trim() || "";
    const instructors = allUsers
      .filter((u) => (u.role === "instructor" || (u.role || "") === "teacher"))
      .map((u) => {
        const key = u.uid || u.id;
        const courses = allCourses.filter(({ data }) => getCourseInstructorKey(data) === key || (u.email && data.instructorEmail === u.email));
        const published = courses.filter((c) => c.data.status === "published").length;
        const unpublished = courses.length - published;
        return {
          key,
          name: u.name || u.displayName || u.fullName || u.email || "أستاذ",
          email: u.email || "",
          total: courses.length,
          published,
          unpublished
        };
      })
      .filter((item) => !qText || item.name.toLowerCase().includes(qText) || item.email.toLowerCase().includes(qText))
      .sort((a, b) => b.total - a.total);

    instructorsCount.textContent = String(instructors.length);

    const allItem = `
      <button type="button" class="instructor-item ${selectedInstructorId === "all" ? "active" : ""}" data-id="all">
        <div>
          <strong>كل الأساتذة</strong>
          <small>عرض جميع الدورات</small>
        </div>
      </button>
    `;

    if (!instructors.length) {
      instructorsList.innerHTML = `${allItem}<p class="helper-text" style="padding:10px;">لا يوجد أساتذة مطابقون.</p>`;
    } else {
      instructorsList.innerHTML = allItem + instructors.map((ins) => `
        <button type="button" class="instructor-item ${selectedInstructorId === ins.key ? "active" : ""}" data-id="${ins.key}">
          <div>
            <strong>${ins.name}</strong>
            <small>${ins.email || "بدون بريد"}</small>
          </div>
          <div class="instructor-stats-mini">
            <span class="badge success">${ins.published} منشورة</span>
            <span class="badge neutral">${ins.unpublished} غير منشورة</span>
          </div>
        </button>
      `).join("");
    }

    instructorsList.querySelectorAll(".instructor-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedInstructorId = btn.dataset.id || "all";
        renderInstructors();
        applyFilters();
      });
    });
  };

  const applyFilters = () => {
    const statusValue = statusFilter?.value || "all";
    const categoryValue = categoryFilter?.value || "all";
    const qText = searchInput?.value.toLowerCase().trim() || "";

    const filtered = allCourses.filter(({ data }) => {
      const statusMatch = statusValue === "all" || data.status === statusValue;
      const categoryMatch = categoryValue === "all" || (data.category || "") === categoryValue;
      const searchMatch = !qText || (data.title || "").toLowerCase().includes(qText) || (data.description || "").toLowerCase().includes(qText);

      const instructorMatch =
        selectedInstructorId === "all" ||
        getCourseInstructorKey(data) === selectedInstructorId ||
        (userEmailMap.get(selectedInstructorId) && data.instructorEmail === userEmailMap.get(selectedInstructorId));

      return statusMatch && categoryMatch && searchMatch && instructorMatch;
    });

    renderCourses(filtered);
  };

  function buildSubmissionPreview(item) {
    const modules = Array.isArray(item.modules) ? item.modules : [];
    const moduleLines = modules.map((m, idx) => {
      const lessons = Array.isArray(m.lessons) ? m.lessons : [];
      const lessonTitles = lessons.map((l) => `- ${l.title || "بدون عنوان"}`).join("\n");
      return `الوحدة ${idx + 1}: ${m.title || "بدون عنوان"}\n${lessonTitles}`;
    }).join("\n\n");

    return [
      `العنوان: ${item.title || "-"}`,
      `الأستاذ: ${item.instructorEmail || "-"}`,
      `التصنيف: ${item.category || "-"}`,
      `المستوى: ${item.level || "-"}`,
      `اللغة: ${item.language || "-"}`,
      `السعر: ${item.price ?? 0}$`,
      `الوصف: ${item.description || "-"}`,
      `عدد الوحدات: ${modules.length}`,
      `عدد أسئلة الاختبار: ${item.assessmentQuestions?.length || 0}`,
      item.image ? `صورة الغلاف: ${item.image}` : "",
      item.outlineUrl ? `ملف المنهج: ${item.outlineUrl}` : "",
      "",
      "المنهج:",
      moduleLines || "لا توجد وحدات"
    ].filter(Boolean).join("\n");
  }

  async function fallbackReviewSubmission(item, decision, reason = "") {
    if (decision === "approve") {
      const modules = Array.isArray(item.modules) ? item.modules : [];
      const lessonsFlat = modules.flatMap((m) =>
        (m.lessons || []).map((lesson) => ({
          title: lesson.title || "",
          duration: lesson.duration || "",
          summary: "",
          slides: [],
          quiz: { questions: (item.assessmentQuestions || []).slice(0, 50) },
          passScore: 80
        }))
      );

      const coursePayload = {
        title: item.title || "",
        titleEn: item.titleEn || "",
        description: item.description || "",
        category: item.category || "",
        level: item.level || "",
        language: item.language || "",
        duration: Number(item.durationHours || 0),
        price: Number(item.price || 0),
        image: item.image || "",
        outlineUrl: item.outlineUrl || "",
        lessons: lessonsFlat,
        modules,
        status: "draft",
        source: "instructor-submission",
        instructorId: item.instructorId || "",
        instructorEmail: item.instructorEmail || "",
        instructorName: item.instructorName || "",
        submissionId: item.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const courseRef = await addDoc(collection(db, "courses"), coursePayload);

      await updateDoc(doc(db, "instructorCourseSubmissions", item.id), {
        status: "approved",
        reviewReason: "",
        linkedCourseId: courseRef.id,
        updatedAt: serverTimestamp()
      });
      return;
    }

    await updateDoc(doc(db, "instructorCourseSubmissions", item.id), {
      status: "rejected",
      reviewReason: reason,
      updatedAt: serverTimestamp()
    });
  }

  function renderSubmissions() {
    if (!submissionsTbody) return;
    const statusValue = submissionStatusFilter?.value || "all";
    const qText = submissionSearch?.value?.toLowerCase().trim() || "";

    const items = [...submissionsMap.values()].filter((item) => {
      const status = item.status || "pending";
      const statusMatch = statusValue === "all" || status === statusValue;
      const searchMatch = !qText || (item.title || "").toLowerCase().includes(qText) || (item.instructorEmail || "").toLowerCase().includes(qText);
      return statusMatch && searchMatch;
    });

    if (!items.length) {
      submissionsTbody.innerHTML = "<tr><td colspan='6'>لا توجد طلبات مطابقة للفلاتر.</td></tr>";
      return;
    }

    submissionsTbody.innerHTML = items.map((item) => {
      const lessons = (item.modules || []).reduce((acc, m) => acc + (m.lessons?.length || 0), 0);
      const questions = item.assessmentQuestions?.length || 0;
      const editDraftAction = item.linkedCourseId
        ? `<a class="btn outline small" href="/admin/edit-course.html?id=${item.linkedCourseId}">تعديل المسودة</a>`
        : "";

      return `
        <tr>
          <td>${item.title || "-"}</td>
          <td>${item.instructorEmail || "-"}</td>
          <td>${lessons} درس / ${questions} سؤال</td>
          <td>${submissionStatusBadge(item.status || "pending")}</td>
          <td><input type="text" class="submission-reason" data-id="${item.id}" value="${item.reviewReason || ""}" placeholder="سبب الرفض (إلزامي عند الرفض)" /></td>
          <td>
            <button type="button" class="btn small submission-preview" data-id="${item.id}">معاينة</button>
            <button type="button" class="btn success small submission-approve" data-id="${item.id}">اعتماد كمسودة</button>
            <button type="button" class="btn outline small submission-reject" data-id="${item.id}">رفض</button>
            ${editDraftAction}
          </td>
        </tr>
      `;
    }).join("");
  }

  async function loadInstructorSubmissions() {
    if (!submissionsTbody) return;
    submissionsTbody.innerHTML = "<tr><td colspan='6'>جارٍ تحميل طلبات الأساتذة...</td></tr>";

    try {
      const snap = await getDocs(query(collection(db, "instructorCourseSubmissions"), orderBy("createdAt", "desc")));
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      submissionsMap = new Map(items.map((item) => [item.id, item]));
      renderSubmissions();
    } catch (error) {
      console.error("فشل تحميل طلبات دورات الأساتذة:", error);
      submissionsTbody.innerHTML = "<tr><td colspan='6'>تعذر تحميل الطلبات.</td></tr>";
    }
  }

  submissionsTbody?.addEventListener("click", async (event) => {
    const previewBtn = event.target.closest(".submission-preview");
    const approveBtn = event.target.closest(".submission-approve");
    const rejectBtn = event.target.closest(".submission-reject");
    if (!previewBtn && !approveBtn && !rejectBtn) return;

    const id = (previewBtn || approveBtn || rejectBtn)?.dataset.id;
    if (!id) return;
    const item = submissionsMap.get(id);
    if (!item) return;

    if (previewBtn) {
      alert(buildSubmissionPreview(item));
      return;
    }

    const reasonInput = submissionsTbody.querySelector(`.submission-reason[data-id="${id}"]`);
    const reason = reasonInput?.value?.trim() || "";

    try {
      if (approveBtn) {
        if (shouldUseCallable) {
          await reviewInstructorCourseSubmission({ submissionId: id, decision: "approve" });
        } else {
          await fallbackReviewSubmission(item, "approve");
        }
      } else {
        if (!reason) {
          alert("أدخل سبب الرفض قبل المتابعة.");
          return;
        }
        if (shouldUseCallable) {
          await reviewInstructorCourseSubmission({ submissionId: id, decision: "reject", reason });
        } else {
          await fallbackReviewSubmission(item, "reject", reason);
        }
      }

      await loadInstructorSubmissions();
      await loadCourses();
    } catch (error) {
      console.warn("reviewInstructorCourseSubmission failed, trying fallback:", error);
      try {
        await fallbackReviewSubmission(item, approveBtn ? "approve" : "reject", reason);
        await loadInstructorSubmissions();
        await loadCourses();
      } catch (fallbackError) {
        console.error("تعذر مراجعة الطلب:", fallbackError);
        alert("حدث خطأ أثناء مراجعة طلب الأستاذ.");
      }
    }
  });

  async function setCourseStatus(courseId, status) {
    const payload = { status, updatedAt: serverTimestamp() };
    if (status === "published") payload.publishedAt = serverTimestamp();
    if (status === "archived") payload.archivedAt = serverTimestamp();
    await updateDoc(doc(db, "courses", courseId), payload);
  }

  async function loadCategories() {
    const snap = await getDocs(collection(db, "courseCategories"));
    allCategories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const current = categoryFilter.value;
    const options = ["<option value='all'>كل التصنيفات</option>"];
    allCategories
      .map((c) => c.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "ar"))
      .forEach((name) => options.push(`<option value="${name}">${name}</option>`));
    categoryFilter.innerHTML = options.join("");
    if (["all", ...allCategories.map((c) => c.name)].includes(current)) categoryFilter.value = current;
  }

  async function loadUsers() {
    const snap = await getDocs(collection(db, "users"));
    allUsers = snap.docs.map((d) => ({ id: d.id, ...d.data(), uid: d.data().uid || d.id }));
    userNameMap.clear();
    userEmailMap.clear();
    allUsers.forEach((u) => {
      const key = u.uid || u.id;
      userNameMap.set(key, u.name || u.displayName || u.fullName || u.email || "أستاذ");
      userEmailMap.set(key, u.email || "");
    });
  }

  async function loadCourses() {
    tbody.innerHTML = "<tr><td colspan='8'>جارٍ تحميل الدورات...</td></tr>";

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
      allCourses = snapshot.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() }));

      renderInstructors();
      applyFilters();
    } catch (err) {
      console.error("خطأ في تحميل الدورات:", err);
      tbody.innerHTML = "<tr><td colspan='8'>حدث خطأ أثناء التحميل</td></tr>";
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

  statusFilter?.addEventListener("change", applyFilters);
  categoryFilter?.addEventListener("change", applyFilters);
  searchInput?.addEventListener("input", applyFilters);
  instructorSearch?.addEventListener("input", renderInstructors);
  submissionStatusFilter?.addEventListener("change", renderSubmissions);
  submissionSearch?.addEventListener("input", renderSubmissions);

  await loadUsers();
  await loadCategories();
  await loadCourses();
  await loadInstructorSubmissions();
});
