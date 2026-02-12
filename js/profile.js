import { db } from './firebase-config.js';
import { getAllCountries, phoneDialCodes } from './geo-data.js';
import { doc, getDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const user = JSON.parse(localStorage.getItem("coursehub_user"));
if (!user) window.location.href = "login.html";

const DEFAULT_AVATAR = "/assets/images/admin-avatar.png";
const COMPLETED_KEY = "coursehub_completed_courses";
const NOTIFICATION_KEY = "coursehub_notifications";

const el = (id) => document.getElementById(id);
const profileMsg = el("profileMsg");

function setMsg(text, ok = false) {
  if (!profileMsg) return;
  profileMsg.classList.toggle("success-msg", ok);
  profileMsg.textContent = text;
}

function fillSelectOptions() {
  const countrySelect = el("profileCountry");
  const phoneCodeSelect = el("phoneCode");
  if (countrySelect) {
    countrySelect.innerHTML = getAllCountries()
      .map((country) => `<option value="${country.name}">${country.flag} ${country.name}</option>`)
      .join("");
  }

  if (phoneCodeSelect) {
    phoneCodeSelect.innerHTML = phoneDialCodes
      .map((item) => `<option value="${item.code}">${item.label}</option>`)
      .join("");
  }
}

function getCompletedCoursesCount() {
  try {
    const stored = JSON.parse(localStorage.getItem(COMPLETED_KEY));
    return stored && typeof stored === "object" ? Object.keys(stored).length : 0;
  } catch { return 0; }
}

function getCertificatesCount() {
  try {
    const stored = JSON.parse(localStorage.getItem("coursehub_certificates"));
    return Array.isArray(stored) ? stored.length : 0;
  } catch { return 0; }
}

function getNotifications() {
  try {
    const stored = JSON.parse(localStorage.getItem(NOTIFICATION_KEY));
    return Array.isArray(stored) ? stored : [];
  } catch { return []; }
}

function renderStaticData() {
  if (el("profilePic")) el("profilePic").src = user.picture || DEFAULT_AVATAR;
  if (el("profileName")) el("profileName").textContent = user.name || user.email;
  if (el("profileEmail")) el("profileEmail").textContent = user.email || "";

  if (el("completedCount")) el("completedCount").textContent = getCompletedCoursesCount();
  if (el("certCount")) el("certCount").textContent = getCertificatesCount();

  const notifications = getNotifications();
  if (el("notifCount")) el("notifCount").textContent = notifications.length;

  const activity = el("recentActivity");
  if (activity) {
    activity.innerHTML = "";
    const recent = notifications.slice(0, 3);
    if (!recent.length) {
      activity.innerHTML = "<li>لا توجد أنشطة حديثة بعد.</li>";
    } else {
      recent.forEach((item) => {
        const li = document.createElement("li");
        li.innerHTML = `<strong>${item.title || "تنبيه"}</strong><div>${item.message || ""}</div>`;
        activity.appendChild(li);
      });
    }
  }
}

async function loadProfessionalProfile() {
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return;
    const data = snap.data();

    const fields = [
      "currentPosition", "currentCompany", "university", "degree", "experienceYears",
      "profileCountry", "phoneCode", "phoneNumber", "linkedinUrl", "portfolioUrl",
      "bio", "skills", "experiences", "certifications"
    ];

    fields.forEach((field) => {
      const node = el(field);
      if (node && data[field] !== undefined) node.value = data[field];
    });
  } catch (error) {
    console.error(error);
    setMsg("تعذر تحميل البيانات المهنية.");
  }
}

async function saveProfessionalProfile() {
  const payload = {
    currentPosition: el("currentPosition")?.value?.trim() || "",
    currentCompany: el("currentCompany")?.value?.trim() || "",
    university: el("university")?.value?.trim() || "",
    degree: el("degree")?.value?.trim() || "",
    experienceYears: Number(el("experienceYears")?.value || 0),
    profileCountry: el("profileCountry")?.value || "",
    phoneCode: el("phoneCode")?.value || "",
    phoneNumber: el("phoneNumber")?.value?.trim() || "",
    linkedinUrl: el("linkedinUrl")?.value?.trim() || "",
    portfolioUrl: el("portfolioUrl")?.value?.trim() || "",
    bio: el("bio")?.value?.trim() || "",
    skills: el("skills")?.value?.trim() || "",
    experiences: el("experiences")?.value?.trim() || "",
    certifications: el("certifications")?.value?.trim() || "",
    email: user.email,
    name: user.name,
    picture: user.picture || DEFAULT_AVATAR,
    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(doc(db, "users", user.uid), payload, { merge: true });
    setMsg("تم حفظ الملف المهني بنجاح.", true);
  } catch (error) {
    console.error(error);
    setMsg("حدث خطأ أثناء حفظ الملف.");
  }
}

["saveProfileBtn", "saveProfileTopBtn"].forEach((id) => {
  el(id)?.addEventListener("click", saveProfessionalProfile);
});

el("logoutBtn")?.addEventListener("click", () => {
  localStorage.removeItem("coursehub_user");
  window.location.href = "login.html";
});

fillSelectOptions();
renderStaticData();
loadProfessionalProfile();
