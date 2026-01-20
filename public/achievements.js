import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup } 
  from "https://www.gstatic.com/firebasejs/10.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } 
  from "https://www.gstatic.com/firebasejs/10.6.1/firebase-firestore.js";
import { app } from "./firebase-config.js";

const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

function openCertificate(url) {
  window.open(url, "_blank");
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    const result = await signInWithPopup(auth, provider);
    user = result.user;
  }

  const ref = doc(db, "users", user.uid);
  let snap = await getDoc(ref);

  let data;
  if (!snap.exists()) {
    data = { completedCourses: [], certificates: [] };
    await setDoc(ref, data);
  } else {
    data = snap.data();
  }

  document.getElementById("completedCourses").textContent = data.completedCourses.length;
  document.getElementById("certificatesCount").textContent = data.certificates.length;

  const certList = document.getElementById("certificatesList");
  certList.innerHTML = "";

  data.certificates.forEach(cert => {
    const card = document.createElement("div");
    card.className = "certificate-card";

    const btn = document.createElement("button");
    btn.textContent = "عرض الشهادة";
    btn.addEventListener("click", () => openCertificate(cert.certificateUrl));

    card.appendChild(btn);
    certList.appendChild(card);
  });
});
