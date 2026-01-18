// Odd One In - Game Logic
const socket = io();

// Add connection logging
socket.on('connect', () => {
  console.log('✅ Socket connected:', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('❌ Socket connection error:', error);
});

socket.on('disconnect', () => {
  console.log('❌ Socket disconnected');
});

// Game State
let gameState = {
  roomId: null,
  playerName: null,
  isGM: false,
  currentScreen: 'name',
  isEliminated: false
};

// DOM Elements
const screens = {
  name: document.getElementById('nameScreen'),
  lobby: document.getElementById('lobbyScreen'),
  question: document.getElementById('questionScreen'),
  review: document.getElementById('reviewScreen'),
  winner: document.getElementById('winnerScreen'),
  eliminated: document.getElementById('eliminatedScreen')
};

// Name Screen Elements
const playerNameInput = document.getElementById('playerNameInput');
const createJoinBtn = document.getElementById('createJoinBtn');
const btnText = document.getElementById('btnText');

// Lobby Elements
const playersList = document.getElementById('playersList');
const gmControls = document.getElementById('gmControls');
const playerWaiting = document.getElementById('playerWaiting');
const inviteLink = document.getElementById('inviteLink');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const startGameBtn = document.getElementById('startGameBtn');
const backHomeBtn = document.getElementById('backHomeBtn');

// Question Elements
const timerDisplay = document.getElementById('timerDisplay');
const questionText = document.getElementById('questionText');
const answerInput = document.getElementById('answerInput');
const submitAnswerBtn = document.getElementById('submitAnswerBtn');
const answerStatus = document.getElementById('answerStatus');
const gmGameControls = document.getElementById('gmGameControls');
const submissionCounter = document.getElementById('submissionCounter');
const submissionCount = document.getElementById('submissionCount');

// GM Controls
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const skipBtn = document.getElementById('skipBtn');
const editBtn = document.getElementById('editBtn');
const showAnswersBtn = document.getElementById('showAnswersBtn');
const restartBtn = document.getElementById('restartBtn');

// Review Elements
const answersGrid = document.getElementById('answersGrid');
const gmReviewControls = document.getElementById('gmReviewControls');
const playerReviewWait = document.getElementById('playerReviewWait');
const nextQuestionBtn = document.getElementById('nextQuestionBtn');

// Winner Elements
const winnerName = document.getElementById('winnerName');
const gmWinnerControls = document.getElementById('gmWinnerControls');
const playerWinnerWait = document.getElementById('playerWinnerWait');
const playAgainBtn = document.getElementById('playAgainBtn');
const homeBtn = document.getElementById('homeBtn');

// Edit Modal
const editModal = document.getElementById('editModal');
const editQuestionInput = document.getElementById('editQuestionInput');
const confirmEditBtn = document.getElementById('confirmEditBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

// ========== INITIALIZATION ==========
function init() {
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  const gmParam = urlParams.get('gm');

  console.log('Init - Room:', roomParam, 'GM:', gmParam); // Debug log

  if (gmParam === 'true') {
    gameState.isGM = true;
    btnText.textContent = 'CREATE GAME';
    console.log('Mode: Game Master'); // Debug log
  } else if (roomParam) {
    gameState.roomId = roomParam;
    btnText.textContent = 'JOIN GAME';
    console.log('Mode: Player joining room', roomParam); // Debug log
  } else {
    btnText.textContent = 'JOIN GAME';
    console.log('Mode: Default player'); // Debug log
  }

  setupEventListeners();
}

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
  // Name Screen
  createJoinBtn.addEventListener('click', handleCreateJoin);
  playerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleCreateJoin();
  });

  // Lobby
  copyLinkBtn.addEventListener('click', copyInviteLink);
  startGameBtn.addEventListener('click', startGame);
  backHomeBtn.addEventListener('click', () => window.location.href = '/');

  // Question
  submitAnswerBtn.addEventListener('click', submitAnswer);
  answerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submitAnswer();
  });

  // GM Controls
  pauseBtn.addEventListener('click', () => socket.emit('pauseTimer', { roomId: gameState.roomId }));
  resumeBtn.addEventListener('click', () => socket.emit('resumeTimer', { roomId: gameState.roomId }));
  skipBtn.addEventListener('click', () => socket.emit('skipQuestion', { roomId: gameState.roomId }));
  editBtn.addEventListener('click', openEditModal);
  showAnswersBtn.addEventListener('click', () => socket.emit('showAnswers', { roomId: gameState.roomId }));
  restartBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to restart the game?')) {
      socket.emit('restartGame', { roomId: gameState.roomId });
    }
  });

  // Review
  nextQuestionBtn.addEventListener('click', () => socket.emit('nextQuestion', { roomId: gameState.roomId }));

  // Winner
  playAgainBtn.addEventListener('click', () => socket.emit('restartGame', { roomId: gameState.roomId }));
  homeBtn.addEventListener('click', () => window.location.href = '/');

  // Edit Modal
  confirmEditBtn.addEventListener('click', confirmEdit);
  cancelEditBtn.addEventListener('click', closeEditModal);
}

