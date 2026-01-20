import { firebaseAuth } from './firebase-config.js';
const { auth, db, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } = firebaseAuth;

// ===============================
// Tabs Switching
// ===============================
function setupTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
  const contents = document.querySelectorAll(".tab-content");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      contents.forEach(c => c.classList.remove("active"));
      const target = document.getElementById(tab.dataset.tab);
      target.classList.add("active");
    });
  });
}

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
let globalCoursesData = { current: [], completed: [], favorites: [] };

async function loadCourses() {
  setupTabs();
  const user = await loginIfNeeded();
  const userDocRef = doc(db, "user_courses", user.uid);
  let snapshot = await getDoc(userDocRef);

  if (snapshot.exists()) {
    globalCoursesData = snapshot.data();
  } else {
    await setDoc(userDocRef, globalCoursesData);
  }

  renderCourses(globalCoursesData);
}

// ===============================
// Render Courses (CSP-safe)
// ===============================
function renderCourses(data) {
  ["current", "completed", "favorites"].forEach(key => {
    const container = document.getElementById(key);
    container.innerHTML = ""; // Clear old content

    if (!data[key] || data[key].length === 0) {
      const msg = document.createElement("div");
      msg.className = "empty-msg";
      msg.textContent = "لا توجد دورات هنا.";
      container.appendChild(msg);
      return;
    }

    data[key].forEach(course => {
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

      // زر "أكملت الدورة" فقط للدورات الحالية
      if (key === "current") {
        const completeBtn = document.createElement("button");
        completeBtn.textContent = "أكملت هذه الدورة";
        completeBtn.className = "btn-complete";
        completeBtn.addEventListener("click", async () => {
          const uid = auth.currentUser.uid;
          // إزالة من current
          data.current = data.current.filter(c => c.id !== course.id);
          // إضافة إلى completed
          data.completed.push(course);
          await updateDoc(doc(db, "user_courses", uid), {
            current: data.current,
            completed: data.completed
          });
          renderCourses(data);
        });
        content.appendChild(document.createElement("br"));
        content.appendChild(completeBtn);
      }

      card.appendChild(content);

      // زر المفضلة (toggle)
      const favBtn = document.createElement("i");
      favBtn.className = "fa fa-heart favorite-btn";
      if (data.favorites.some(f => f.id === course.id)) favBtn.classList.add("favorited");

      favBtn.addEventListener("click", async () => {
        const uid = auth.currentUser.uid;
        if (favBtn.classList.contains("favorited")) {
          favBtn.classList.remove("favorited");
          await updateDoc(doc(db, "user_courses", uid), { favorites: arrayRemove(course) });
          data.favorites = data.favorites.filter(f => f.id !== course.id);
        } else {
          favBtn.classList.add("favorited");
          await updateDoc(doc(db, "user_courses", uid), { favorites: arrayUnion(course) });
          data.favorites.push(course);
        }
        renderCourses(data);
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
