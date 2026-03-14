# CourseHub Design Decisions

## ما الذي تغيّر
- إنشاء طبقة design tokens مركزية في `css/design-system.css` (ألوان، spacing، radius، shadows، حالات badges/buttons/forms).
- إضافة `css/app-shell.css` لتوحيد تخطيط الطالب/الأستاذ/المسؤول.
- إعادة تصميم صفحات: الرئيسية، كتالوج الدورات، تفاصيل الدورة، لوحة الطالب، لوحة الأستاذ، لوحة المسؤول.
- إعادة بناء Course Builder كـ Wizard من 6 خطوات مع autosave وcompletion/quality score وsidebar تشغيلية.
- إضافة بيانات demo منظمة (`js/coursehub-demo-data.js`) لتوفير fallback وتطوير الواجهة بسرعة.

## لماذا تغيّر
- لتقليل التباين البصري والوظيفي بين الصفحات.
- لرفع وضوح الرحلة التعليمية (استكشاف → تسجيل → تعلم → شهادة).
- لجعل تجربة إنشاء الدورة عملية واحترافية مع checklists قابلة للتنفيذ.
- لتحسين القابلية للتوسع عبر مكوّنات CSS/JS مشتركة.

## كيف توحّد النظام بين الأدوار
- نفس بنية app shell: Sidebar + Topbar + Header + Content.
- نفس design tokens للحالات والأزرار والبطاقات والجداول.
- نفس مفهوم status badges عبر الدورات (`draft`, `in_review`, `published`, `archived`).
- builder يرفع حالة الدورة إلى `in_review` قبل الموافقة الإدارية.

## تحديثات تجربة الأستاذ (مرحلة التحسين)
- تم تحويل تنقل الأستاذ إلى روابط حقيقية تعمل بين كل الصفحات المطلوبة: Dashboard, Courses, Builder, Students, Tests, Reports, Settings.
- تم ربط إحصائيات الأستاذ ببيانات Firestore الفعلية (courses/enrollments/certificates/quizAttempts/submissions) بدلاً من أرقام ثابتة.
- Course Builder أصبح يدعم اختيار صور وفيديو من الجهاز مع معاينة مباشرة ورفع اختياري إلى Storage.
- تم إظهار حالة مراجعات المسؤول وسبب الرفض داخل واجهة الأستاذ ليسهل إعادة التعديل ثم إعادة الإرسال.
- زر "أنشئ دورتك" أصبح مرئياً فقط للمستخدم صاحب دور instructor.