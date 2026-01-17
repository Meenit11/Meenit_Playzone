// public/playground.js - Main Playground Logic

function launchGame(gameId) {
  if (gameId === 'odd-one-in') {
    // Generate room ID and redirect to game
    const roomId = generateRoomId();
    window.location.href = `/odd-one-in?room=${roomId}&gm=true`;
  }
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Add some interactivity
document.addEventListener('DOMContentLoaded', () => {
  const gameCards = document.querySelectorAll('.game-card:not(.coming-soon)');
  
  gameCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.style.background = 'rgba(255, 255, 255, 0.15)';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.background = 'rgba(255, 255, 255, 0.1)';
    });
  });
});
