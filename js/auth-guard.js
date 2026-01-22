export function requireAdmin() {
  const user = JSON.parse(localStorage.getItem("coursehub_user"));

  if (!user || user.role !== "admin") {
    alert("غير مصرح لك بالدخول");
    location.href = "../login.html";
  }
}
