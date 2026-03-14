# CourseHub Release Notes

## الإصدار
UI/UX Refresh - Q1

## الجديد
- تصميم واجهة تسويقية احترافية مع Hero + trust bar + featured courses + tracks + testimonials + FAQ.
- كتالوج دورات بفلاتر/فرز/بحث فوري + load more + empty state.
- صفحة تفاصيل دورة بصيغة sales + learning information مع CTA ثابت.
- لوحات موحدة للطالب/الأستاذ/المسؤول عبر app shell موحّد.
- Course Builder جديد بنمط stepper (6 خطوات) مع:
  - auto-save
  - unsaved changes guard
  - progress indicator
  - quality score
  - sidebar لحالة الدورة ومؤشرات الجاهزية

## تحسينات الوصول والأداء
- تحسين focus states للمدخلات والأزرار.
- تعريف أبعاد الصور الرئيسية لتقليل CLS.
- تفعيل lazy loading لصور الكروت خارج LCP.

## ملاحظات لاحقة
- يوصى بربط بيانات demo الحالية بقراءات/كتابات Firestore في مرحلة لاحقة.
- يوصى بإضافة اختبارات E2E للرحلة الكاملة (catalog → detail → player → certificate).

## تحسينات إضافية للأستاذ
- إصلاح شامل للتنقل داخل واجهات الأستاذ مع صفحات منفصلة لكل قسم.
- تفعيل flow حقيقي لإرسال الدورة للمراجعة ومتابعة حالة القبول/الرفض وأسباب الرفض.
- إضافة رفع وسائط من الجهاز في منشئ الدورات (image/video) مع preview.
- تفعيل Role-based visibility لزر "أنشئ دورتك" (يظهر للأستاذ فقط).
