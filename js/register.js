// js/register.js

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("register-form");
  if (!form) return;

  form.addEventListener("submit", e => {
    e.preventDefault();
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value.trim();

    if (!name || !email || !password) {
      alert("الرجاء ملء جميع الحقول");
      return;
    }

    // تحقق إذا المستخدم موجود مسبقًا
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    if (users.find(u => u.email === email)) {
      alert("المستخدم موجود بالفعل");
      return;
    }

    const newUser = { name, email, password, role: "user", picture: "assets/images/default-user.png" };
    users.push(newUser);
    localStorage.setItem("users", JSON.stringify(users));
    alert("تم إنشاء الحساب بنجاح!");
    window.location.href = "login.html";
  });
});
