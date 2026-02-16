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

async function deleteDocsByField(collectionName, fieldName, value) {
  if (!value) return 0;
  const snap = await db.collection(collectionName).where(fieldName, "==", value).get();
  if (snap.empty) return 0;

  const batch = db.batch();
  snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();
  return snap.size;
}

async function deleteAllFromSubcollection(path, uid, sub) {
  const snap = await db.collection(path).doc(uid).collection(sub).get();
  if (snap.empty) return 0;
  const batch = db.batch();
  snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();
  return snap.size;
}

async function cleanupUserData(uid) {
  let deleted = 0;

  deleted += await deleteDocsByField("instructorApplications", "uid", uid);
  deleted += await deleteDocsByField("certificates", "userId", uid);
  deleted += await deleteDocsByField("enrollments", "userId", uid);
  deleted += await deleteDocsByField("notifications", "userId", uid);
  deleted += await deleteDocsByField("quizAttempts", "userId", uid);
  deleted += await deleteDocsByField("user_courses", "uid", uid);
  deleted += await deleteDocsByField("achievements", "userId", uid);

  deleted += await deleteAllFromSubcollection("users", uid, "completedCourses");
  deleted += await deleteAllFromSubcollection("users", uid, "certificates");
  deleted += await deleteAllFromSubcollection("users", uid, "achievements");

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

  try {
    await admin.auth().deleteUser(resolvedUid);
  } catch (authError) {
    if (authError?.code !== "auth/user-not-found") throw authError;
  }

  const deletedDocsCount = await cleanupUserData(resolvedUid);
  return { uid: resolvedUid, deletedDocsCount };
}

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
