import { auth, db } from "/js/firebase-config.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const tabs = document.querySelectorAll(".tab-btn");
const contents = document.querySelectorAll(".tab-content");

tabs.forEach(tab => {
  tab.onclick = () => {
    tabs.forEach(t => t.classList.remove("active"));
    contents.forEach(c => c.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab)?.classList.add("active");
  };
});

auth.onAuthStateChanged(user => {
  if (user) loadMyCourses(user.uid);
});

async function loadMyCourses(uid) {
  const ref = doc(db, "user_courses", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, { current: [], completed: [], favorites: [] });
    return;
  }

  render(snap.data());
}

function render(data) {
  ["current", "completed", "favorites"].forEach(type => {
    const container = document.getElementById(type);
    if (!container) return;

    container.innerHTML = "";

    if (!data[type].length) {
      container.innerHTML = "<p>لا توجد دورات</p>";
      return;
    }

    data[type].forEach(course => {
      const card = document.createElement("div");
      card.className = "course-card";
      card.innerHTML = `
        <img src="${course.image}">
        <h4 onclick="location.href='course-detail.html?id=${course.id}'">
          ${course.title}
        </h4>
      `;
      container.appendChild(card);
    });
  });
}
