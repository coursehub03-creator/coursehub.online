import { firebaseAuth } from './firebase-config.js';
const { auth, db, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } = firebaseAuth;

// ===============================
// Track current tab
// ===============================
let currentTab = "current"; // default
let globalCoursesData = { current: [], completed: [], favorites: [] };

// ===============================
// Tabs Switching
// ===============================
function setupTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      // update tab button classes
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      // update current tab
      currentTab = tab.dataset.tab;

      // show/hide tab contents
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      document.getElementById(currentTab).classList.add("active");

      // render content for current tab
      renderTab(currentTab);
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
async function loadCourses() {
  setupTabs();

  const user = await loginIfNeeded();
  const userDocRef = doc(db, "user_courses", user.uid);
  const snapshot = await getDoc(userDocRef);

  if (snapshot.exists()) {
    globalCoursesData = snapshot.data();
  } else {
    await setDoc(userDocRef, globalCoursesData);
  }

  // render initial tab
  renderTab(currentTab);
}

// ===============================
// Render only a single tab
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
      completeBtn.textContent = "أكملت هذه الدورة";
      completeBtn.className = "btn-complete";
      completeBtn.addEventListener("click", async () => {
        const uid = auth.currentUser.uid;

        // نقل الدورة
        globalCoursesData.current = globalCoursesData.current.filter(c => c.id !== course.id);
        globalCoursesData.completed.push(course);

        await updateDoc(doc(db, "user_courses", uid), {
          current: globalCoursesData.current,
          completed: globalCoursesData.completed
        });

        renderTab(currentTab); // تحديث التبويب الحالي فقط
      });
      content.appendChild(document.createElement("br"));
      content.appendChild(completeBtn);
    }

    card.appendChild(content);

    // زر المفضلة (toggle)
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

      renderTab(currentTab); // تحديث التبويب الحالي فقط
    });

    card.appendChild(favBtn);
    container.appendChild(card);
  });
}

// ===============================
// Initialize
// ===============================
document.addEventListener("DOMContentLoaded", loadCourses);
