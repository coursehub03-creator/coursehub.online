function handleGoogleLogin(response) {
  const jwt = response.credential;

  const payload = JSON.parse(atob(jwt.split('.')[1]));

  console.log("Google User:", payload);

  localStorage.setItem("coursehub_user", JSON.stringify({
    name: payload.name,
    email: payload.email,
    picture: payload.picture
  }));

  window.location.href = "index.html";
}
