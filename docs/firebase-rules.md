rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }

    // الأفضل: admin=true في custom claims
    function isAdminByClaim() {
      return isSignedIn() && request.auth.token.admin == true;
    }

    // حل مؤقت: allowlist بالبريد (إلى أن تفعل custom claims)
    function isAdminByEmail() {
      return isSignedIn() && request.auth.token.email in [
        "kaleadsalous30@gmail.com",
        "coursehub03@gmail.com"
      ];
    }

    function isAdmin() {
      return isAdminByClaim() || isAdminByEmail();
    }

    /* =========================
       users
    ========================= */
    match /users/{uid} {
      allow read: if isOwner(uid) || isAdmin();

      // المستخدم ينشئ وثيقته لأول مرة فقط لنفسه
      allow create: if isOwner(uid);

      // المستخدم يعدّل وثيقته أو الأدمن يعدّل أي مستخدم
      allow update: if isOwner(uid) || isAdmin();

      // الحذف للأدمن فقط
      allow delete: if isAdmin();
    }

    /* =========================
       instructor applications
    ========================= */
    match /instructorApplications/{appId} {
      // المستخدم ينشئ طلبه فقط لنفسه
      allow create: if isSignedIn()
                    && request.resource.data.uid == request.auth.uid;

      // المستخدم يقرأ طلبه، والأدمن يقرأ الجميع
      allow read: if isAdmin()
                  || (isSignedIn() && resource.data.uid == request.auth.uid);

      // فقط الأدمن يعدّل/يحذف الطلب (قبول/رفض/أرشفة)
      allow update, delete: if isAdmin();
    }

    /* =========================
       email queue (admin only)
    ========================= */
    match /emailQueue/{emailId} {
      allow read, create, update, delete: if isAdmin();
    }

    /* =========================
       courses (example)
    ========================= */
    match /courses/{courseId} {
      allow read: if true;

      // إنشاء/تعديل/حذف: الأدمن أو صاحب الكورس (instructorId)
      allow create, update, delete: if isAdmin()
        || (isSignedIn() && request.resource.data.instructorId == request.auth.uid);
    }
  }
}