// ========== SOCKET EVENT HANDLERS ==========

// Room Created
socket.on('roomCreated', ({ roomId, inviteLink: link }) => {
  console.log('✅ Room created:', roomId); // Debug
  gameState.roomId = roomId;
  inviteLink.value = link;
  switchScreen('lobby');
  showGMControls();
  console.log('Switched to lobby, GM controls shown'); // Debug
});

// Joined Room
socket.on('joinedRoom', ({ roomId, isGM }) => {
  gameState.roomId = roomId;
  gameState.isGM = isGM;
  switchScreen('lobby');
  
  if (isGM) {
    showGMControls();
  } else {
    showPlayerWaiting();
  }
});

// Update Players
socket.on('updatePlayers', (players) => {
  renderPlayersList(players);
});

// Game Started
socket.on('gameStarted', ({ question, timeRemaining }) => {
  console.log('✅ Game started event received'); // Debug
  console.log('Question:', question); // Debug
  console.log('Time:', timeRemaining); // Debug
  
  switchScreen('question');
  questionText.textContent = question;
  timerDisplay.textContent = timeRemaining;
  resetAnswerSection();
  
  if (gameState.isGM) {
    gmGameControls.classList.remove('hidden');
    submissionCounter.classList.remove('hidden');
    pauseBtn.classList.remove('hidden');
    resumeBtn.classList.add('hidden');
  }
  
  console.log('Switched to question screen'); // Debug
});

// Timer Update
socket.on('timerUpdate', ({ timeRemaining }) => {
  timerDisplay.textContent = timeRemaining;
  
  // Visual warning at 3 seconds
  if (timeRemaining <= 3) {
    timerDisplay.parentElement.style.background = 'linear-gradient(135deg, #e74c3c, #c0392b)';
  } else {
    timerDisplay.parentElement.style.background = 'linear-gradient(135deg, #FFB347, #FF9F43)';
  }
});

// Timer Paused
socket.on('timerPaused', ({ timeRemaining }) => {
  pauseBtn.classList.add('hidden');
  resumeBtn.classList.remove('hidden');
  showNotification('Timer Paused', 'info');
});

// Timer Resumed
socket.on('timerResumed', ({ timeRemaining }) => {
  pauseBtn.classList.remove('hidden');
  resumeBtn.classList.add('hidden');
  showNotification('Timer Resumed', 'success');
});

// Answer Submitted
socket.on('answerSubmitted', () => {
  answerInput.disabled = true;
  submitAnswerBtn.disabled = true;
  answerStatus.textContent = '✓ Answer Submitted!';
  answerStatus.classList.remove('hidden');
  answerStatus.classList.add('success');
});

// Submission Update (GM only)
socket.on('submissionUpdate', ({ submitted, total }) => {
  submissionCount.textContent = `${submitted}/${total}`;
});

// Answers Revealed
socket.on('answersRevealed', ({ answers }) => {
  switchScreen('review');
  renderAnswers(answers);
  
  if (gameState.isGM) {
    gmReviewControls.classList.remove('hidden');
    playerReviewWait.classList.add('hidden');
  } else {
    gmReviewControls.classList.add('hidden');
    playerReviewWait.classList.remove('hidden');
  }
});

// Question Edited
socket.on('questionEdited', ({ question, timeRemaining }) => {
  questionText.textContent = question;
  timerDisplay.textContent = timeRemaining;
  resetAnswerSection();
  showNotification('Question Updated!', 'info');
  closeEditModal();
});

