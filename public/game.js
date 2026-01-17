const socket = io();

let currentRoomId = null;
let isGameMaster = false;
let playerName = null;
let currentTimer = null;

// Screen management
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  document.getElementById(screenId).classList.add('active');
}

// Select game from playground
function selectGame(gameId) {
  if (gameId === 'oddOneIn') {
    showScreen('nameEntryScreen');
  }
}

// Join game
function joinGame() {
  const nameInput = document.getElementById('playerNameInput');
  const gmCheck = document.getElementById('gameMasterCheck');
  
  playerName = nameInput.value.trim();
  
  if (!playerName) {
    alert('Please enter your name!');
    return;
  }
  
  isGameMaster = gmCheck.checked;
  
  // Generate or get room ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  currentRoomId = urlParams.get('room') || generateRoomId();
  
  // Update URL with room ID
  if (!urlParams.get('room')) {
    window.history.pushState({}, '', `?room=${currentRoomId}`);
  }
  
  socket.emit('joinGame', {
    roomId: currentRoomId,
    playerName: playerName,
    isGameMaster: isGameMaster
  });
}

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8);
}

// Copy invite link
function copyInviteLink() {
  const inviteLink = document.getElementById('inviteLink');
  inviteLink.select();
  document.execCommand('copy');
  alert('Link copied to clipboard!');
}

// Start game
function startGame() {
  socket.emit('startGame', currentRoomId);
}

// Submit answer
function submitAnswer() {
  const answerInput = document.getElementById('answerInput');
  const answer = answerInput.value.trim();
  
  if (!answer) {
    alert('Please enter an answer!');
    return;
  }
  
  socket.emit('submitAnswer', {
    roomId: currentRoomId,
    answer: answer
  });
  
  answerInput.disabled = true;
}

// Game Master controls
function pauseTimer() {
  socket.emit('pauseTimer', currentRoomId);
}

function resumeTimer() {
  socket.emit('resumeTimer', currentRoomId);
}

function skipQuestion() {
  socket.emit('skipQuestion', currentRoomId);
}

function editQuestion() {
  const newQuestion = prompt('Enter new question:');
  if (newQuestion && newQuestion.trim()) {
    socket.emit('editQuestion', {
      roomId: currentRoomId,
      newQuestion: newQuestion.trim()
    });
  }
}

function resetGame() {
  if (confirm('Are you sure you want to reset the game?')) {
    socket.emit('resetGame', currentRoomId);
  }
}

function eliminatePlayer(playerId) {
  socket.emit('eliminatePlayer', {
    roomId: currentRoomId,
    playerId: playerId
  });
}

function savePlayer(playerId) {
  socket.emit('savePlayer', {
    roomId: currentRoomId,
    playerId: playerId
  });
}

function nextRound() {
  socket.emit('nextRound', currentRoomId);
}

function playAgain() {
  socket.emit('resetGame', currentRoomId);
}

function backToPlayground() {
  window.location.href = '/';
}

// Socket event listeners
socket.on('roomJoined', (data) => {
  isGameMaster = data.isGameMaster;
  showScreen('lobbyScreen');
  
  // Show invite section if game master
  if (isGameMaster) {
    document.getElementById('inviteSection').style.display = 'block';
    const inviteLink = `${window.location.origin}?room=${data.roomId}`;
    document.getElementById('inviteLink').value = inviteLink;
    
    document.getElementById('startGameBtn').style.display = 'block';
    document.getElementById('waitingMessage').style.display = 'none';
  }
});

