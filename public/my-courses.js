import { firebaseAuth } from './firebase-config.js';
const { auth, db, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, doc, getDoc, setDoc, updateDoc, arrayUnion } = firebaseAuth;

// ===============================
// Tabs Switching
// ===============================
const tabs = document.querySelectorAll(".tab-btn");
const contents = document.querySelectorAll(".tab-content");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    contents.forEach(c => c.classList.remove("active"));
    document.getElementById(tab.dataset.tab).classList.add("active");
  });
});

// ===============================
// User Login if Needed
// ===============================
async function loginIfNeeded() {
  return new Promise(resolve => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        const result = await signInWithPopup(auth, new GoogleAuthProvider());
        resolve(result.user);
      } else {
        resolve(user);
      }
    });
  });
}

// ===============================
// Load User Courses
// ===============================
async function loadCourses() {
  const user = await loginIfNeeded();
  const userDocRef = doc(db, "user_courses", user.uid);
  let snapshot = await getDoc(userDocRef);

  let coursesData = { current: [], completed: [], favorites: [] };
  if (snapshot.exists()) {
    coursesData = snapshot.data();
  } else {
    await setDoc(userDocRef, coursesData);
  }

  renderCourses(coursesData);
}

// ===============================
// Render Courses (CSP-safe)
// ===============================
function renderCourses(data) {
  ["current", "completed", "favorites"].forEach(key => {
    const container = document.getElementById(key);
    container.innerHTML = ""; // Clear old content

    data[key].forEach(course => {
      // إنشاء عناصر البطاقة
      const card = document.createElement("div");
      card.className = "course-card";

      const img = document.createElement("img");
      img.src = course.image;
      img.alt = course.title;
      card.appendChild(img);

      const content = document.createElement("div");
      content.className = "course-content";

      const title = document.createElement("h4");
      title.textContent = course.title;
      title.style.cursor = "pointer";
      title.addEventListener("click", () => {
        window.location.href = `course.html?id=${course.id}`;
      });

      const instructor = document.createElement("span");
      instructor.textContent = `المدرب: ${course.instructor}`;

      content.appendChild(title);
      content.appendChild(document.createElement("br"));
      content.appendChild(instructor);
      card.appendChild(content);

      // زر المفضلة
      const favBtn = document.createElement("i");
      favBtn.className = `fa fa-heart favorite-btn`;
      if (data.favorites.some(f => f.id === course.id)) {
        favBtn.classList.add("favorited");
      }

      favBtn.addEventListener("click", async () => {
        const uid = auth.currentUser.uid;
        if (!favBtn.classList.contains("favorited")) {
          favBtn.classList.add("favorited");
          await updateDoc(doc(db, "user_courses", uid), { favorites: arrayUnion(course) });
        }
      });

      card.appendChild(favBtn);
      container.appendChild(card);
    });
  });
}

// ===============================
// Initialize
// ===============================
document.addEventListener("DOMContentLoaded", loadCourses);
