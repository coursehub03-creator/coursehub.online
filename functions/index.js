const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

const ADMIN_EMAILS = new Set([
  "kaleadsalous30@gmail.com",
  "coursehub03@gmail.com"
]);

function isAdminContext(auth) {
  if (!auth) return false;
  return auth.token?.admin === true || ADMIN_EMAILS.has(auth.token?.email || "");
}

async function queueEmail(payload) {
  await db.collection("emailQueue").add({
    ...payload,
    status: "pending",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

async function assertAdmin(request) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "You must be authenticated.");
  }

  // 1) Admin claim أو ضمن قائمة الإيميلات
  if (isAdminContext(request.auth)) return;

  // 2) fallback: role داخل users/{uid}
  const userDoc = await db.collection("users").doc(request.auth.uid).get();
  const role = String(userDoc.data()?.role || "").toLowerCase();
  if (role === "admin") return;

  throw new HttpsError("permission-denied", "Only admins can delete users.");
}

// حذف Query على دفعات (لتفادي limits)
async function deleteQueryInChunks(queryRef, chunkSize = 300) {
  let deleted = 0;

  while (true) {
    const snap = await queryRef.limit(chunkSize).get();
    if (snap.empty) return deleted;

    const batch = db.batch();
    snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    deleted += snap.size;

    if (snap.size < chunkSize) return deleted;
  }
}

async function deleteDocsByField(collectionName, fieldName, value) {
  if (!value) return 0;
  return deleteQueryInChunks(db.collection(collectionName).where(fieldName, "==", value));
}

async function deleteDocIfExists(collectionName, docId) {
  if (!docId) return 0;
  const ref = db.collection(collectionName).doc(docId);
  const snap = await ref.get();
  if (!snap.exists) return 0;
  await ref.delete();
  return 1;
}

/**
 * تنظيف شامل:
 * - يدور على عدة حقول (uid/userId/email/userEmail) لتفادي اختلافات البيانات
 * - إضافات: studentProgress + حذف docId مباشر من user_courses
 * - يحذف users/{uid} وما تحته باستخدام recursiveDelete
 * - لو كان الإيميل موجودًا: يمسح أي users docs أخرى بنفس الإيميل (إن وجدت)
 *
 * يرجع:
 *  - deletedDocsCount (إجمالي)
 *  - byCollection (تفصيل لكل collection.field)
 */
async function cleanupUserData(uid, email) {
  let deleted = 0;
  const byCollection = {};

  const addCount = (key, count) => {
    const n = Number(count || 0);
    if (!n) return;
    byCollection[key] = (byCollection[key] || 0) + n;
    deleted += n;
  };

  const collectionFieldPairs = [
    ["instructorApplications", ["uid", "userId", "email", "userEmail"]],
    ["certificates", ["uid", "userId", "email", "userEmail"]],
    ["enrollments", ["uid", "userId", "email", "userEmail"]],
    ["notifications", ["uid", "userId", "email", "userEmail"]],
    ["quizAttempts", ["uid", "userId", "email", "userEmail"]],
    ["user_courses", ["uid", "userId", "email", "userEmail"]],
    ["achievements", ["uid", "userId", "email", "userEmail"]]
  ];

  for (const [collectionName, fields] of collectionFieldPairs) {
    for (const field of fields) {
      const value = field.toLowerCase().includes("email") ? (email || "") : (uid || "");
      const count = await deleteDocsByField(collectionName, field, value);
      addCount(`${collectionName}.${field}`, count);
    }
  }

  // إضافات تنظيف مفيدة
  addCount("user_courses.docId", await deleteDocIfExists("user_courses", uid));
  addCount("studentProgress.userId", await deleteDocsByField("studentProgress", "userId", uid));

  // حذف users/{uid} وكل subcollections تحته
  if (uid) {
    const userDocRef = db.collection("users").doc(uid);
    const userDocSnap = await userDocRef.get();
    if (userDocSnap.exists) {
      await db.recursiveDelete(userDocRef).catch(() => {});
      addCount("users.doc", 1);
    }
  }

  // أحيانًا يوجد user doc آخر بنفس الإيميل (data duplication)
  if (email) {
    const byEmailSnap = await db.collection("users").where("email", "==", email).get();
    for (const docSnap of byEmailSnap.docs) {
      if (uid && docSnap.id === uid) continue;
      await db.recursiveDelete(docSnap.ref).catch(() => {});
      addCount("users.byEmail", 1);
    }
  }

  return { deletedDocsCount: deleted, byCollection };
}

