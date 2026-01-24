// admin-courses.js
import { getFirestore, collection, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.16.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.16.0/firebase-auth.js";

const auth = getAuth();
const db = getFirestore();

// التحقق من تسجيل الدخول وحقوق المدير
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("يرجى تسجيل الدخول أولاً");
    window.location.href = "login.html";
    return;
  }

  let userData = null;
  try {
    const rawData = localStorage.getItem("coursehub_user");
    if (rawData) {
      userData = JSON.parse(rawData);
    }
  } catch (err) {
    console.error("خطأ في قراءة بيانات المستخدم من localStorage:", err);
  }

  if (!userData || userData.role !== "admin") {
    alert("غير مسموح بالدخول إلى هذه الصفحة");
    window.location.href = "index.html";
    return;
  }

  // تحميل الدورات بعد التحقق
  await loadCourses();
});

async function loadCourses() {
  const coursesContainer = document.getElementById("coursesContainer");
  if (!coursesContainer) return;

  try {
    const querySnapshot = await getDocs(collection(db, "courses"));
    coursesContainer.innerHTML = "";

    if (querySnapshot.empty) {
      coursesContainer.innerHTML = "<p>لا توجد دورات حالياً.</p>";
      return;
    }

    querySnapshot.forEach(docSnap => {
      const course = docSnap.data();
      const div = document.createElement("div");
      div.className = "course-item";
      div.innerHTML = `
        <h3>${course.title || "بدون عنوان"}</h3>
        <p>المدرب: ${course.instructor || "غير محدد"}</p>
        <button class="delete-btn">حذف</button>
      `;

      const deleteBtn = div.querySelector(".delete-btn");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", async () => {
          const confirmDelete = confirm("هل تريد حذف هذه الدورة؟");
          if (!confirmDelete) return;

          try {
            await deleteDoc(doc(db, "courses", docSnap.id));
            alert("تم حذف الدورة بنجاح");
            await loadCourses(); // إعادة تحميل القائمة
          } catch (err) {
            console.error("فشل حذف الدورة:", err);
            alert("حدث خطأ أثناء حذف الدورة.");
          }
        });
      }

      coursesContainer.appendChild(div);
    });
  } catch (err) {
    console.error("فشل تحميل الدورات:", err);
    coursesContainer.innerHTML = "<p>حدث خطأ أثناء تحميل الدورات.</p>";
  }
}
