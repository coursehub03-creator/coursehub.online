const user = JSON.parse(localStorage.getItem("coursehub_user"));

if (!user) {
  window.location.href = "login.html";
}

const profilePic = document.getElementById("profilePic");
const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const completedCount = document.getElementById("completedCount");
const certCount = document.getElementById("certCount");
const notifCount = document.getElementById("notifCount");
const recentActivity = document.getElementById("recentActivity");
const goSettingsBtn = document.getElementById("goSettingsBtn");
const logoutBtn = document.getElementById("logoutBtn");

const COMPLETED_KEY = "coursehub_completed_courses";
const NOTIFICATION_KEY = "coursehub_notifications";

function getCompletedCoursesCount() {
  try {
    const stored = JSON.parse(localStorage.getItem(COMPLETED_KEY));
    return stored && typeof stored === "object" ? Object.keys(stored).length : 0;
  } catch (error) {
    return 0;
  }
}

function getCertificatesCount() {
  try {
    const stored = JSON.parse(localStorage.getItem("coursehub_certificates"));
    return Array.isArray(stored) ? stored.length : 0;
  } catch (error) {
    return 0;
  }
}

function getNotifications() {
  try {
    const stored = JSON.parse(localStorage.getItem(NOTIFICATION_KEY));
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    return [];
  }
}

function renderProfile() {
  if (!user) return;

  if (profilePic) {
    profilePic.src = user.picture || "/assets/images/default-course.png";
  }
  if (profileName) {
    profileName.textContent = user.name || user.email;
  }
  if (profileEmail) {
    profileEmail.textContent = user.email || "";
  }

  if (completedCount) completedCount.textContent = getCompletedCoursesCount();
  if (certCount) certCount.textContent = getCertificatesCount();

  const notifications = getNotifications();
  if (notifCount) notifCount.textContent = notifications.length;

  if (recentActivity) {
    recentActivity.innerHTML = "";
    const recent = notifications.slice(0, 3);
    if (!recent.length) {
      recentActivity.innerHTML = "<li>لا توجد أنشطة حديثة بعد.</li>";
    } else {
      recent.forEach((item) => {
        recentActivity.innerHTML += `
          <li>
            <strong>${item.title || "تنبيه"}</strong>
            <div>${item.message || ""}</div>
          </li>
        `;
      });
    }
  }
}

if (goSettingsBtn) {
  goSettingsBtn.addEventListener("click", () => {
    window.location.href = "/settings.html";
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("coursehub_user");
    window.location.href = "login.html";
  });
}

renderProfile();
