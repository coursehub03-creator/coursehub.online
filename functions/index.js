const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

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
        deletedUid: uid,
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
