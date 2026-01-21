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

  const userData = JSON.parse(localStorage.getItem("coursehub_user"));
  if(userData.role !== "admin"){
    alert("غير مسموح بالدخول");
    window.location.href = "index.html";
    return;
  }

  loadCourses();
});

async function loadCourses(){
  const coursesContainer = document.getElementById("coursesContainer");
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
    deleteBtn.addEventListener("click", async () => {
      if(confirm("هل تريد حذف هذه الدورة؟")){
        await deleteDoc(doc(db, "courses", docSnap.id));
        loadCourses();
      }
    });
    coursesContainer.appendChild(div);
  });
}
