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

async function loadCourses() {
  let user = firebaseAuth.auth.currentUser;
  if (!user) {
    user = await firebaseAuth.signInWithPopup(firebaseAuth.auth, new firebaseAuth.GoogleAuthProvider());
  }

  const userDoc = doc(db, "user_courses", user.uid);
  const snapshot = await getDoc(userDoc);

  let coursesData = { current: [], completed: [], favorites: [] };

  if (snapshot.exists()) {
    coursesData = snapshot.data();
  } else {
    await setDoc(userDoc, coursesData);
  }

  renderCourses(coursesData);
}

function renderCourses(data) {
  for (const key of ["current","completed","favorites"]) {
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
      card.querySelector(".favorite-btn").addEventListener("click", async e => {
        const fav = e.target;
        const uid = firebaseAuth.auth.currentUser.uid;
        if (!fav.classList.contains("favorited")) {
          fav.classList.add("favorited");
          await updateDoc(doc(db, "user_courses", uid), { favorites: arrayUnion(course) });
        }
      });
      container.appendChild(card);
    });
  }
}

firebaseAuth.onAuthStateChanged(firebaseAuth.auth, () => {
  loadCourses();
});
