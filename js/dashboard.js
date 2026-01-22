// admin-courses.js
import { getFirestore, collection, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.16.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.16.0/firebase-auth.js";

const auth = getAuth();
const db = getFirestore();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    alert("يرجى تسجيل الدخول");
    window.location.href = "login.html";
    return;
  }

  let userData = null;
  try {
    userData = JSON.parse(localStorage.getItem("coursehub_user"));
  } catch (err) {
    console.error("Failed to parse user data from localStorage:", err);
    alert("حدث خطأ بالتحقق من بيانات المستخدم.");
    window.location.href = "login.html";
    return;
  }

  if (!userData || userData.role !== "admin") {
    alert("غير مسموح بالدخول");
    window.location.href = "index.html";
    return;
  }

  await loadCourses();
});

async function loadCourses() {
  const coursesContainer = document.getElementById("coursesContainer");
  if (!coursesContainer) return;

  try {
    const querySnapshot = await getDocs(collection(db, "courses"));
    coursesContainer.innerHTML = "";

    querySnapshot.forEach(docSnap => {
      const course = docSnap.data();
      const div = document.createElement("div");
      div.className = "course-item";
      div.innerHTML = `
        <h3>${course.title}</h3>
        <p>المدرب: ${course.instructor}</p>
        <button class="delete-btn">حذف</button>
      `;

      const deleteBtn = div.querySelector(".delete-btn");
      if (deleteBtn) {
        deleteBtn.addEventListener("click", async () => {
          if (confirm("هل تريد حذف هذه الدورة؟")) {
            try {
              await deleteDoc(doc(db, "courses", docSnap.id));
              loadCourses();
            } catch (err) {
              console.error("Failed to delete course:", err);
              alert("فشل حذف الدورة.");
            }
          }
        });
      }

      coursesContainer.appendChild(div);
    });
  } catch (err) {
    console.error("Failed to load courses:", err);
    if (coursesContainer) coursesContainer.innerHTML = "<p>حدث خطأ أثناء تحميل الدورات.</p>";
  }
}