socket.on('playerListUpdate', (data) => {
  const playerList = document.getElementById('playerList');
  const playerCount = document.getElementById('playerCount');
  
  playerCount.textContent = data.players.length;
  playerList.innerHTML = '';
  
  data.players.forEach(player => {
    const playerItem = document.createElement('div');
    playerItem.className = 'player-item';
    if (player.eliminated) {
      playerItem.classList.add('eliminated');
    }
    
    const nameSpan = document.createElement('span');
    nameSpan.className = 'player-name';
    nameSpan.textContent = player.name;
    
    if (player.isGameMaster) {
      const badge = document.createElement('span');
      badge.className = 'player-badge';
      badge.textContent = '👑 Game Master';
      nameSpan.appendChild(badge);
    }
    
    playerItem.appendChild(nameSpan);
    
    // Show remove button if current user is game master
    if (isGameMaster && player.id !== socket.id) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn-remove';
      removeBtn.textContent = '❌ Remove';
      removeBtn.onclick = () => {
        socket.emit('removePlayer', {
          roomId: currentRoomId,
          playerId: player.id
        });
      };
      playerItem.appendChild(removeBtn);
    }
    
    playerList.appendChild(playerItem);
  });
  
  // Update active players count in game
  const activePlayers = data.players.filter(p => !p.eliminated).length;
  const activePlayersEl = document.getElementById('activePlayers');
  if (activePlayersEl) {
    activePlayersEl.textContent = activePlayers;
  }
});

socket.on('removedFromGame', () => {
  alert('You have been removed from the game by the Game Master');
  window.location.href = '/';
});

socket.on('gameStarted', (data) => {
  showScreen('gameScreen');
  
  if (isGameMaster) {
    document.getElementById('gameMasterControls').style.display = 'flex';
  }
  
  document.getElementById('roundNumber').textContent = data.round;
  document.getElementById('currentQuestion').textContent = data.question;
  
  // Reset answer section
  document.getElementById('answerInput').value = '';
  document.getElementById('answerInput').disabled = false;
  document.getElementById('answerStatus').textContent = '';
  document.getElementById('answerReviewSection').style.display = 'none';
  document.getElementById('eliminatedMessage').style.display = 'none';
  document.getElementById('answerInputSection').style.display = 'block';
});

socket.on('timerStarted', (data) => {
  updateTimer(data.timeLeft);
});

socket.on('timerUpdate', (data) => {
  updateTimer(data.timeLeft);
});

socket.on('timerPaused', () => {
  // Visual indicator that timer is paused
  document.getElementById('timerDisplay').style.opacity = '0.5';
});

socket.on('timerResumed', () => {
  document.getElementById('timerDisplay').style.opacity = '1';
});

socket.on('questionUpdated', (data) => {
  document.getElementById('currentQuestion').textContent = data.question;
});

socket.on('answerSubmitted', (data) => {
  const answerStatus = document.getElementById('answerStatus');
  answerStatus.textContent = `✅ Your answer: "${data.answer}"`;
  answerStatus.className = 'answer-status submitted';
});

socket.on('roundEnded', (data) => {
  // Hide answer input section
  document.getElementById('answerInputSection').style.display = 'none';
  
  // Show answer review section
  const reviewSection = document.getElementById('answerReviewSection');
  reviewSection.style.display = 'block';
  
  displayAnswerGroups(data.answerGroups, data.answers);
  
  if (isGameMaster) {
    document.getElementById('nextRoundBtn').style.display = 'block';
  }
});

socket.on('playerEliminated', (data) => {
  if (data.playerId === socket.id) {
    document.getElementById('eliminatedMessage').style.display = 'block';
    document.getElementById('answerInputSection').style.display = 'none';
    
    if (isGameMaster) {
      document.getElementById('gmEliminatedNote').style.display = 'block';
    }
  }
});

socket.on('nextRound', (data) => {
  document.getElementById('roundNumber').textContent = data.round;
  document.getElementById('currentQuestion').textContent = data.question;
  
  // Reset answer section
  document.getElementById('answerInput').value = '';
  document.getElementById('answerInput').disabled = false;
  document.getElementById('answerStatus').textContent = '';
  document.getElementById('answerReviewSection').style.display = 'none';
  
  // Show input section if not eliminated
  const eliminatedMsg = document.getElementById('eliminatedMessage');
  if (eliminatedMsg.style.display === 'none') {
    document.getElementById('answerInputSection').style.display = 'block';
  }
});

socket.on('gameEnded', (data) => {
  showScreen('winnerScreen');
  
  const winnerName = document.getElementById('winnerName');
  if (data.winner) {
    winnerName.textContent = `🏆 ${data.winner.name} WINS! 🏆`;
  } else {
    winnerName.textContent = '🤝 IT\'S A TIE! 🤝';
  }
  
  displayStandings(data.players);
});

