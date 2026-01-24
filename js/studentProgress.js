import { db, auth } from "./firebase-config.js";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * تسجيل تقدم الطالب في درس معين
 * @param {string} courseId - معرف الدورة
 * @param {string} lessonTitle - عنوان الدرس
 */
export async function markLessonCompleted(courseId, lessonTitle) {
  const user = auth.currentUser;
  if (!user) return;

  const userProgressRef = doc(db, "studentProgress", `${user.uid}_${courseId}`);
  const snapshot = await getDoc(userProgressRef);

  if (!snapshot.exists()) {
    await setDoc(userProgressRef, {
      courseId,
      userId: user.uid,
      completedLessons: [lessonTitle],
      completedAt: Timestamp.now()
    });
  } else {
    await updateDoc(userProgressRef, {
      completedLessons: arrayUnion(lessonTitle),
      completedAt: Timestamp.now()
    });
  }
}

/**
 * التحقق إذا أنجز الطالب درس معين
 * @param {string} courseId 
 * @param {string} lessonTitle 
 * @returns boolean
 */
export async function isLessonCompleted(courseId, lessonTitle) {
  const user = auth.currentUser;
  if (!user) return false;

  const userProgressRef = doc(db, "studentProgress", `${user.uid}_${courseId}`);
  const snapshot = await getDoc(userProgressRef);

  if (!snapshot.exists()) return false;

  const data = snapshot.data();
  return data.completedLessons?.includes(lessonTitle);
}

/**
 * الحصول على كل الدروس المكتملة
 * @param {string} courseId 
 * @returns array
 */
export async function getCompletedLessons(courseId) {
  const user = auth.currentUser;
  if (!user) return [];

  const snapshot = await getDoc(doc(db, "studentProgress", `${user.uid}_${courseId}`));
  if (!snapshot.exists()) return [];
  return snapshot.data().completedLessons || [];
}
