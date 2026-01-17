// js/main.js
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
