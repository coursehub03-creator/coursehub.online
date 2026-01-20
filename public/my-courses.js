import { firebaseAuth } from './firebase-config.js';
const { auth, db, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } = firebaseAuth;

let globalCoursesData = { current: [], completed: [], favorites: [] };
let currentTab = "current";

// ===============================
// User Login
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
// Load Courses from Firestore
// ===============================
async function loadCourses() {
  const user = await loginIfNeeded();
  const userDocRef = doc(db, "user_courses", user.uid);
  const snapshot = await getDoc(userDocRef);

  if (snapshot.exists()) {
    globalCoursesData = snapshot.data();
  } else {
    await setDoc(userDocRef, globalCoursesData);
  }

  renderTab(currentTab);
}

// ===============================
// Render a single tab
// ===============================
function renderTab(tabKey) {
  const container = document.getElementById(tabKey);
  container.innerHTML = "";

  const courses = globalCoursesData[tabKey] || [];
  if (courses.length === 0) {
    const msg = document.createElement("div");
    msg.className = "empty-msg";
    msg.textContent = "لا توجد دورات هنا.";
    container.appendChild(msg);
    return;
  }

  courses.forEach(course => {
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

    // زر أكملت الدورة فقط للدورات الحالية
    if (tabKey === "current") {
      const completeBtn = document.createElement("button");
      completeBtn.className = "btn-complete";
      completeBtn.textContent = "أكملت هذه الدورة";
      completeBtn.addEventListener("click", async () => {
        const uid = auth.currentUser.uid;
        globalCoursesData.current = globalCoursesData.current.filter(c => c.id !== course.id);
        globalCoursesData.completed.push(course);
        await updateDoc(doc(db, "user_courses", uid), {
          current: globalCoursesData.current,
          completed: globalCoursesData.completed
        });
        renderTab(currentTab);
      });
      content.appendChild(document.createElement("br"));
      content.appendChild(completeBtn);
    }

    card.appendChild(content);

    // زر المفضلة
    const favBtn = document.createElement("i");
    favBtn.className = "fa fa-heart favorite-btn";
    if (globalCoursesData.favorites.some(f => f.id === course.id)) favBtn.classList.add("favorited");

    favBtn.addEventListener("click", async () => {
      const uid = auth.currentUser.uid;
      if (favBtn.classList.contains("favorited")) {
        favBtn.classList.remove("favorited");
        await updateDoc(doc(db, "user_courses", uid), { favorites: arrayRemove(course) });
        globalCoursesData.favorites = globalCoursesData.favorites.filter(f => f.id !== course.id);
      } else {
        favBtn.classList.add("favorited");
        await updateDoc(doc(db, "user_courses", uid), { favorites: arrayUnion(course) });
        globalCoursesData.favorites.push(course);
      }
      renderTab(currentTab);
    });

    card.appendChild(favBtn);
    container.appendChild(card);
  });
}

// ===============================
// Setup Tabs after DOM is ready
// ===============================
function setupTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      currentTab = tab.dataset.tab;

      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      document.getElementById(currentTab).classList.add("active");

      renderTab(currentTab);
    });
  });
}

// ===============================
// Initialize everything after DOMContentLoaded
// ===============================
document.addEventListener("DOMContentLoaded", async () => {
  setupTabs();
  await loadCourses();
});
