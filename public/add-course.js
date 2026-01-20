import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.16.0/firebase-auth.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.16.0/firebase-firestore.js";

// Firebase
const auth = getAuth();
const db = getFirestore();

// ضع UID حسابك هنا فقط (مسؤول الموقع)
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("UID الخاص بك:", user.uid);
    alert("UID الخاص بك: " + user.uid);
  }
});

// تحقق من صلاحية الدخول
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } else if (user.uid !== ADMIN_UID) {
    alert("غير مسموح لك بالدخول لهذه الصفحة");
    window.location.href = "index.html"; // إعادة التوجيه للمستخدم العادي
  }
});

// التعامل مع النموذج
document.getElementById("addCourseForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = document.getElementById("title").value;
  const description = document.getElementById("description").value;
  const image = document.getElementById("image").value;
  const category = document.getElementById("category").value;
  const content = document.getElementById("content").value.split("\n");

  try {
    await addDoc(collection(db, "courses"), {
      title,
      description,
      image,
      category,
      content,
      rating: 0,
      students: 0,
      createdAt: new Date().toISOString()
    });
    alert("تمت إضافة الدورة بنجاح!");
    document.getElementById("addCourseForm").reset();
  } catch (err) {
    console.error(err);
    alert("حدث خطأ أثناء إضافة الدورة");
  }
});
