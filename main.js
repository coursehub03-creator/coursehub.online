// --- Filtering Categories ---
const categoryButtons = document.querySelectorAll('.categories button');
const courseCards = document.querySelectorAll('.courses-grid .card');

categoryButtons.forEach(button => {
    button.addEventListener('click', () => {
        categoryButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        const category = button.dataset.category;

        courseCards.forEach(card => {
            if(category === undefined || category === "all" || card.dataset.category === category){
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    });
});

// --- Search Functionality ---
const searchButton = document.querySelector('.search-bar button');
const searchInput = document.querySelector('.search-bar input');

if(searchButton && searchInput){
    searchButton.addEventListener('click', () => {
        const query = searchInput.value.toLowerCase();
        courseCards.forEach(card => {
            const title = card.querySelector('h3').textContent.toLowerCase();
            if(title.includes(query)){
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    });
}

// --- Form submission (dummy) ---
const forms = document.querySelectorAll('form');
forms.forEach(form => {
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('تم إرسال البيانات (وهمي، بدون backend)');
    });
});
