// admin-guard.js
export function requireAdmin() {
  try {
    const userStr = localStorage.getItem("coursehub_user");
    if (!userStr) throw new Error("لا يوجد مستخدم مسجّل الدخول");

    const user = JSON.parse(userStr);

    if (!user || user.role !== "admin") {
      alert("غير مصرح لك بالدخول");
      location.href = "../login.html";
      return false;
    }

    return true;
  } catch (err) {
    console.error("Error in requireAdmin:", err);
    alert("حدث خطأ أثناء التحقق من صلاحيات المستخدم. سيتم إعادة توجيهك لتسجيل الدخول.");
    location.href = "../login.html";
    return false;
  }
}
