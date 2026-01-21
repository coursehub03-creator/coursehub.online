  /* ===== Load Header/Footer ===== */
    function loadCSS(href){
      if(!document.querySelector(`link[href="${href}"]`)){
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
      }
    }

    async function loadHeaderFooter(){
      try{
        const headerRes = await fetch("../partials/header.html");
        const headerHTML = await headerRes.text();
        document.body.insertAdjacentHTML("afterbegin", headerHTML);
        loadCSS("header.css");
      }catch(err){ console.error(err); }

      try{
        const footerRes = await fetch("../partials/footer.html");
        const footerHTML = await footerRes.text();
        document.body.insertAdjacentHTML("beforeend", footerHTML);
        loadCSS("footer.css");
      }catch(err){ console.error(err); }

      setupUserState();
      setupHeaderSearch();
      setupLanguageToggle();
    }

    function setupUserState(){
      const user = JSON.parse(localStorage.getItem("coursehub_user"));
      const userContainer = document.getElementById("user-info");
      const loginLink = document.getElementById("login-link");
      const adminLink = document.getElementById("admin-link");
      const adminEmails = ["kaleadsalous30@gmail.com","coursehub03@gmail.com"];

      if(user){
        if(loginLink) loginLink.style.display = "none";

        if(adminLink){
          if(user.role === "admin" || adminEmails.includes(user.email)){
            adminLink.innerHTML = `<a href="/admin/dashboard.html">لوحة التحكم</a>`;
          } else adminLink.innerHTML = "";
        }

        if(userContainer){
          userContainer.style.display = "flex";
          userContainer.innerHTML = `
            <img src="${user.picture}" alt="${user.name}" class="user-pic">
            <span class="user-name">${user.name}</span>
            <div class="dropdown-menu">
              <a href="../profile.html">الملف الشخصي</a>
              <a href="../achievements.html">إنجازاتي</a>
              <a href="../my-courses.html">دوراتي</a>
              <a href="../settings.html">الإعدادات</a>
              <a href="#" id="logout-link">تسجيل الخروج</a>
            </div>
          `;

          const dropdown = userContainer.querySelector(".dropdown-menu");
          const toggleDropdown = e => { e.stopPropagation(); dropdown.style.display = dropdown.style.display === "block" ? "none" : "block"; };
          userContainer.querySelector(".user-pic").addEventListener("click", toggleDropdown);
          userContainer.querySelector(".user-name").addEventListener("click", toggleDropdown);
          document.addEventListener("click", ()=>{ dropdown.style.display="none"; });
          dropdown.addEventListener("click", e=>e.stopPropagation());

          const logoutLink = document.getElementById("logout-link");
          if(logoutLink){
            logoutLink.addEventListener("click", e=>{
              e.preventDefault();
              localStorage.removeItem("coursehub_user");
              if(loginLink) loginLink.style.display="block";
              userContainer.style.display="none";
              if(adminLink) adminLink.innerHTML="";
              window.location.href="login.html";
            });
          }
        }
      } else {
        if(loginLink) loginLink.style.display="block";
        if(userContainer) userContainer.style.display="none";
        if(adminLink) adminLink.innerHTML="";
      }
    }

    function setupHeaderSearch(){
      const path = window.location.pathname.split("/").pop();
      const searchBar = document.getElementById("headerSearchBar");
      if(!searchBar) return;
      if(path==="" || path==="index.html" || path==="courses.html"){
        searchBar.style.display="flex";
        const searchBtn = document.getElementById("searchBtn");
        if(searchBtn) searchBtn.addEventListener("click", ()=>{
          const query = document.getElementById("searchInput").value.trim();
          if(query) alert(`بحث عن: ${query}`);
        });
      } else searchBar.style.display="none";
    }

    function setupLanguageToggle(){
      const langBtn = document.getElementById("langBtn");
      if(!langBtn) return;
      langBtn.addEventListener("click", e=>{
        e.stopPropagation();
        const text = langBtn.textContent.trim();
        if(text.includes("عربي")) langBtn.innerHTML='<i class="fa fa-globe"></i> English';
        else if(text.includes("English")) langBtn.innerHTML='<i class="fa fa-globe"></i> Français';
        else langBtn.innerHTML='<i class="fa fa-globe"></i> عربي';
      });
    }

    document.addEventListener("DOMContentLoaded", loadHeaderFooter);
  </script>
</body>
</html>
