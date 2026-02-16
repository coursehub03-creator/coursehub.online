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

// يراعي حد الـ batch (500) بتجزئة الحذف على دفعات
async function batchDeleteDocs(docRefs) {
  let deleted = 0;
  let batch = db.batch();
  let opCount = 0;

  for (const ref of docRefs) {
    batch.delete(ref);
    deleted += 1;
    opCount += 1;

    // نخليها 450 للهوامش
    if (opCount >= 450) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) {
    await batch.commit();
  }

  return deleted;
}

async function deleteDocsByField(collectionName, fieldName, value) {
  if (!value) return 0;

  const snap = await db.collection(collectionName).where(fieldName, "==", value).get();
  if (snap.empty) return 0;

  const refs = snap.docs.map((d) => d.ref);
  return await batchDeleteDocs(refs);
}

async function deleteSubcollectionDocs(uid, subcollectionName) {
  if (!uid) return 0;

  const snap = await db.collection("users").doc(uid).collection(subcollectionName).get();
  if (snap.empty) return 0;

  const refs = snap.docs.map((d) => d.ref);
  return await batchDeleteDocs(refs);
}

async function cleanupUserData(uid) {
  let deleted = 0;

  // top-level collections tied to uid/userId
  deleted += await deleteDocsByField("instructorApplications", "uid", uid);
  deleted += await deleteDocsByField("certificates", "userId", uid);
  deleted += await deleteDocsByField("enrollments", "userId", uid);
  deleted += await deleteDocsByField("notifications", "userId", uid);
  deleted += await deleteDocsByField("quizAttempts", "userId", uid);
  deleted += await deleteDocsByField("user_courses", "uid", uid);
  deleted += await deleteDocsByField("achievements", "userId", uid);

  // nested user subcollections
  deleted += await deleteSubcollectionDocs(uid, "completedCourses");
  deleted += await deleteSubcollectionDocs(uid, "certificates");
  deleted += await deleteSubcollectionDocs(uid, "achievements");

  // finally remove the main user doc if still exists
  await db.collection("users").doc(uid).delete().catch(() => {});

  return deleted;
}

async function hardDeleteUserEverywhere(uid, email) {
  let resolvedUid = uid || null;

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

  // delete auth account (idempotent-ish: ignore not-found)
  try {
    await admin.auth().deleteUser(resolvedUid);
  } catch (authError) {
    if (authError?.code !== "auth/user-not-found") throw authError;
  }

  const deletedDocsCount = await cleanupUserData(resolvedUid);
  return { uid: resolvedUid, deletedDocsCount };
}

// Callable: حذف فوري من لوحة الأدمن
exports.hardDeleteUser = onCall({ region: "us-central1" }, async (request) => {
  if (!isAdminContext(request.auth)) {
    throw new HttpsError("permission-denied", "Only admins can delete users.");
  }

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
      deletedDocsCount: result.deletedDocsCount
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
