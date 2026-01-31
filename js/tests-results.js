import { auth, db } from "/js/firebase-config.js";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const resultsList = document.getElementById("testsResultsList");
const emptyState = document.getElementById("testsResultsEmpty");
const totalAttempts = document.getElementById("totalAttempts");
const averageScore = document.getElementById("averageScore");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  if (!resultsList || !emptyState) return;

  const q = query(
    collection(db, "quizAttempts"),
    where("userId", "==", user.uid),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);
  const attempts = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

  if (!attempts.length) {
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";

  const avg = Math.round(
    attempts.reduce((sum, item) => sum + (item.percent || 0), 0) / attempts.length
  );

  if (totalAttempts) totalAttempts.textContent = attempts.length;
  if (averageScore) averageScore.textContent = `${avg}%`;

  resultsList.innerHTML = attempts.map((attempt) => `
    <div class="tests-result-card">
      <div>
        <h3>${attempt.courseTitle || "دورة بدون عنوان"}</h3>
        <p>${attempt.lessonTitle || "اختبار شامل"} · ${formatDate(attempt.createdAt)}</p>
      </div>
      <div class="tests-result-score">${attempt.percent ?? 0}%</div>
    </div>
  `).join("");
});

function formatDate(dateValue) {
  const date = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
}
