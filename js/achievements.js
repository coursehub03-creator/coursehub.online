// js/achievements.js

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("achievements-list");
  if (!container) return;

  const user = JSON.parse(localStorage.getItem("coursehub_user"));
  if (!user) return;

  // مثال على الإنجازات
  const achievements = JSON.parse(localStorage.getItem("achievements") || "[]")
    .filter(a => a.userEmail === user.email);

  if (achievements.length === 0) {
    container.innerHTML = "<p>لم يتم تحقيق أي إنجاز بعد.</p>";
    return;
  }

  container.innerHTML = achievements.map(a => `
    <div class="achievement">
      <h3>${a.title}</h3>
      <p>${a.description}</p>
    </div>
  `).join("");
});