async function hardDeleteUserEverywhere(uid, email) {
  let resolvedUid = uid || null;

  // resolve uid from email if needed
  if (!resolvedUid && email) {
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      resolvedUid = userRecord.uid;
    } catch (error) {
      if (error?.code !== "auth/user-not-found") throw error;
    }
  }

  if (!resolvedUid) {
    throw new Error("No uid/email provided or user not found in Auth.");
  }

  // 1) تنظيف Firestore أولًا
  const cleanupResult = await cleanupUserData(resolvedUid, email || null);

  // 2) حذف Auth بشكل non-fatal — لا نفشل العملية لو تعذر Auth (لكن نُرجع الحالة)
  let authDeleted = false;
  let authDeletionError = null;

  try {
    await admin.auth().deleteUser(resolvedUid);
    authDeleted = true;
  } catch (authError) {
    if (authError?.code === "auth/user-not-found") {
      authDeleted = true; // idempotent
    } else {
      authDeleted = false;
      authDeletionError = String(authError?.message || authError);
    }
  }

  return {
    uid: resolvedUid,
    deletedDocsCount: cleanupResult.deletedDocsCount,
    cleanupBreakdown: cleanupResult.byCollection,
    authDeleted,
    authDeletionError
  };
}

// Callable: حذف فوري من لوحة الأدمن
exports.hardDeleteUser = onCall({ region: "us-central1" }, async (request) => {
  await assertAdmin(request);

  const uid = typeof request.data?.uid === "string" ? request.data.uid.trim() : "";
  const email = typeof request.data?.email === "string" ? request.data.email.trim() : "";

  if (!uid && !email) {
    throw new HttpsError("invalid-argument", "uid or email is required.");
  }

  try {
    const result = await hardDeleteUserEverywhere(uid || null, email || null);
    return {
      ok: true,
      deletedUid: result.uid,
      deletedDocsCount: result.deletedDocsCount,
      cleanupBreakdown: result.cleanupBreakdown,
      authDeleted: result.authDeleted,
      authDeletionError: result.authDeletionError
    };
  } catch (error) {
    throw new HttpsError("internal", String(error?.message || error));
  }
});

