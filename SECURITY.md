# Security Policy

## Supported Versions

Use this section to tell people about which versions of your project are
currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 5.1.x   | :white_check_mark: |
| 5.0.x   | :x:                |
| 4.0.x   | :white_check_mark: |
| < 4.0   | :x:                |

## Reporting a Vulnerability

Use this section to tell people how to report a vulnerability.

Tell them where to go, how often they can expect to get an update on a
reported vulnerability, what to expect if the vulnerability is accepted or
declined, etc.

## Email Deliverability (Firebase + Brevo) — Final Fix Checklist

هذه قائمة عملية نهائية لتحسين وصول رسائل Firebase (تفعيل البريد/إعادة التعيين) وتقليل احتمالية دخولها إلى Spam:

1. **تدوير المفاتيح فورًا عند أي تسريب**
   - غيّر أي مفاتيح SMTP/API مكشوفة في المستودع أو السجلات.
   - ألغِ المفاتيح القديمة وأنشئ مفاتيح جديدة بصلاحيات محدودة.

2. **ضبط SMTP الصحيح لـ Brevo داخل Firebase**
   - استخدم مضيف Brevo الصحيح ومنفذ TLS/STARTTLS المناسب.
   - استخدم مرسلًا من نفس الدومين الذي تم توثيقه في Brevo.

3. **توثيق الدومين بالكامل (SPF + DKIM)**
   - تأكد أن SPF يتضمن Brevo فقط بدون تكرار متعارض.
   - فعّل DKIM وانتظر اكتمال الانتشار DNS ثم تحقق من الحالة “Verified”.

4. **إعداد DMARC تدريجيًا**
   - ابدأ بـ `p=none` مع تقارير.
   - بعد الاستقرار ارفع السياسة تدريجيًا إلى `quarantine` ثم `reject`.

5. **تحقق فعلي من نتائج المصادقة**
   - افحص ترويسات الرسالة (`Authentication-Results`) وتأكد من:
     - `spf=pass`
     - `dkim=pass`
     - `dmarc=pass`

6. **استخدم روابط موثوقة من نفس دومين التطبيق**
   - اجعل روابط التفعيل/إعادة التعيين تشير إلى دومين الموقع الفعلي (وليس دومينًا غريبًا).

7. **راقب السمعة باستمرار**
   - راقب معدلات bounce/complaint/open.
   - نظف القوائم غير النشطة وتجنب الإرسال الكثيف المفاجئ.

> ملاحظة تشغيلية مهمة: لا يوجد حل ثابت يضمن وصولًا 100% دائمًا. أفضل نتيجة تأتي من مزيج: إعدادات DNS صحيحة + إعداد SMTP صحيح + سمعة إرسال جيدة + مراقبة وتحسين مستمر.

## Branded Email Content Standard (CourseHub)

لجعل رسائل المستخدمين أكثر احترافية وبهوية بصرية واضحة:

1. استخدم اسم مرسل ثابت: `CourseHub`.
2. استخدم شعار الموقع الرسمي:
   - `https://coursehub.online/assets/images/logo.png`
3. اجعل كل قوالب Firebase (تفعيل البريد/إعادة التعيين/تغيير البريد) بنفس الهوية (Header + Footer + CTA واضح).
4. استخدم نصًا ثنائي اللغة (AR/EN) مختصرًا وواضحًا.
5. احتفظ دائمًا بمتغير الرابط `%LINK%` كما هو داخل القالب.

قوالب HTML الجاهزة (احترافية) موجودة هنا:

- `docs/firebase-email-templates.md`
