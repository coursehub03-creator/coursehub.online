# إعداد صلاحيات الأدمن (Firebase Custom Claims)

هذا الدليل يشرح **أين تضع السكربت** وكيف **تشغّله** لتعيين مستخدم كأدمن.

## 1) جهّز مجلد السكربت
أنشئ مجلدًا على جهازك (مثال: `C:\firebase-admin`).

ضع داخل المجلد ملفين:
- ملف حساب الخدمة `serviceAccountKey.json` الذي نزّلته من Firebase Console.
- ملف السكربت `setAdmin.js` (المحتوى بالأسفل).

## 2) محتوى السكربت `setAdmin.js`
> استبدل قيمة `uid` بـ UID الخاص بالمستخدم الذي تريد تعيينه أدمن.

```js
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uid = "PUT_USER_UID_HERE";

admin
  .auth()
  .setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log("✅ تم تعيين الأدمن بنجاح");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

## 3) ثبّت الاعتماديات مرة واحدة
افتح Terminal داخل نفس المجلد وشغّل:

```bash
npm init -y
npm install firebase-admin
```

## 4) شغّل السكربت
من نفس المجلد:

```bash
node setAdmin.js
```

إذا ظهرت الرسالة ✅، تم التعيين بنجاح.

## 5) بعد نجاح السكربت
- **سجّل خروج** من الموقع.
- ثم **سجّل دخول** مرة ثانية لكي يتم تحميل الـ Custom Claims.

## ملاحظات مهمة
- يجب أن يكون ملف `serviceAccountKey.json` في **نفس مجلد السكربت**.
- تأكد أن الـ UID صحيح (تأخذه من Firebase Authentication).
- هذا السكربت يعمل محليًا على جهازك، وليس داخل الاستضافة.
