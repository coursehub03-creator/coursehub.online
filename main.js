// نافذة تسجيل دخول
function showLogin() {
  document.getElementById('loginModal').style.display = 'flex';
}
function closeLogin() {
  document.getElementById('loginModal').style.display = 'none';
}

// تسجيل مستخدم مؤقت
function login() {
  const username = document.getElementById('username').value;
  if(username) {
    localStorage.setItem('username', username);
    alert(`مرحباً ${username}! تم تسجيل الدخول مؤقتاً.`);
    closeLogin();
  } else {
    alert('يرجى إدخال اسمك');
  }
}
