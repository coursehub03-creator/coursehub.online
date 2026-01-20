import { firebaseAuth } from './firebase-config.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.6.1/firebase-firestore.js";

const db = getFirestore(firebaseAuth.auth.app);

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

// جلب الدورات من Firestore وعرضها
async function loadCourses() {
  let user = firebaseAuth.auth.currentUser;
  if (!user) {
    const provider = new firebaseAuth.GoogleAuthProvider();
    const result = await firebaseAuth.signInWithPopup(firebaseAuth.auth, provider);
    user = result.user;
  }

  const userDocRef = doc(db, "user_courses", user.uid);
  let snapshot = await getDoc(userDocRef);

  let coursesData = { current: [], completed: [], favorites: [] };
  if (snapshot.exists()) coursesData = snapshot.data();
  else await setDoc(userDocRef, coursesData);

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
        const uid = firebaseAuth.auth.currentUser.uid;
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

firebaseAuth.onAuthStateChanged(firebaseAuth.auth, loadCourses);
