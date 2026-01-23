import { initializeApp } from "https://www.gstatic.com/firebasejs/10.16.0/firebase-app.js";
import {
  getFirestore, collection, addDoc
} from "https://www.gstatic.com/firebasejs/10.16.0/firebase-firestore.js";
import {
  getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/10.16.0/firebase-auth.js";

// -----------------------------
// إعداد Firebase
// -----------------------------
const firebaseConfig = {
 apiKey: "AIzaSyDTW6hv7_PqPUb8NytYXVkkrVwwE9ACY0I",
  authDomain: "coursehub-23ed2.firebaseapp.com",
  projectId: "coursehub-23ed2",
  storageBucket: "coursehub-23ed2.firebasestorage.app",
  messagingSenderId: "367073521017",
  appId: "1:367073521017:web:67f5fd3be4c6407247d3a8",
  measurementId: "G-NJ6E39V9NW"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();

// -----------------------------
// قائمة المسؤولين (البريد الإلكتروني)
// -----------------------------
const ADMIN_EMAILS = ["kaleadsalous30@gmail.com", "boss@example.com"];

// -----------------------------
// التحقق من المستخدم
// -----------------------------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    user = result.user;
  }

  if (!ADMIN_EMAILS.includes(user.email)) {
    alert("غير مسموح لك بالدخول لهذه الصفحة!");
    window.location.href = "index.html";
  }
});

// -----------------------------
// حفظ الدورة
// -----------------------------
const form = document.getElementById("addCourseForm");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = document.getElementById("title").value.trim();
  const instructor = document.getElementById("instructor").value.trim();
  const category = document.getElementById("category").value;
  const image = document.getElementById("image").value.trim();
  const description = document.getElementById("description").value.trim();

  if (!title || !instructor || !category || !image || !description) {
    alert("يرجى تعبئة جميع الحقول!");
    return;
  }

  try {
    await addDoc(collection(db, "courses"), {
      title,
      instructor,
      category,
      image,
      description,
      createdAt: new Date().toISOString()
    });

    alert("تم إضافة الدورة بنجاح!");
    form.reset();
  } catch (error) {
    console.error(error);
    alert("حدث خطأ أثناء إضافة الدورة.");
  }
});
