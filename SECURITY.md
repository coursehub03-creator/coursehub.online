# Security Policy

## Supported Versions

نقوم بدعم أحدث نسخة على الفرع الرئيسي (`main`) فقط حاليًا.

| Version | Supported |
| ------- | --------- |
| main    | ✅        |
| older   | ❌        |

## Reporting a Vulnerability

إذا اكتشفت ثغرة أمنية، الرجاء:

1. عدم نشر تفاصيل الثغرة بشكل علني.
2. فتح بلاغ أمني خاص عبر GitHub Security Advisories (إن كانت مفعّلة) أو مشاركة التفاصيل بشكل مباشر مع مالك المشروع.
3. تضمين خطوات إعادة الإنتاج وتأثير الثغرة.

سنقوم بمراجعة البلاغ والرد في أسرع وقت ممكن.

## Baseline Hardening Checklist (Applied)

- تم تفعيل تسجيل الدخول وإنشاء الحساب عبر Firebase Authentication بدل التخزين المحلي لكلمات المرور.
- تم إزالة منطق التسجيل المحلي غير الآمن الذي كان يخزن كلمات المرور داخل `localStorage`.
- تم تحسين واجهات تسجيل الدخول/إنشاء الحساب مع رسائل أخطاء واضحة وتحقق أولي من طول كلمة المرور.

## GitHub Repository Protection Recommendations

لا يمكن تقنيًا جعل المستودع "متاحًا لـ Codex فقط" إذا كان Public. لتقييد الوصول:

1. اجعل المستودع **Private**.
2. أضف فقط الحسابات أو GitHub App المصرح لها (Codex integration) بصلاحية **Least Privilege**.
3. فعّل **Branch Protection Rules** للفرع الرئيسي:
   - Require pull request.
   - Require status checks.
   - Restrict who can push.
4. فعّل **Secret Scanning** و **Dependabot alerts**.
5. ألغِ أي Personal Access Token قديم، واستخدم tokens قصيرة الصلاحية.
6. امنع رفع الأسرار عبر `.gitignore` واستخدم GitHub Actions secrets.

> ملاحظة: Codex لا يتجاوز صلاحيات GitHub؛ إذا كان المستودع Private ومقيد الصلاحيات، فلن يتمكن غير المصرح لهم من الوصول.
