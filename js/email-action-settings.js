export function getActionCodeSettings() {
  const baseUrl = window.location.origin || "https://coursehub.online";
  return {
    url: `${baseUrl}/login.html`,
    handleCodeInApp: false
  };
}
