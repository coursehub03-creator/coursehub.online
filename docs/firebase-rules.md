# Firebase Security Rules (محدّثة ومطابقة لتدفق CourseHub الحالي)

> هذه النسخة مبنية على القواعد التي أرسلتها، وتم تحديثها لتتوافق مع:
> - إدارة طلبات الأساتذة (`instructorApplications`)
> - طابور البريد (`emailQueue`)
> - طابور حذف حسابات Authentication (`authDeletionQueue`)
> - حذف المستخدم من لوحة الأدمن (delete/archive)
> - التوافق مع أدمن عبر `custom claim` أو `email allowlist`

## Firestore Rules

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }

    // الأدمن الأساسي عبر custom claims
    function isAdminByClaim() {
      return isSignedIn() && request.auth.token.admin == true;
    }

    // fallback متوافق مع لوحة الأدمن الحالية لو claims غير مفعلة بعد
    function isAdminByEmail() {
      return isSignedIn() && request.auth.token.email in [
        "kaleadsalous30@gmail.com",
        "coursehub03@gmail.com"
      ];
    }

    function isAdmin() {
      return isAdminByClaim() || isAdminByEmail();
    }

    function isInstructor() {
      return isSignedIn()
             && request.auth.token.role == "instructor"
             && request.auth.token.status == "active";
    }

    // المستخدمون
    match /users/{userId} {
      // يقرأ نفسه + الأدمن يقرأ الجميع
      allow get: if isOwner(userId) || isAdmin();
      allow list: if isAdmin();

      // إنشاء الحساب الذاتي فقط
      allow create: if isOwner(userId);

      // تحديث ذاتي أو أدمن
      allow update: if isOwner(userId) || isAdmin();

      // حذف نهائي عبر الأدمن فقط
      allow delete: if isAdmin();

      // الدورات المكتملة داخل المستخدم
      match /completedCourses/{courseId} {
        allow read, write: if isOwner(userId) || isAdmin();
      }

      // الشهادات داخل المستخدم
      match /certificates/{certId} {
        allow read, write: if isOwner(userId) || isAdmin();
      }
    }

    // طلبات الأساتذة
    match /instructorApplications/{appId} {
      // المستخدم ينشئ طلبه فقط لنفس uid
      allow create: if isSignedIn() && request.resource.data.uid == request.auth.uid;

      // المستخدم يقرأ طلبه، والأدمن يقرأ الجميع
      allow get: if isAdmin() || (isSignedIn() && resource.data.uid == request.auth.uid);
      allow list: if isAdmin();

      // التعديل/الحذف للأدمن فقط
      allow update, delete: if isAdmin();
    }

    // طابور البريد
    match /emailQueue/{emailId} {
      allow get, list, create, update, delete: if isAdmin();
    }

    // طابور حذف حسابات Authentication (يعالَج عبر Cloud Function Admin SDK)
    match /authDeletionQueue/{jobId} {
      allow get, list, create, update, delete: if isAdmin();
    }

    // الدورات
    match /courses/{courseId} {
      allow read: if true;
      allow create, update, delete: if isAdmin();
    }

    // التسجيلات (بدء/استكمال الدورة)
    match /enrollments/{docId} {
      // قراءة المستند: مالكه أو الأدمن
      allow get: if isAdmin() || (isSignedIn() && resource.data.userId == request.auth.uid);
      // السماح للمستخدم بجلب تسجيلاته عبر query where(userId == auth.uid)
      allow list: if isAdmin() || isSignedIn();

      // الإنشاء: userId يجب يطابق uid الحالي
      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;

      // التحديث/الحذف: مالكه أو الأدمن
      allow update, delete: if isAdmin() || (isSignedIn() && resource.data.userId == request.auth.uid);
    }

    // الشهادات العامة
    match /certificates/{certId} {
      allow read: if true; // للتحقق من الشهادة
      allow create: if isSignedIn();
      allow update, delete: if isAdmin();
      allow list: if isAdmin();
    }

    // إشعارات المستخدم
    match /notifications/{notifId} {
      allow get: if isAdmin() || (isSignedIn() && resource.data.userId == request.auth.uid);
      // السماح للمستخدم بجلب إشعاراته عبر query where(userId == auth.uid)
      allow list: if isAdmin() || isSignedIn();

      allow create: if isSignedIn();
      allow update: if isAdmin() || (isSignedIn() && resource.data.userId == request.auth.uid);
      allow delete: if isAdmin();
    }

    // مراجعات الدورات
    match /courseReviews/{reviewId} {
      allow read: if true;
      allow create: if isSignedIn();
      allow update, delete: if isAdmin();
      allow list: if isAdmin();
    }

    // محاولات الاختبارات
    match /quizAttempts/{attemptId} {
      allow get: if isAdmin() || (isSignedIn() && resource.data.userId == request.auth.uid);
      // السماح للمستخدم بجلب محاولاته عبر query where(userId == auth.uid)
      allow list: if isAdmin() || isSignedIn();

      allow create: if isSignedIn() && request.resource.data.userId == request.auth.uid;
      allow update, delete: if isAdmin() || (isSignedIn() && resource.data.userId == request.auth.uid);
    }
  }
}

rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    function isSignedIn() {
      return request.auth != null;
    }

    function isAdminByClaim() {
      return isSignedIn() && request.auth.token.admin == true;
    }

    function isAdminByEmail() {
      return isSignedIn() && request.auth.token.email in [
        "kaleadsalous30@gmail.com",
        "coursehub03@gmail.com"
      ];
    }

    function isAdmin() {
      return isAdminByClaim() || isAdminByEmail();
    }

    // ملفات الدورات العامة (يرفعها الأدمن فقط)
    match /courses/{allPaths=**} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // ملفات إثبات العمل للأساتذة (PDF)
    match /instructor-applications/{uid}/{fileName} {
      allow write: if isSignedIn()
                   && request.auth.uid == uid
                   && (
                        request.resource.contentType.matches('application/pdf')
                        || fileName.matches('(?i).*\\.pdf$')
                      );

      allow read: if isAdmin();
    }

    // ملفات الدورات المرفوعة من الأستاذ قبل مراجعة المشرف
    // المسار المستخدم في الواجهة: instructor-courses/{uid}/...
    match /instructor-courses/{uid}/{allPaths=**} {

      // ✅ حل مشكلة 403: اسمح لأي مستخدم مسجل دخول بالرفع داخل مجلده فقط
      // حتى لو لم تكن custom claims (role/status) موجودة على التوكن بعد
      allow create, update, delete: if isSignedIn() && request.auth.uid == uid;

      // القراءة لصاحب الملفات نفسه أو الأدمن
      allow read: if (isSignedIn() && request.auth.uid == uid) || isAdmin();
    }
  }
}
