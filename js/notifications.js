import { db } from "./firebase-config.js";
import { collection, getDocs, query, where, updateDoc, doc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * إرسال تنبيهات للطلاب الذين لم يكملوا درس معين
 * @param {string} courseId
 * @param {string} lessonTitle
 */
export async function notifyIncompleteStudents(courseId, lessonTitle) {
  // جلب كل الطلاب المشتركين في الدورة
  const q = query(collection(db, "studentProgress"), where("courseId", "==", courseId));
  const snapshot = await getDocs(q);

  snapshot.forEach(async studentDoc => {
    const data = studentDoc.data();
    if (!data.completedLessons?.includes(lessonTitle)) {
      // إنشاء تنبيه داخل الموقع
      const notificationRef = doc(db, "notifications", `${studentDoc.id}_${Date.now()}`);
      await setDoc(notificationRef, {
        userId: data.userId,
        courseId,
        lessonTitle,
        message: `لم تكمل درس "${lessonTitle}" بعد!`,
        createdAt: new Date(),
        read: false
      });

      // لاحقاً يمكن إضافة منطق إرسال الإيميل باستخدام Firebase Functions أو خدمة خارجية
      console.log(`تم إرسال تذكير للطالب ${data.userId} عن درس ${lessonTitle}`);
    }
  });
}

/**
 * الحصول على التنبيهات لمستخدم معين
 * @param {string} userId 
 * @returns array
 */
export async function getUserNotifications(userId) {
  const q = query(collection(db, "notifications"), where("userId", "==", userId));
  const snapshot = await getDocs(q);
  const notifications = [];
  snapshot.forEach(doc => notifications.push({ id: doc.id, ...doc.data() }));
  return notifications;
}

/**
 * تعليم إشعار كمقروء
 * @param {string} notificationId 
 */
export async function markNotificationRead(notificationId) {
  const notifRef = doc(db, "notifications", notificationId);
  await updateDoc(notifRef, { read: true });
}
