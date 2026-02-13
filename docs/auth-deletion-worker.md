# Cloud Function لحذف مستخدمي Firebase Authentication من `authDeletionQueue`

استخدم هذه الفنكشن إذا أردت أن زر الحذف في لوحة الأدمن يحذف المستخدم من Firestore **ومن Firebase Authentication**.

## الفكرة
- الواجهة تضيف مستندًا في `authDeletionQueue`.
- Cloud Function (Admin SDK) تقرأ المستند وتحذف مستخدم Auth بواسطة `uid` أو `email`.
- بعدها تحدّث المستند إلى `status: done` أو `status: failed`.

## مثال Node.js (Functions v2)

```js
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

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

      await admin.auth().deleteUser(uid);

      await ref.update({
        status: "done",
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        deletedUid: uid
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
```

## متطلبات
- تثبيت Firebase Functions + Admin SDK داخل مشروع functions.
- نشر الفنكشن (`firebase deploy --only functions`).
- منح الأدمن فقط صلاحية الكتابة على `authDeletionQueue` (موجودة في `docs/firebase-rules.md`).
