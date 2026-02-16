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
 * - يحذف من عدة collections
 * - يدور على عدة حقول (uid/userId/email/userEmail) لتفادي اختلافات البيانات القديمة/الجديدة
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

  // إضافات تنظيف مفيدة (من الفرع الآخر)
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

  // 1) تنظيف Firestore أولًا (كما في codex)
  const cleanupResult = await cleanupUserData(resolvedUid, email || null);

  // 2) حذف Auth بشكل non-fatal (ميزة codex) — لا نفشل العملية لو تعذر Auth
  let authDeleted = false;
  let authDeletionError = null;

  try {
    await admin.auth().deleteUser(resolvedUid);
    authDeleted = true;
  } catch (authError) {
    if (authError?.code === "auth/user-not-found") {
      authDeleted = true;
    } else {
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
