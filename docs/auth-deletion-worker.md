// Cloud Function لحذف مستخدمي Firebase Authentication من `authDeletionQueue`
// Functions v2 - Firestore Trigger

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

// Batch delete مع مراعاة حد 500 عملية لكل batch (نستخدم 450 كهوامش)
async function batchDeleteDocs(docRefs) {
  let deleted = 0;
  let batch = db.batch();
  let opCount = 0;

  for (const ref of docRefs) {
    batch.delete(ref);
    deleted += 1;
    opCount += 1;

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

async function deleteWhere(collectionName, field, value) {
  if (!value) return 0;

  const snap = await db.collection(collectionName).where(field, "==", value).get();
  if (snap.empty) return 0;

  const refs = snap.docs.map((d) => d.ref);
  return await batchDeleteDocs(refs);
}

async function purgeLinkedCollections(uid) {
  const targets = [
    // نفس المنطق اللي عندكم في لوحة الأدمن + توسعة التنظيف
    { collectionName: "instructorApplications", field: "uid" },
    { collectionName: "certificates", field: "userId" },
    { collectionName: "enrollments", field: "userId" },
    { collectionName: "notifications", field: "userId" },
    { collectionName: "quizAttempts", field: "userId" },
    { collectionName: "user_courses", field: "uid" }
  ];

  const results = {};
  for (const t of targets) {
    results[t.collectionName] = await deleteWhere(t.collectionName, t.field, uid);
  }
  return results;
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

    // علامة بداية المعالجة
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

      if (!uid) {
        throw new Error("No uid/email provided in job");
      }

      // 1) حذف المستخدم من Firebase Authentication (idempotent لو user-not-found)
      let authDeleted = false;
      let authDeletionError = null;

      try {
        await admin.auth().deleteUser(uid);
        authDeleted = true;
      } catch (authError) {
        if (authError?.code === "auth/user-not-found") {
          authDeleted = true; // اعتبرها OK
        } else {
          authDeleted = false;
          authDeletionError = String(authError?.message || authError);

          // بما أن الهدف حذف Auth + Firestore: نخليها فشل واضح
          throw new Error(`Auth deletion failed: ${authDeletionError}`);
        }
      }

      // 2) تنظيف البيانات المرتبطة بالمستخدم في Firestore
      const cleanup = await purgeLinkedCollections(uid);

      // (اختياري) حذف users/{uid} من Firestore إذا كان موجودًا
      // لو لوحة الأدمن تحذف/تؤرشف مسبقًا، هذا سلوك إضافي آمن:
      try {
        await db.collection("users").doc(uid).delete();
      } catch (_) {
        // تجاهل
      }

      // 3) تحديث حالة المهمة
      await ref.update({
        status: "done",
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        deletedUid: uid,
        cleanup,
        authDeleted,
        authDeletionError
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
