// admin-guard.js
import { auth } from "./firebase-config.js";
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const ADMIN_EMAILS = ["kaleadsalous30@gmail.com", "coursehub03@gmail.com"];

export async function protectAdmin() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        user = result.user;
      }

      if (!ADMIN_EMAILS.includes(user.email)) {
        alert("ليس لديك صلاحية الدخول إلى هذه الصفحة.");
        window.location.href = "/login.html";
      } else {
        resolve(user); // المستخدم أدمن
      }
    });
  });
}
