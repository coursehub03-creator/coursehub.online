const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

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

  // nested user subcollections
  deleted += await deleteSubcollectionDocs(uid, "completedCourses");
  deleted += await deleteSubcollectionDocs(uid, "certificates");

  // finally remove the main user doc if still exists
  await db.collection("users").doc(uid).delete().catch(() => {});

  return deleted;
}

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

    // علامة بداية المعالجة (مفيدة للتتبع + منع تكرار التنفيذ لو تحب)
    await ref.update({
      attempts,
      status: "processing",
      processingAt: admin.firestore.FieldValue.serverTimestamp()
    });

    try {
      let uid = job.uid || null;

      if (!uid && job.email) {
        const userRecord = await admin.auth().getUserByEmail(job.email);
        uid = userRecord.uid;
      }

      if (!uid) throw new Error("No uid/email provided in job");

      // delete auth account (idempotent-ish: ignore not-found)
      try {
        await admin.auth().deleteUser(uid);
      } catch (authError) {
        if (authError?.code !== "auth/user-not-found") throw authError;
      }

      const deletedDocsCount = await cleanupUserData(uid);

      await ref.update({
        status: "done",
        deletedUid: uid,
        deletedDocsCount,
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
