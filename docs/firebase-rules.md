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
    match /users/{userId} {
      // يقرأ نفسه + الأدمن يقرأ الجميع
      allow get: if isOwner(userId) || isAdmin();
      allow list: if isAdmin();

      // إنشاء الوثيقة: صاحبها فقط
      allow create: if isOwner(userId);

      // تحديث ذاتي أو أدمن
      allow update: if isOwner(userId) || isAdmin();

      // حذف نهائي للأدمن فقط
      allow delete: if isAdmin();

      // الدورات المكتملة داخل المستخدم
      match /completedCourses/{courseId} {
        allow get, list: if isOwner(userId) || isAdmin();
        allow create, update, delete: if isOwner(userId) || isAdmin();
      }

      // الشهادات داخل المستخدم
      match /certificates/{certId} {
        allow get, list: if isOwner(userId) || isAdmin();
        allow create, update, delete: if isOwner(userId) || isAdmin();
      }
    }

    /* =========================
       instructor applications
    ========================= */
    match /instructorApplications/{appId} {
      // المستخدم ينشئ طلبه فقط لنفس uid
      allow create: if isSignedIn() && request.resource.data.uid == request.auth.uid;

      // المستخدم يقرأ طلبه، والأدمن يقرأ الجميع
      allow get: if isAdmin() || (isSignedIn() && resource.data.uid == request.auth.uid);
      allow list: if isAdmin();

      // فقط الأدمن يعدّل/يحذف
      allow update, delete: if isAdmin();
    }

    /* =========================
       email queue (admin only)
    ========================= */
    match /emailQueue/{emailId} {
      allow get, list, create, update, delete: if isAdmin();
    }

    /* =========================
       auth deletion queue (admin only)
       processed by Cloud Function Admin SDK
    ========================= */
    match /authDeletionQueue/{jobId} {
      allow get, list, create, update, delete: if isAdmin();
    }

    /* =========================
       courses
    ========================= */
    match /courses/{courseId} {
      allow read: if true;
      allow create, update, delete: if isAdmin();
    }

    /* =========================
       enrollments
    ========================= */
    match /enrollments/{docId} {
      allow get: if isAdmin() || (isSignedIn() && resource.data.userId == request.auth.uid);
      allow list: if isAdmin();

      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;
      allow update, delete: if isAdmin() || (isSignedIn() && resource.data.userId == request.auth.uid);
    }

    /* =========================
       certificates (public verify)
       IMPORTANT: لا تسمح بإنشاء عشوائي إلا للأدمن أو المدرّس/السيرفر
    ========================= */
    match /certificates/{certId} {
      allow read: if true;     // للتحقق من الشهادة
      allow get: if true;

      // الأفضل: اجعل الإنشاء للأدمن فقط أو Cloud Function
      allow create: if isAdmin();

      allow update, delete: if isAdmin();
      allow list: if isAdmin();
    }

    /* =========================
       notifications
    ========================= */
    match /notifications/{notifId} {
      allow get: if isAdmin() || (isSignedIn() && resource.data.userId == request.auth.uid);
      allow list: if isAdmin();

      // إنشاء إشعار: يفضّل للأدمن/السيرفر، لكن نتركه للمستخدم إن كنت تحتاجه
      allow create: if isSignedIn();

      allow update: if isAdmin() || (isSignedIn() && resource.data.userId == request.auth.uid);
      allow delete: if isAdmin();
    }

    /* =========================
       course reviews
    ========================= */
    match /courseReviews/{reviewId} {
      allow read: if true;
      allow get: if true;

      allow create: if isSignedIn();
      allow update, delete: if isAdmin();
      allow list: if isAdmin();
    }

    /* =========================
       quiz attempts
    ========================= */
    match /quizAttempts/{attemptId} {
      allow get: if isAdmin() || (isSignedIn() && resource.data.userId == request.auth.uid);
      allow list: if isAdmin();

      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;
      allow update, delete: if isAdmin() || (isSignedIn() && resource.data.userId == request.auth.uid);
    }
  }
}
