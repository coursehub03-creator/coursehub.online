import { auth, db } from "/js/firebase-config.js";
import { onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

async function generateCertificateDataUrl({
  studentName,
  courseTitle,
  issuedAt,
  verificationCode
}) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 850;

    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    const template = await loadImage("/assets/images/certificate.svg");
    ctx.drawImage(template, 0, 0, canvas.width, canvas.height);

    ctx.textAlign = "center";

    ctx.fillStyle = "#1d4ed8";
    ctx.font = "bold 44px 'Inter', sans-serif";
    ctx.fillText(studentName, canvas.width / 2, 415);

    ctx.fillStyle = "#111827";
    ctx.font = "bold 34px 'Inter', sans-serif";
    ctx.fillText(courseTitle, canvas.width / 2, 525);

    ctx.fillStyle = "#6b7280";
    ctx.font = "20px 'Inter', sans-serif";
    ctx.fillText(issuedAt, 350, 690);
    if (verificationCode) {
      ctx.fillText(verificationCode, 390, 725);
    }

    return canvas.toDataURL("image/png");
  } catch (error) {
    console.error("تعذر تحديث صورة الشهادة:", error);
    return "";
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function syncCertificatesForUser(user, studentName) {
  const issuedFallback = new Date().toLocaleDateString("en-GB");
  const [userCertsSnap, publicCertsSnap] = await Promise.all([
    getDocs(collection(db, "users", user.uid, "certificates")),
    getDocs(query(collection(db, "certificates"), where("userId", "==", user.uid)))
  ]);

  const updateTasks = [];

  userCertsSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const courseTitle = data.title || "";
    const issuedAt = data.issuedAt || issuedFallback;
    const verificationCode = data.verificationCode || "";
    updateTasks.push(
      generateCertificateDataUrl({
        studentName,
        courseTitle,
        issuedAt,
        verificationCode
      }).then((certificateUrl) =>
        setDoc(
          doc(db, "users", user.uid, "certificates", docSnap.id),
          { certificateUrl },
          { merge: true }
        )
      )
    );
  });

  publicCertsSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const courseTitle = data.courseTitle || data.title || "";
    const issuedAt = data.completedAt?.toDate
      ? data.completedAt.toDate().toLocaleDateString("en-GB")
      : issuedFallback;
    const verificationCode = data.verificationCode || "";
    updateTasks.push(
      generateCertificateDataUrl({
        studentName,
        courseTitle,
        issuedAt,
        verificationCode
      }).then((certificateUrl) =>
        setDoc(doc(db, "certificates", docSnap.id), { certificateUrl }, { merge: true })
      )
    );
  });

  await Promise.all(updateTasks);
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

        profileStatus.textContent = "جارٍ تحديث الشهادات الحالية بالاسم الجديد...";
        profileStatus.className = "settings-status";

        await syncCertificatesForUser(user, newName);

        profileStatus.textContent = "تم تحديث الاسم بنجاح وتم تحديث جميع الشهادات الحالية.";
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
      localStorage.setItem("coursehub_theme", preferences.theme);
      document.documentElement.setAttribute("data-theme", preferences.theme);
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
