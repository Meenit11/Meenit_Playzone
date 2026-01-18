// public/playzone.js - Main Playzone Logic

function launchGame(gameId) {
  const roomId = generateRoomId();
  
  const gameRoutes = {
    'odd-one-in': '/odd-one-in',
    'undercover': '/undercover',
    'mafia': '/mafia'
  };
  
  if (gameId === 'mafia') {
    alert('🎭 Mafia is coming soon! Stay tuned for updates! 🌙');
    return;
  }
  
  if (gameRoutes[gameId]) {
    window.location.href = `${gameRoutes[gameId]}?room=${roomId}&gm=true`;
  }
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Add hover effects and particles
document.addEventListener('DOMContentLoaded', () => {
  const gameCards = document.querySelectorAll('.game-card');
  
  gameCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      createParticles(card);
    });
  });
  
  // Create confetti particles on hover
  function createParticles(element) {
    const colors = ['#FF6B9D', '#4ECDC4', '#FFE66D', '#667eea'];
    
    for (let i = 0; i < 5; i++) {
      const particle = document.createElement('div');
      particle.style.position = 'absolute';
      particle.style.width = '8px';
      particle.style.height = '8px';
      particle.style.background = colors[Math.floor(Math.random() * colors.length)];
      particle.style.borderRadius = '50%';
      particle.style.pointerEvents = 'none';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.top = Math.random() * 100 + '%';
      particle.style.opacity = '0';
      particle.style.transition = 'all 0.5s';
      
      element.appendChild(particle);
      
      setTimeout(() => {
        particle.style.opacity = '1';
        particle.style.transform = 'translateY(-30px)';
      }, 10);
      
      setTimeout(() => {
        particle.remove();
      }, 600);
    }
  }
  
  // Add smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
});
