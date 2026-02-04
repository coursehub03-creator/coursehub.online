import { auth, db } from "/js/firebase-config.js";
import { onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const settingsContent = document.getElementById("settings-content");

const DEFAULT_PREFERENCES = {
  notifyCourses: true,
  notifyCertificates: true,
  notifyEmail: false,
  theme: "light"
};

function getStoredPreferences() {
  try {
    const stored = JSON.parse(localStorage.getItem("coursehub_preferences"));
    return { ...DEFAULT_PREFERENCES, ...(stored || {}) };
  } catch (error) {
    return { ...DEFAULT_PREFERENCES };
  }
}

function saveStoredPreferences(preferences) {
  localStorage.setItem("coursehub_preferences", JSON.stringify(preferences));
}

function renderSettings(user) {
  const preferences = getStoredPreferences();
  const displayName = user?.displayName || user?.email?.split("@")[0] || "";
  const email = user?.email || "";
  const avatarLetter = displayName ? displayName.charAt(0).toUpperCase() : "C";
  const storedLang = localStorage.getItem("coursehub_lang") || "ar";

  settingsContent.innerHTML = `
    <section class="settings-hero">
      <div>
        <span class="settings-badge">الإعدادات</span>
        <h1>تحكم بحسابك بسهولة</h1>
        <p>حدّث بياناتك الشخصية، واضبط تفضيلات الإشعارات والمظهر بسرعة.</p>
      </div>
      <div class="settings-hero-card">
        <div class="settings-avatar">${avatarLetter}</div>
        <div>
          <h3>${displayName}</h3>
          <span>${email}</span>
        </div>
      </div>
    </section>

    <section class="settings-grid">
      <div class="settings-card">
        <div class="settings-card-header">
          <h2>الملف الشخصي</h2>
          <span>معلومات الحساب الأساسية</span>
        </div>
        <form class="settings-form" id="profileForm">
          <label>الاسم الكامل
            <input type="text" id="displayNameInput" value="${displayName}" required />
          </label>
          <label>البريد الإلكتروني
            <input type="email" value="${email}" disabled />
          </label>
          <div class="settings-actions">
            <button type="submit" class="btn-primary">حفظ التغييرات</button>
            <button type="button" class="btn-secondary" id="resetProfileBtn">إعادة تعيين</button>
          </div>
          <div class="settings-status" id="profileStatus">قم بتحديث اسمك وسيظهر فورًا في الشهادة.</div>
        </form>
      </div>

      <div class="settings-card">
        <div class="settings-card-header">
          <h2>الإشعارات</h2>
          <span>تحكم بطريقة استلام التنبيهات</span>
        </div>
        <div class="settings-switches">
          <label class="switch-row">
            <span>تنبيهات الدورات الجديدة</span>
            <input type="checkbox" id="notifyCourses" ${preferences.notifyCourses ? "checked" : ""} />
          </label>
          <label class="switch-row">
            <span>تنبيهات الإنجازات والشهادات</span>
            <input type="checkbox" id="notifyCertificates" ${preferences.notifyCertificates ? "checked" : ""} />
          </label>
          <label class="switch-row">
            <span>تنبيهات البريد الإلكتروني</span>
            <input type="checkbox" id="notifyEmail" ${preferences.notifyEmail ? "checked" : ""} />
          </label>
        </div>
      </div>

      <div class="settings-card">
        <div class="settings-card-header">
          <h2>تفضيلات العرض</h2>
          <span>لغة الواجهة والمظهر</span>
        </div>
        <div class="settings-form">
          <label>لغة الواجهة
            <select id="languageSelect">
              <option value="ar" ${storedLang === "ar" ? "selected" : ""}>العربية</option>
              <option value="en" ${storedLang === "en" ? "selected" : ""}>English</option>
            </select>
          </label>
          <label>المظهر
            <select id="themeSelect">
              <option value="light" ${preferences.theme === "light" ? "selected" : ""}>فاتح</option>
              <option value="dark" ${preferences.theme === "dark" ? "selected" : ""}>داكن</option>
            </select>
          </label>
        </div>
      </div>

      <div class="settings-card">
        <div class="settings-card-header">
          <h2>الأمان</h2>
          <span>إعدادات الجلسات وكلمة المرور</span>
        </div>
        <div class="settings-actions">
          <button type="button" class="btn-secondary">تغيير كلمة المرور</button>
          <button type="button" class="btn-ghost">تسجيل الخروج من كل الأجهزة</button>
        </div>
      </div>
    </section>
  `;

  bindSettingsEvents(user, displayName);
}

function bindSettingsEvents(user, initialName) {
  const profileForm = document.getElementById("profileForm");
  const resetProfileBtn = document.getElementById("resetProfileBtn");
  const profileStatus = document.getElementById("profileStatus");
  const displayNameInput = document.getElementById("displayNameInput");

  if (resetProfileBtn) {
    resetProfileBtn.addEventListener("click", () => {
      displayNameInput.value = initialName;
      profileStatus.textContent = "تمت إعادة ضبط الاسم.";
      profileStatus.className = "settings-status";
    });
  }

  if (profileForm) {
    profileForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const newName = displayNameInput.value.trim();
      if (!newName) return;

      try {
        if (auth.currentUser) {
          await updateProfile(auth.currentUser, { displayName: newName });
        }

        await setDoc(
          doc(db, "users", user.uid),
          {
            name: newName,
            email: user.email,
            updatedAt: new Date()
          },
          { merge: true }
        );

        const storedUser = JSON.parse(localStorage.getItem("coursehub_user")) || {};
        storedUser.name = newName;
        localStorage.setItem("coursehub_user", JSON.stringify(storedUser));

        const headerName = document.querySelector(".user-name");
        if (headerName) headerName.textContent = newName;

        const avatar = document.querySelector(".settings-avatar");
        if (avatar) avatar.textContent = newName.charAt(0).toUpperCase();

        profileStatus.textContent = "تم تحديث الاسم بنجاح وسيظهر في الشهادة الجديدة.";
        profileStatus.className = "settings-status success";
      } catch (error) {
        console.error("تعذر تحديث الملف الشخصي:", error);
        profileStatus.textContent = "حدث خطأ أثناء حفظ التغييرات. حاول مرة أخرى.";
        profileStatus.className = "settings-status error";
      }
    });
  }

  const preferenceInputs = ["notifyCourses", "notifyCertificates", "notifyEmail", "themeSelect"];
  preferenceInputs.forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener("change", () => {
      const preferences = getStoredPreferences();
      preferences.notifyCourses = document.getElementById("notifyCourses").checked;
      preferences.notifyCertificates = document.getElementById("notifyCertificates").checked;
      preferences.notifyEmail = document.getElementById("notifyEmail").checked;
      preferences.theme = document.getElementById("themeSelect").value;
      saveStoredPreferences(preferences);
    });
  });

  const languageSelect = document.getElementById("languageSelect");
  if (languageSelect) {
    languageSelect.addEventListener("change", () => {
      localStorage.setItem("coursehub_lang", languageSelect.value);
      window.location.reload();
    });
  }
}

onAuthStateChanged(auth, (user) => {
  if (!settingsContent) return;
  if (!user) {
    settingsContent.innerHTML = "<p>يرجى تسجيل الدخول للوصول إلى الإعدادات.</p>";
    return;
  }
  renderSettings(user);
});