socket.on('gameReset', () => {
  showScreen('lobbyScreen');
  
  // Reset UI elements
  document.getElementById('answerInput').value = '';
  document.getElementById('answerInput').disabled = false;
  document.getElementById('answerStatus').textContent = '';
  document.getElementById('answerReviewSection').style.display = 'none';
  document.getElementById('eliminatedMessage').style.display = 'none';
});

// Helper functions
function updateTimer(timeLeft) {
  const timerDisplay = document.getElementById('timerDisplay');
  timerDisplay.textContent = timeLeft;
  
  if (timeLeft <= 3) {
    timerDisplay.parentElement.classList.add('warning');
  } else {
    timerDisplay.parentElement.classList.remove('warning');
  }
  
  if (timeLeft === 0) {
    document.getElementById('answerInput').disabled = true;
  }
}

function displayAnswerGroups(groups, allAnswers) {
  const container = document.getElementById('answerGroups');
  container.innerHTML = '';
  
  // Display duplicates
  if (groups.duplicates && groups.duplicates.length > 0) {
    const duplicateSection = document.createElement('div');
    duplicateSection.className = 'answer-group duplicates';
    duplicateSection.innerHTML = '<h4>🚨 DUPLICATE ANSWERS</h4>';
    
    groups.duplicates.forEach(group => {
      const groupDiv = document.createElement('div');
      groupDiv.innerHTML = `<strong>"${group.answer}" (${group.players.length} players)</strong>`;
      
      group.players.forEach(player => {
        const item = createAnswerItem(player);
        groupDiv.appendChild(item);
      });
      
      duplicateSection.appendChild(groupDiv);
    });
    
    container.appendChild(duplicateSection);
  }
  
  // Display unique answers
  if (groups.unique && groups.unique.length > 0) {
    const uniqueSection = document.createElement('div');
    uniqueSection.className = 'answer-group unique';
    uniqueSection.innerHTML = '<h4>✅ UNIQUE ANSWERS</h4>';
    
    groups.unique.forEach(player => {
      const item = createAnswerItem(player);
      uniqueSection.appendChild(item);
    });
    
    container.appendChild(uniqueSection);
  }
}

function createAnswerItem(player) {
  const item = document.createElement('div');
  item.className = 'answer-item';
  
  const nameSpan = document.createElement('span');
  nameSpan.textContent = `${player.playerName}: "${player.answer}"`;
  item.appendChild(nameSpan);
  
  if (isGameMaster) {
    const actions = document.createElement('div');
    actions.className = 'answer-actions';
    
    const eliminateBtn = document.createElement('button');
    eliminateBtn.className = 'btn-eliminate';
    eliminateBtn.textContent = '❌ OUT';
    eliminateBtn.onclick = () => eliminatePlayer(player.playerId);
    
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn-save';
    saveBtn.textContent = '✅ SAVE';
    saveBtn.onclick = () => savePlayer(player.playerId);
    
    actions.appendChild(eliminateBtn);
    actions.appendChild(saveBtn);
    item.appendChild(actions);
  }
  
  return item;
}

function displayStandings(players) {
  const container = document.getElementById('finalStandings');
  container.innerHTML = '';
  
  // Sort players - active players first, then by name
  const sorted = [...players].sort((a, b) => {
    if (a.eliminated === b.eliminated) {
      return a.name.localeCompare(b.name);
    }
    return a.eliminated ? 1 : -1;
  });
  
  sorted.forEach((player, index) => {
    const item = document.createElement('div');
    item.className = 'standing-item';
    
    let medal = '';
    if (!player.eliminated) {
      medal = '🥇 ';
    } else if (index === 1) {
      medal = '🥈 ';
    } else if (index === 2) {
      medal = '🥉 ';
    }
    
    item.innerHTML = `
      <span>${medal}${player.name}${player.isGameMaster ? ' 👑' : ''}</span>
      <span>${player.eliminated ? '❌ Eliminated' : '✅ Winner'}</span>
    `;
    
    container.appendChild(item);
  });
}

// Allow Enter key to submit
document.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.getElementById('playerNameInput');
  const answerInput = document.getElementById('answerInput');
  
  if (nameInput) {
    nameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        joinGame();
      }
    });
  }
  
  if (answerInput) {
    answerInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        submitAnswer();
      }
    });
  }
});
