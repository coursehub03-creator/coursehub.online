# Firebase Security Rules (اقتراح جاهز لـ CourseHub)

> هذه القواعد تقفل تدفق طلبات الأساتذة بشكل صحيح، وتسمح للأدمن بإدارة الطلبات والمستخدمين.
> 
> **مهم:** الحذف النهائي من Firebase Authentication (وليس Firestore فقط) يحتاج Cloud Function بـ Admin SDK.

## 1) Firestore Rules

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

    // اقرأها من custom claim: admin=true
    function isAdmin() {
      return isSignedIn() && request.auth.token.admin == true;
    }

    // users
    match /users/{uid} {
      allow read: if isOwner(uid) || isAdmin();
      allow create: if isOwner(uid);
      allow update: if isOwner(uid) || isAdmin();
      allow delete: if isAdmin();
    }

    // instructor applications
    match /instructorApplications/{appId} {
      // المستخدم ينشئ طلبه ويقرأ طلبه
      allow create: if isSignedIn() && request.resource.data.uid == request.auth.uid;
      allow read: if isAdmin() || (isSignedIn() && resource.data.uid == request.auth.uid);

      // فقط الأدمن يعدّل حالة الطلب (قبول/رفض)
      allow update, delete: if isAdmin();
    }

    // email queue: فقط الأدمن يكتب/يقرأ
    match /emailQueue/{emailId} {
      allow read, create, update, delete: if isAdmin();
    }

    // courses مثال: القراءة للجميع، الكتابة للأستاذ/الأدمن
    match /courses/{courseId} {
      allow read: if true;
      allow create, update, delete: if isAdmin() || (isSignedIn() && request.resource.data.instructorId == request.auth.uid);
    }
  }
}
```

## 2) Storage Rules (شهادة العمل PDF)

```rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    function isSignedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return isSignedIn() && request.auth.token.admin == true;
    }

    // مسار رفع شهادات العمل
    match /instructor-applications/{uid}/{fileName} {
      // الأستاذ يرفع ملف PDF لنفسه فقط
      allow write: if isSignedIn()
                   && request.auth.uid == uid
                   && request.resource.contentType.matches('application/pdf');

      // قراءة الملف للأدمن فقط
      allow read: if isAdmin();
    }
  }
}
```

## 3) ملاحظة عن "الحذف النهائي"

زر الحذف الحالي في لوحة الأدمن يحذف:
- وثيقة المستخدم من `users`
- أي طلبات له من `instructorApplications`

أما حذف حساب Firebase Authentication نفسه فيتطلب endpoint آمن (Cloud Function callable) يشتغل بـ Admin SDK ويتحقق أن المنفّذ أدمن.
