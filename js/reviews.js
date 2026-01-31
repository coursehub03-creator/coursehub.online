import { auth, db } from "/js/firebase-config.js";
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const reviewsList = document.getElementById("reviewsList");
const reviewsEmpty = document.getElementById("reviewsEmpty");
const reviewsAverage = document.getElementById("reviewsAverage");
const reviewsCount = document.getElementById("reviewsCount");
const reviewForm = document.getElementById("reviewForm");
const ratingInput = document.getElementById("reviewRating");
const commentInput = document.getElementById("reviewComment");

const params = new URLSearchParams(window.location.search);
const courseId = params.get("id");

let currentUser = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
});

async function loadReviews() {
  if (!courseId || !reviewsList) return;

  const q = query(
    collection(db, "courseReviews"),
    where("courseId", "==", courseId),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  const reviews = snapshot.docs.map((docSnap) => docSnap.data());

  if (!reviews.length) {
    if (reviewsEmpty) reviewsEmpty.style.display = "block";
    if (reviewsAverage) reviewsAverage.textContent = "0.0";
    if (reviewsCount) reviewsCount.textContent = "0";
    return;
  }

  if (reviewsEmpty) reviewsEmpty.style.display = "none";
  const avg =
    reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length;
  if (reviewsAverage) reviewsAverage.textContent = avg.toFixed(1);
  if (reviewsCount) reviewsCount.textContent = reviews.length;

  reviewsList.innerHTML = reviews.map((review) => `
    <div class="review-card">
      <strong>${review.userName || "طالب CourseHub"}</strong>
      <span> · ${review.rating} / 5</span>
      <p>${review.comment || "بدون تعليق"}</p>
    </div>
  `).join("");
}

reviewForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!courseId) return;

  if (!currentUser) {
    window.location.href = "/login.html";
    return;
  }

  const rating = Number(ratingInput.value);
  if (!rating) return;

  await addDoc(collection(db, "courseReviews"), {
    courseId,
    userId: currentUser.uid,
    userName: currentUser.displayName || "طالب CourseHub",
    rating,
    comment: commentInput.value.trim(),
    createdAt: serverTimestamp()
  });

  ratingInput.value = "";
  commentInput.value = "";
  loadReviews();
});

loadReviews();
