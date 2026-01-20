import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup } 
  from "https://www.gstatic.com/firebasejs/10.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } 
  from "https://www.gstatic.com/firebasejs/10.6.1/firebase-firestore.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    const result = await signInWithPopup(auth, provider);
    user = result.user;
  }

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  let data;
  if (!snap.exists()) {
    data = { completedCourses: [], certificates: [] };
    await setDoc(userRef, data);
  } else {
    data = snap.data();
  }

  document.getElementById("completedCourses").textContent =
    data.completedCourses?.length || 0;

  document.getElementById("certificatesCount").textContent =
    data.certificates?.length || 0;

  const certList = document.getElementById("certificatesList");
  certList.innerHTML = "";

  if (!data.certificates || data.certificates.length === 0) {
    certList.innerHTML = "<p>لم تحصل على أي شهادة بعد.</p>";
  } else {
    data.certificates.forEach(cert => {
      const div = document.createElement("div");
      div.className = "certificate-card";
      div.innerHTML = `
        <h4>${cert.title}</h4>
        <button>عرض الشهادة</button>
      `;
      div.querySelector("button")
        .addEventListener("click", () => window.open(cert.certificateUrl, "_blank"));
      certList.appendChild(div);
    });
  }
});
