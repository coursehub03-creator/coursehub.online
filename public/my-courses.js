import { firebaseAuth } from './firebase-config.js';
const { auth, db, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } = firebaseAuth;

// ===============================
// Track current tab
// ===============================
let currentTab = "current"; // default

function setupTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
  const contents = document.querySelectorAll(".tab-content");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      contents.forEach(c => c.classList.remove("active"));
      currentTab = tab.dataset.tab; // track current
      document.getElementById(currentTab).classList.add("active");

      renderCourses(globalCoursesData); // render only updates for current tab
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
    container.innerHTML = "";

    if (!data[key] || data[key].length === 0) {
      if (key === currentTab) { // show empty msg only for current tab
        const msg = document.createElement("div");
        msg.className = "empty-msg";
        msg.textContent = "لا توجد دورات هنا.";
        container.appendChild(msg);
      }
      return;
    }

    if (key !== currentTab) return; // render only current tab

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

      if (key === "current") {
        const completeBtn = document.createElement("button");
        completeBtn.textContent = "أكملت هذه الدورة";
        completeBtn.className = "btn-complete";
        completeBtn.addEventListener("click", async () => {
          const uid = auth.currentUser.uid;
          data.current = data.current.filter(c => c.id !== course.id);
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
