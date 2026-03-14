# CourseHub Audit

## Stack الحالي
- مشروع static متعدد الصفحات (HTML/CSS/JS) بدون framework front-end.
- Firebase مستخدم في عدة صفحات (Auth/Firestore/Storage) عبر SDK مباشر من CDN.
- لا يوجد backend server app تقليدي داخل المستودع، والمنطق قائم على Firestore + localStorage.

## بنية الصفحات
- صفحات عامة: `index.html`, `courses.html`, `course-detail.html`.
- تجربة الطالب: `my-courses.html`, `course-player.html`, `tests.html`, `certificates.html`.
- تجربة الأستاذ: `instructor-dashboard.html`, `instructor-builder.html`.
- تجربة المسؤول: ضمن مجلد `admin/` (مثل `admin/dashboard.html`).

## التمثيل الحالي للبيانات
- بيانات الدورات والطلاب تعتمد أساساً على Firestore (collection `courses` وغيرها في سكربتات JS).
- مسودات builder محفوظة محلياً في localStorage.
- التقدم الدراسي محفوظ جزئياً في user subcollections داخل Firestore (حسب صفحات المشغل).

## أبرز المشاكل قبل التحسين
1. غياب Design System موحّد بين الصفحات والأدوار.
2. تباين كبير في app shell بين الطالب/الأستاذ/المسؤول.
3. صفحات marketing/catalog/detail كانت أقل إقناعاً وتنقصها بنية مبيعات تعليمية متكاملة.
4. منشئ الدورات كان يحتاج stepper أوضح، sidebar تشغيلية، ومؤشرات اكتمال/جودة.
5. نقص في توحيد حالات الدورات (draft/in_review/published/archived) بصرياً.
6. تفاوت في responsive ووضوح حالات empty/loading/action عبر الصفحات.