// Callable: اعتماد/رفض طلب الأستاذ (أفضل من التحديث من الواجهة لتجنب مشاكل الصلاحيات)
exports.approveInstructorApplication = onCall({ region: "us-central1" }, async (request) => {
  await assertAdmin(request);

  const applicationId =
    typeof request.data?.applicationId === "string" ? request.data.applicationId.trim() : "";
  const decision =
    typeof request.data?.decision === "string" ? request.data.decision.trim().toLowerCase() : "";
  const reason = typeof request.data?.reason === "string" ? request.data.reason.trim() : "";

  if (!applicationId) throw new HttpsError("invalid-argument", "applicationId is required.");
  if (!["approve", "reject"].includes(decision)) {
    throw new HttpsError("invalid-argument", "decision must be approve or reject.");
  }
  if (decision === "reject" && !reason) {
    throw new HttpsError("invalid-argument", "reason is required for rejection.");
  }

  const appRef = db.collection("instructorApplications").doc(applicationId);
  const appSnap = await appRef.get();
  if (!appSnap.exists) throw new HttpsError("not-found", "Application not found.");

  const app = appSnap.data() || {};
  const email = String(app.email || "").trim();
  const uid = String(app.uid || "").trim();

  if (!email || !uid) throw new HttpsError("failed-precondition", "Application is missing email/uid.");

  if (decision === "approve") {
    const verifyLink = await admin.auth().generateEmailVerificationLink(email);

    await appRef.update({
      applicationStatus: "approved",
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewedBy: request.auth.uid,
      reviewReason: ""
    });

    await db
      .collection("users")
      .doc(uid)
      .set(
        {
          role: "instructor",
          status: "pending_verification",
          reviewReason: "",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );

    await queueEmail({
      to: email,
      template: "instructor-approved",
      subject: "تمت الموافقة على طلبك كأستاذ - CourseHub",
      message:
        "تمت الموافقة على طلبك. لإكمال التفعيل اضغط رابط التفعيل التالي ثم سجّل الدخول:\n" + verifyLink
    });

    return { ok: true, decision: "approved", verifyLinkGenerated: true };
  }

  await appRef.update({
    applicationStatus: "rejected",
    reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
    reviewedBy: request.auth.uid,
    reviewReason: reason
  });

  await db
    .collection("users")
    .doc(uid)
    .set(
      {
        role: "instructor",
        status: "rejected",
        reviewReason: reason,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

  await queueEmail({
    to: email,
    template: "instructor-rejected",
    subject: "نتيجة مراجعة طلب الأستاذ - CourseHub",
    message: `تم رفض طلبك للأسباب التالية: ${reason}`
  });

  return { ok: true, decision: "rejected" };
});



// Callable: إرسال دورة من الأستاذ للمراجعة (يتجاوز مشاكل صلاحيات Firestore من الواجهة)
exports.submitInstructorCourse = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const uid = request.auth.uid;
  const email = request.auth.token?.email || "";
  const payload = request.data || {};

  const userSnap = await db.collection("users").doc(uid).get();
  const userMeta = userSnap.data() || {};
  if (String(userMeta.role || "") !== "instructor" || String(userMeta.status || "") !== "active") {
    throw new HttpsError("permission-denied", "Only active instructors can submit courses.");
  }

  const title = String(payload.title || "").trim();
  const description = String(payload.description || "").trim();
  const category = String(payload.category || "").trim();
  const modules = Array.isArray(payload.modules) ? payload.modules : [];
  const assessmentQuestions = Array.isArray(payload.assessmentQuestions) ? payload.assessmentQuestions : [];

  if (!title || !description || !category) {
    throw new HttpsError("invalid-argument", "title, description and category are required.");
  }

  if (!modules.length) {
    throw new HttpsError("invalid-argument", "At least one module is required.");
  }

  if (assessmentQuestions.length < 2) {
    throw new HttpsError("invalid-argument", "At least 2 assessment questions are required.");
  }

  const submission = {
    instructorId: uid,
    instructorEmail: email,
    title,
    titleEn: String(payload.titleEn || "").trim(),
    description,
    category,
    price: Number(payload.price || 0),
    level: String(payload.level || "").trim(),
    language: String(payload.language || "").trim(),
    durationHours: Number(payload.durationHours || 0),
    difficulty: String(payload.difficulty || "").trim(),
    objectives: Array.isArray(payload.objectives) ? payload.objectives : [],
    requirements: Array.isArray(payload.requirements) ? payload.requirements : [],
    outcomes: Array.isArray(payload.outcomes) ? payload.outcomes : [],
    modules,
    assessmentQuestions,
    image: String(payload.image || ""),
    outlineUrl: String(payload.outlineUrl || ""),
    status: "pending",
    reviewReason: "",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const ref = await db.collection("instructorCourseSubmissions").add(submission);

  for (const adminEmail of ADMIN_EMAILS) {
    await queueEmail({
      to: adminEmail,
      template: "instructor-course-submitted",
      subject: "طلب دورة جديد من أستاذ - CourseHub",
      message: `تم إرسال دورة جديدة للمراجعة بعنوان: ${title}
Submission ID: ${ref.id}`
    }).catch(() => {});
  }

  return { ok: true, submissionId: ref.id };
});

// Callable: اعتماد/رفض دورة الأستاذ من المشرف
exports.reviewInstructorCourseSubmission = onCall({ region: "us-central1" }, async (request) => {
  await assertAdmin(request);

  const submissionId = String(request.data?.submissionId || "").trim();
  const decision = String(request.data?.decision || "").trim().toLowerCase();
  const reason = String(request.data?.reason || "").trim();

  if (!submissionId) throw new HttpsError("invalid-argument", "submissionId is required.");
  if (!["approve", "reject"].includes(decision)) {
    throw new HttpsError("invalid-argument", "decision must be approve/reject.");
  }
  if (decision === "reject" && !reason) {
    throw new HttpsError("invalid-argument", "reason is required when rejecting.");
  }

  const subRef = db.collection("instructorCourseSubmissions").doc(submissionId);
  const subSnap = await subRef.get();
  if (!subSnap.exists) throw new HttpsError("not-found", "Submission not found.");

  const sub = subSnap.data() || {};
  const instructorEmail = String(sub.instructorEmail || "");

  if (decision === "approve") {
    const coursePayload = {
      title: sub.title || "",
      titleEn: sub.titleEn || "",
      description: sub.description || "",
      category: sub.category || "",
      level: sub.level || "",
      language: sub.language || "",
      duration: sub.durationHours || 0,
      modules: sub.modules?.length || 0,
      image: sub.image || "",
      lessons: (sub.modules || []).flatMap((m) => (m.lessons || []).map((lesson) => ({
        title: lesson.title || "",
        duration: lesson.duration || "",
        summary: "",
        slides: [],
        quiz: {
          questions: (sub.assessmentQuestions || []).slice(0, 10)
        },
        passScore: 80
      }))),
      status: "review",
      source: "instructor-submission",
      instructorId: sub.instructorId || "",
      instructorEmail,
      submissionId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const courseRef = await db.collection("courses").add(coursePayload);

    await subRef.set({
      status: "approved",
      reviewReason: "",
      reviewedBy: request.auth.uid,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      linkedCourseId: courseRef.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    if (instructorEmail) {
      await queueEmail({
        to: instructorEmail,
        template: "instructor-course-approved",
        subject: "تمت الموافقة على دورة الأستاذ - CourseHub",
        message: `تمت الموافقة على دورتك (${sub.title || ""}) ونقلها لقائمة الدورات قيد المراجعة.`
      }).catch(() => {});
    }

    return { ok: true, status: "approved", courseId: courseRef.id };
  }

  await subRef.set({
    status: "rejected",
    reviewReason: reason,
    reviewedBy: request.auth.uid,
    reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  if (instructorEmail) {
    await queueEmail({
      to: instructorEmail,
      template: "instructor-course-rejected",
      subject: "نتيجة مراجعة الدورة - CourseHub",
      message: `تم رفض دورتك (${sub.title || ""}). السبب: ${reason}`
    }).catch(() => {});
  }

  return { ok: true, status: "rejected" };
});

// Firestore Trigger: معالجة طابور الحذف authDeletionQueue
exports.processAuthDeletionQueue = onDocumentCreated(
  {
    document: "authDeletionQueue/{jobId}",
    region: "us-central1"
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const job = snap.data() || {};
    const ref = snap.ref;

    const attempts = Number(job.attempts || 0) + 1;

    // علامة بداية المعالجة
    await ref.update({
      attempts,
      status: "processing",
      processingAt: admin.firestore.FieldValue.serverTimestamp()
    });

    try {
      const result = await hardDeleteUserEverywhere(job.uid || null, job.email || null);

      await ref.update({
        status: "done",
        deletedUid: result.uid,
        deletedDocsCount: result.deletedDocsCount,

        // (اختياري) تفصيل التنظيف للتتبع
        cleanupBreakdown: result.cleanupBreakdown,

        // (اختياري) حالة حذف Auth
        authDeleted: result.authDeleted,
        authDeletionError: result.authDeletionError,

        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      await ref.update({
        status: "failed",
        errorMessage: String(error?.message || error),
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      throw error;
    }
  }
);
