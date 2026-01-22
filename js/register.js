// js/register.js - تسجيل المستخدم محلياً مع تحسينات

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

    try {
      // جلب المستخدمين الحاليين من localStorage
      const users = JSON.parse(localStorage.getItem("users") || "[]");

      // تحقق من وجود المستخدم مسبقًا
      if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        alert("المستخدم موجود بالفعل");
        return;
      }

      const newUser = {
        name,
        email,
        password,
        role: "user",
        picture: "assets/images/default-user.png"
      };

      users.push(newUser);
      localStorage.setItem("users", JSON.stringify(users));

      alert("تم إنشاء الحساب بنجاح!");
      window.location.href = "login.html";

    } catch (err) {
      console.error("خطأ أثناء تسجيل المستخدم:", err);
      alert("حدث خطأ أثناء إنشاء الحساب، الرجاء المحاولة لاحقًا");
    }
  });
});
