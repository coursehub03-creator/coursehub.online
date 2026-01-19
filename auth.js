function handleCredentialResponse(response) {
  // التوكن الذي يرجعه جوجل
  const jwt = response.credential;

  // فك التوكن (بدون eval)
  const payload = JSON.parse(atob(jwt.split('.')[1]));

  console.log("Google User:", payload);

  alert("مرحبًا " + payload.name);

  // مثال حفظ المستخدم
  localStorage.setItem("user", JSON.stringify(payload));

  // تحويل لصفحة أخرى إن أحببت
  // window.location.href = "dashboard.html";
}