// Next Question
socket.on('nextQuestion', ({ question, timeRemaining }) => {
  switchScreen('question');
  questionText.textContent = question;
  timerDisplay.textContent = timeRemaining;
  resetAnswerSection();
  
  if (gameState.isEliminated) {
    switchScreen('eliminated');
  }
});

// Players Eliminated
socket.on('playersEliminated', ({ eliminatedIds, players }) => {
  if (eliminatedIds.includes(socket.id)) {
    gameState.isEliminated = true;
    switchScreen('eliminated');
  }
  
  renderPlayersList(players);
  showNotification(`${eliminatedIds.length} player(s) eliminated`, 'warning');
});

// Game Ended
socket.on('gameEnded', ({ winner }) => {
  switchScreen('winner');
  winnerName.textContent = winner.name;
  
  if (gameState.isGM) {
    gmWinnerControls.classList.remove('hidden');
    playerWinnerWait.classList.add('hidden');
  } else {
    gmWinnerControls.classList.add('hidden');
    playerWinnerWait.classList.remove('hidden');
  }
  
  createConfetti();
});

// Game Restarted
socket.on('gameRestarted', () => {
  gameState.isEliminated = false;
  switchScreen('lobby');
  
  if (gameState.isGM) {
    showGMControls();
  } else {
    showPlayerWaiting();
  }
});

// GM Left
socket.on('gmLeft', () => {
  alert('Game Master has left the game. Returning to home...');
  window.location.href = '/';
});

// Kicked
socket.on('kicked', () => {
  alert('You have been removed from the game.');
  window.location.href = '/';
});

// Error
socket.on('error', ({ message }) => {
  alert(message);
});

// ========== GAME FUNCTIONS ==========

function handleCreateJoin() {
  console.log('Button clicked!'); // Debug log
  
  const name = playerNameInput.value.trim();
  
  console.log('Player name:', name); // Debug log
  
  if (!name) {
    alert('Please enter your name');
    return;
  }
  
  if (name.length > 20) {
    alert('Name must be 20 characters or less');
    return;
  }
  
  gameState.playerName = name;
  
  if (gameState.isGM) {
    console.log('Creating room as GM'); // Debug log
    const roomId = generateRoomId();
    console.log('Generated room ID:', roomId); // Debug log
    socket.emit('createRoom', { 
      roomId, 
      playerName: name, 
      game: 'odd-one-in' 
    });
  } else {
    console.log('Joining room as player'); // Debug log
    console.log('Room ID:', gameState.roomId); // Debug log
    socket.emit('joinRoom', { 
      roomId: gameState.roomId, 
      playerName: name 
    });
  }
}

function startGame() {
  console.log('Start Game clicked!'); // Debug
  console.log('Room ID:', gameState.roomId); // Debug
  console.log('Is GM:', gameState.isGM); // Debug
  
  if (!gameState.roomId) {
    alert('Error: Room ID not found');
    return;
  }
  
  socket.emit('startGame', { roomId: gameState.roomId });
}

function submitAnswer() {
  const answer = answerInput.value.trim();
  
  if (!answer) {
    alert('Please enter an answer');
    return;
  }
  
  socket.emit('submitAnswer', { 
    roomId: gameState.roomId, 
    answer 
  });
}

function openEditModal() {
  editQuestionInput.value = questionText.textContent;
  editModal.classList.remove('hidden');
}

function closeEditModal() {
  editModal.classList.add('hidden');
}

function confirmEdit() {
  const newQuestion = editQuestionInput.value.trim();
  
  if (!newQuestion) {
    alert('Please enter a question');
    return;
  }
  
  socket.emit('editQuestion', { 
    roomId: gameState.roomId, 
    newQuestion 
  });
}

// ========== RENDER FUNCTIONS ==========

function renderPlayersList(players) {
  playersList.innerHTML = '';
  
  players.forEach(player => {
    const playerItem = document.createElement('div');
    playerItem.className = 'player-item';
    
    const nameSection = document.createElement('div');
    nameSection.style.display = 'flex';
    nameSection.style.alignItems = 'center';
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'player-name';
    nameSpan.textContent = player.name;
    nameSection.appendChild(nameSpan);
    
    if (player.isGM) {
      const badge = document.createElement('span');
      badge.className = 'player-badge';
      badge.textContent = '👑 Game Master';
      nameSection.appendChild(badge);
    }
    
    if (player.eliminated) {
      const elimBadge = document.createElement('span');
      elimBadge.className = 'eliminated-badge';
      elimBadge.textContent = '❌ OUT';
      elimBadge.style.marginLeft = '10px';
      nameSection.appendChild(elimBadge);
    }
    
    playerItem.appendChild(nameSection);
    
    // Remove button for GM
    if (gameState.isGM && !player.isGM) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.textContent = '❌';
      removeBtn.onclick = () => removePlayer(player.id);
      playerItem.appendChild(removeBtn);
    }
    
    playersList.appendChild(playerItem);
  });
}

