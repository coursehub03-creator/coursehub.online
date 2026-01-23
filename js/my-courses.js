// --- Firebase Imports ---
import { firebaseAuth } from '../js/firebase-config.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.6.1/firebase-firestore.js";

const db = getFirestore(firebaseAuth.auth.app);

// --- التبديل بين التبويبات ---
const tabs = document.querySelectorAll(".tab-btn");
const contents = document.querySelectorAll(".tab-content");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    contents.forEach(c => c.classList.remove("active"));
    const target = document.getElementById(tab.dataset.tab);
    if (target) target.classList.add("active");
  });
});

// --- جلب الدورات من Firestore وعرضها ---
async function loadCourses() {
  try {
    let user = firebaseAuth.auth.currentUser;

    if (!user) {
      // تسجيل الدخول بحساب Google إذا لم يكن موجود
      const provider = new firebaseAuth.GoogleAuthProvider();
      const result = await firebaseAuth.signInWithPopup(firebaseAuth.auth, provider);
      user = result.user;
    }

    const userDocRef = doc(db, "user_courses", user.uid);
    let snapshot = await getDoc(userDocRef);

    let coursesData = { current: [], completed: [], favorites: [] };

    if (snapshot.exists()) {
      coursesData = snapshot.data();
    } else {
      // إنشاء مستند جديد إذا لم يكن موجودًا
      await setDoc(userDocRef, coursesData);
    }

    renderCourses(coursesData);

  } catch (error) {
    console.error("Error loading courses:", error);
    alert("حدث خطأ أثناء تحميل الدورات. حاول مرة أخرى.");
  }
}

// --- عرض الدورات في التبويبات ---
function renderCourses(data) {
  const tabsMap = { current: "current", completed: "completed", favorites: "favorites" };

  for (const key in tabsMap) {
    const container = document.getElementById(key);
    if (!container) continue;
    container.innerHTML = "";

    if (!data[key] || data[key].length === 0) {
      container.innerHTML = `<p>لا توجد دورات في هذا القسم.</p>`;
      continue;
    }

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

      // --- زر المفضلة ---
      const favBtn = card.querySelector(".favorite-btn");
      if (favBtn) {
        favBtn.addEventListener("click", async (e) => {
          const fav = e.target;
          const uid = firebaseAuth.auth.currentUser.uid;

          if (!fav.classList.contains("favorited")) {
            fav.classList.add("favorited");
            try {
              await updateDoc(doc(db, "user_courses", uid), {
                favorites: arrayUnion(course)
              });
            } catch (err) {
              console.error("Failed to add favorite:", err);
              alert("فشل إضافة الدورة إلى المفضلة.");
            }
          }
        });
      }

      container.appendChild(card);
    });
  }
}

// --- مراقبة حالة تسجيل الدخول ---
firebaseAuth.onAuthStateChanged(firebaseAuth.auth, loadCourses);
