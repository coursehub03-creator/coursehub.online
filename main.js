// Filter by category
function filterCategory(category) {
  const buttons = document.querySelectorAll('.categories button');
  buttons.forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.categories button[data-category="${category}"]`).classList.add('active');

  const cards = document.querySelectorAll('.courses-grid .card');
  cards.forEach(card => {
    if(category === 'all' || card.dataset.category === category){
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
}

// Search function
function searchCourses() {
  const input = document.getElementById('searchInput').value.toLowerCase();
  const cards = document.querySelectorAll('.courses-grid .card');
  cards.forEach(card => {
    const title = card.querySelector('h3').textContent.toLowerCase();
    if(title.includes(input)){
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
}
