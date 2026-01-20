// auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.16.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, GoogleAuthProvider, signInWithCredential } from "https://www.gstatic.com/firebasejs/10.16.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.16.0/firebase-firestore.js";

// =====================
// إعداد Firebase
// =====================
const firebaseConfig = {
  apiKey: "AIzaSyCagdZU_eAHebBGCmG5W4FFTcDZIH4wOp0",
  authDomain: "coursehub-23ed2.firebaseapp.com",
  projectId: "coursehub-23ed2",
  storageBucket: "coursehub-23ed2.firebasestorage.app",
  messagingSenderId: "367073521017",
  appId: "1:367073521017:web:67f5fd3be4c6407247d3a8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// =====================
// عناصر الصفحة
// =====================
const form = document.getElementById("loginForm");
const errorMsg = document.getElementById("errorMsg");

// =====================
// تسجيل الدخول بالبريد الإلكتروني وكلمة المرور
// =====================
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const userDoc = await getDoc(doc(db, "users", user.uid));
    if(userDoc.exists()){
      const userData = userDoc.data();
      localStorage.setItem("coursehub_user", JSON.stringify(userData));

      // إعادة التوجيه حسب الدور
      if(userData.role === "admin") window.location.href = "dashboard.html";
      else window.location.href = "courses.html";
    } else {
      errorMsg.textContent = "المستخدم غير موجود في قاعدة البيانات";
    }
  } catch(err){
    errorMsg.textContent = "خطأ في تسجيل الدخول";
    console.error(err);
  }
});

// =====================
// تسجيل الدخول عبر Google
// =====================
window.handleGoogleLogin = async function(response) {
  try {
    const jwt = response.credential;
    const payload = JSON.parse(atob(jwt.split('.')[1]));

    console.log("Google User:", payload);

    // تسجيل دخول Firebase باستخدام Google token
    const credential = GoogleAuthProvider.credential(jwt);
    const userCredential = await signInWithCredential(auth, credential);
    const user = userCredential.user;

    // التحقق إذا كان المستخدم موجودًا في Firestore، وإن لم يكن، إضافته
    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);

    if(!userDoc.exists()){
      // إضافة المستخدم مع الدور الافتراضي "student"
      await setDoc(userRef, {
        name: payload.name,
        email: payload.email,
        picture: payload.picture,
        role: "student" // يمكنك تعديل الدور هنا
      });
    }

    // حفظ بيانات المستخدم في localStorage
    localStorage.setItem("coursehub_user", JSON.stringify({
      name: payload.name,
      email: payload.email,
      picture: payload.picture,
      role: userDoc.exists() ? userDoc.data().role : "student"
    }));

    // إعادة التوجيه
    const role = userDoc.exists() ? userDoc.data().role : "student";
    if(role === "admin") window.location.href = "dashboard.html";
    else window.location.href = "courses.html";

  } catch (err) {
    console.error("خطأ في تسجيل الدخول عبر Google:", err);
    alert("حدث خطأ أثناء تسجيل الدخول عبر Google");
  }
};
