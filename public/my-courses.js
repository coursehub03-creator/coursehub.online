// Firebase Config
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.6.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCagdZU_eAHebBGCmG5W4FFTcDZIH4wOp0",
  authDomain: "coursehub-23ed2.firebaseapp.com",
  projectId: "coursehub-23ed2",
  storageBucket: "coursehub-23ed2.firebasestorage.app",
  messagingSenderId: "367073521017",
  appId: "1:367073521017:web:67f5fd3be4c6407247d3a8",
  measurementId: "G-NJ6E39V9NW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// --- تسجيل دخول Google ---
async function login() {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const user = result.user;
  return user;
}

// --- العناصر ---
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

// --- جلب البيانات وعرضها ---
async function loadCourses() {
  let user = auth.currentUser;
  if (!user) {
    user = await login();
  }

  const userDoc = doc(db, "user_courses", user.uid);
  const snapshot = await getDoc(userDoc);

  let coursesData = {
    current: [],
    completed: [],
    favorites: []
  };

  if (snapshot.exists()) {
    coursesData = snapshot.data();
  } else {
    // إنشاء مستند جديد للمستخدم
    await setDoc(userDoc, coursesData);
  }

  renderCourses(coursesData);
}

function renderCourses(data) {
  const tabsMap = { current: "current", completed: "completed", favorites: "favorites" };

  for (const key in tabsMap) {
    const container = document.getElementById(key);
    container.innerHTML = "";
    data[key].forEach(course => {
      const card = document.createElement("div");
      card.className = "course-card";
      card.innerHTML = `
        <img src="${course.image}" alt="${course.title}">
        <div class="course-content">
          <h4 onclick="window.location.href='course.html?id=${course.id}'">${course.title}</h4>
          <span>المدرب: ${course.instructor}</span>
        </div>
        <i class="fa fa-heart favorite-btn ${data.favorites.some(f => f.id === course.id) ? 'favorited' : ''}"></i>
      `;
      // زر المفضلة
      card.querySelector(".favorite-btn").addEventListener("click", async e => {
        const fav = e.target;
        const uid = auth.currentUser.uid;
        if (!fav.classList.contains("favorited")) {
          fav.classList.add("favorited");
          await updateDoc(doc(db, "user_courses", uid), {
            favorites: arrayUnion(course)
          });
        }
      });
      container.appendChild(card);
    });
  }
}

auth.onAuthStateChanged(() => {
  loadCourses();
});
