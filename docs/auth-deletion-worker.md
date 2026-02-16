# Cloud Function لحذف مستخدمي Firebase Authentication من `authDeletionQueue`

استخدم هذه الفنكشن إذا أردت أن زر الحذف في لوحة الأدمن يحذف المستخدم من Firestore **ومن Firebase Authentication**.

## الفكرة
- الواجهة تضيف مستندًا في `authDeletionQueue`.
- Cloud Function (Admin SDK) تقرأ المستند وتحذف مستخدم Auth بواسطة `uid` أو `email`.
- ثم تنظّف البيانات المرتبطة بالمستخدم في Firestore (certificates/enrollments/notifications/quizAttempts/user_courses/instructorApplications... إلخ).
- بعدها تحدّث المستند إلى `status: done` أو `status: failed`.

## مثال Node.js (Functions v2)

```js
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

async function deleteWhere(collectionName, field, value) {
  const snap = await db.collection(collectionName).where(field, "==", value).get();
  if (snap.empty) return 0;

  // Batch delete (مع تقسيم للحد الأقصى 500 عملية لكل batch)
  let deleted = 0;
  let batch = db.batch();
  let opCount = 0;

  for (const docSnap of snap.docs) {
    batch.delete(docSnap.ref);
    deleted += 1;
    opCount += 1;

    if (opCount === 450) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) await batch.commit();
  return deleted;
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
  "authDeletionQueue/{jobId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const job = snap.data() || {};
    const ref = snap.ref;

    try {
      let uid = job.uid || null;

      if (!uid && job.email) {
        const userRecord = await admin.auth().getUserByEmail(job.email);
        uid = userRecord.uid;
      }

      if (!uid) {
        throw new Error("No uid/email provided in job");
      }

      // 1) حذف المستخدم من Firebase Authentication
      await admin.auth().deleteUser(uid);

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
        cleanup
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
