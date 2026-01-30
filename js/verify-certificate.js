import { db } from "/js/firebase-config.js";
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const form = document.getElementById("verifyForm");
const input = document.getElementById("certificateCode");
const result = document.getElementById("verifyResult");

const params = new URLSearchParams(window.location.search);
const presetCode = params.get("code");
if (presetCode && input) {
  input.value = presetCode;
  verifyCode(presetCode);
}

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  const code = input.value.trim();
  if (!code) return;
  verifyCode(code);
});

async function verifyCode(code) {
  if (!result) return;
  result.className = "verify-result";
  result.style.display = "none";

  try {
    const q = query(collection(db, "certificates"), where("verificationCode", "==", code));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      result.classList.add("error");
      result.textContent = "لم يتم العثور على شهادة بهذا الرمز.";
      return;
    }

    const cert = snapshot.docs[0].data();
    result.classList.add("success");
    result.textContent = `الشهادة صحيحة: دورة ${cert.courseTitle || cert.courseId}، أُنجزت بتاريخ ${formatDate(cert.completedAt)}.`;
  } catch (error) {
    result.classList.add("error");
    result.textContent = "حدث خطأ أثناء التحقق. حاول مرة أخرى.";
  }
}

function formatDate(dateValue) {
  const date = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ar-EG");
}