function renderAnswers(answers) {
  answersGrid.innerHTML = '';
  
  answers.forEach(answer => {
    const card = document.createElement('div');
    card.className = 'answer-card';
    
    const info = document.createElement('div');
    info.className = 'answer-info';
    
    const answerText = document.createElement('div');
    answerText.className = 'answer-text';
    if (!answer.answer) {
      answerText.textContent = '— (No Answer)';
      answerText.classList.add('blank');
    } else {
      answerText.textContent = answer.answer;
    }
    
    const playerName = document.createElement('div');
    playerName.className = 'answer-player';
    playerName.textContent = answer.playerName + (answer.isGM ? ' 👑' : '');
    
    info.appendChild(answerText);
    info.appendChild(playerName);
    card.appendChild(info);
    
    // Eliminate button for GM
    if (gameState.isGM) {
      const elimBtn = document.createElement('button');
      elimBtn.className = 'eliminate-btn';
      elimBtn.textContent = '❌ Eliminate';
      elimBtn.onclick = () => eliminatePlayer(answer.playerId);
      card.appendChild(elimBtn);
    }
    
    answersGrid.appendChild(card);
  });
}

function removePlayer(playerId) {
  if (confirm('Remove this player?')) {
    socket.emit('removePlayer', { roomId: gameState.roomId, playerId });
  }
}

function eliminatePlayer(playerId) {
  socket.emit('eliminatePlayers', { 
    roomId: gameState.roomId, 
    playerIds: [playerId] 
  });
  
  // Disable the button after elimination
  event.target.disabled = true;
  event.target.textContent = '✓ Eliminated';
  event.target.style.background = '#95a5a6';
}

// ========== UI HELPERS ==========

function switchScreen(screenName) {
  Object.values(screens).forEach(screen => {
    screen.classList.remove('active');
  });
  
  screens[screenName].classList.add('active');
  gameState.currentScreen = screenName;
}

function showGMControls() {
  gmControls.classList.remove('hidden');
  playerWaiting.classList.add('hidden');
}

function showPlayerWaiting() {
  gmControls.classList.add('hidden');
  playerWaiting.classList.remove('hidden');
}

function resetAnswerSection() {
  answerInput.value = '';
  answerInput.disabled = false;
  submitAnswerBtn.disabled = false;
  answerStatus.classList.add('hidden');
  answerStatus.classList.remove('success');
  submissionCount.textContent = '0/0';
}

function copyInviteLink() {
  inviteLink.select();
  inviteLink.setSelectionRange(0, 99999);
  navigator.clipboard.writeText(inviteLink.value);
  
  copyLinkBtn.textContent = '✓';
  setTimeout(() => {
    copyLinkBtn.textContent = '📋';
  }, 2000);
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function showNotification(message, type) {
  // Simple notification - you can enhance this
  console.log(`[${type.toUpperCase()}] ${message}`);
}

function createConfetti() {
  const colors = ['#FF6B9D', '#4ECDC4', '#FFE66D', '#667eea', '#FFB347'];
  
  for (let i = 0; i < 100; i++) {
    setTimeout(() => {
      const confetti = document.createElement('div');
      confetti.style.position = 'fixed';
      confetti.style.width = '10px';
      confetti.style.height = '10px';
      confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.left = Math.random() * 100 + '%';
      confetti.style.top = '-20px';
      confetti.style.borderRadius = '50%';
      confetti.style.pointerEvents = 'none';
      confetti.style.zIndex = '9999';
      confetti.style.transition = 'all 3s ease-out';
      
      document.body.appendChild(confetti);
      
      setTimeout(() => {
        confetti.style.top = '100vh';
        confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
        confetti.style.opacity = '0';
      }, 10);
      
      setTimeout(() => {
        confetti.remove();
      }, 3000);
    }, i * 30);
  }
}

// ========== START ==========
init();
