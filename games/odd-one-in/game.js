// games/odd-one-in/game.js

const socket = io();

let currentRoomId = null;
let isGameMaster = false;
let playerName = null;
let isEliminated = false;

// Screen management
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  document.getElementById(screenId).classList.add('active');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  currentRoomId = urlParams.get('room');
  const isGM = urlParams.get('gm') === 'true';
  
  if (currentRoomId) {
    isGameMaster = isGM;
    showScreen('nameEntryScreen');
  } else {
    alert('Invalid game link!');
    window.location.href = '/';
  }
  
  // Enter key listeners
  document.getElementById('playerNameInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinGame();
  });
  
  const answerInput = document.getElementById('answerInput');
  if (answerInput) {
    answerInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') submitAnswer();
    });
  }
});

function joinGame() {
  const nameInput = document.getElementById('playerNameInput');
  playerName = nameInput.value.trim();
  
  if (!playerName) {
    alert('Please enter your name!');
    return;
  }
  
  socket.emit('joinGame', {
    roomId: currentRoomId,
    playerName: playerName,
    isGameMaster: isGameMaster
  });
}

function backToHome() {
  window.location.href = '/';
}

function copyInviteLink() {
  const inviteLink = document.getElementById('inviteLink');
  inviteLink.select();
  inviteLink.setSelectionRange(0, 99999); // For mobile
  document.execCommand('copy');
  
  const btn = event.target;
  const originalText = btn.textContent;
  btn.textContent = '✅ Copied!';
  setTimeout(() => {
    btn.textContent = originalText;
  }, 2000);
}

function startGame() {
  socket.emit('startGame', currentRoomId);
}

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
}

// Game Master Controls
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
  if (confirm('Reset the entire game? All progress will be lost.')) {
    socket.emit('resetGame', currentRoomId);
  }
}

function eliminatePlayer(playerId) {
  socket.emit('eliminatePlayer', {
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

// Socket Event Listeners
socket.on('roomJoined', (data) => {
  isGameMaster = data.isGameMaster;
  showScreen('lobbyScreen');
  
  if (isGameMaster) {
    document.getElementById('inviteSection').style.display = 'block';
    const inviteLink = `${window.location.origin}/odd-one-in?room=${data.roomId}`;
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
    
    const nameDiv = document.createElement('div');
    const nameSpan = document.createElement('span');
    nameSpan.className = 'player-name';
    nameSpan.textContent = player.name;
    
    if (player.isGameMaster) {
      const badge = document.createElement('span');
      badge.className = 'player-badge';
      badge.textContent = '👑 GM';
      nameSpan.appendChild(badge);
    }
    
    nameDiv.appendChild(nameSpan);
    playerItem.appendChild(nameDiv);
    
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
  
  const activePlayersEl = document.getElementById('activePlayers');
  if (activePlayersEl) {
    const activePlayers = data.players.filter(p => !p.eliminated).length;
    activePlayersEl.textContent = activePlayers;
  }
});

socket.on('removedFromGame', () => {
  alert('You have been removed by the Game Master');
  window.location.href = '/';
});

socket.on('gameStarted', (data) => {
  showScreen('gameScreen');
  isEliminated = false;
  
  if (isGameMaster) {
    document.getElementById('gameMasterControls').style.display = 'block';
  }
  
  document.getElementById('roundNumber').textContent = data.round;
  document.getElementById('currentQuestion').textContent = data.question;
  document.getElementById('timerDisplay').textContent = 'Ready';
  
  document.getElementById('answerInput').value = '';
  document.getElementById('answerInput').disabled = true;
  document.getElementById('answerStatus').textContent = '';
  document.getElementById('answerReviewSection').style.display = 'none';
  document.getElementById('eliminatedMessage').style.display = 'none';
  document.getElementById('answerInputSection').style.display = 'block';
});

socket.on('timerStarted', (data) => {
  if (!isEliminated) {
    document.getElementById('answerInput').disabled = false;
    document.getElementById('answerInput').focus();
  }
  updateTimer(data.timeLeft);
});

socket.on('timerUpdate', (data) => {
  updateTimer(data.timeLeft);
});

socket.on('timerPaused', () => {
  const timerCircle = document.getElementById('timerCircle');
  timerCircle.style.opacity = '0.5';
});

socket.on('timerResumed', () => {
  const timerCircle = document.getElementById('timerCircle');
  timerCircle.style.opacity = '1';
});

socket.on('questionUpdated', (data) => {
  document.getElementById('currentQuestion').textContent = data.question;
});

socket.on('answerSubmitted', (data) => {
  const answerInput = document.getElementById('answerInput');
  const answerStatus = document.getElementById('answerStatus');
  
  answerInput.disabled = true;
  answerStatus.textContent = `✅ Submitted: "${data.answer}"`;
  answerStatus.className = 'answer-status submitted';
});

socket.on('roundEnded', (data) => {
  document.getElementById('answerInputSection').style.display = 'none';
  document.getElementById('answerReviewSection').style.display = 'block';
  
  displayAnswerGroups(data.answerGroups);
  
  if (isGameMaster) {
    document.getElementById('nextRoundBtn').style.display = 'block';
  }
});

socket.on('playerEliminated', (data) => {
  if (data.playerId === socket.id) {
    isEliminated = true;
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
  document.getElementById('timerDisplay').textContent = 'Ready';
  
  document.getElementById('answerInput').value = '';
  document.getElementById('answerInput').disabled = true;
  document.getElementById('answerStatus').textContent = '';
  document.getElementById('answerReviewSection').style.display = 'none';
  
  if (!isEliminated) {
    document.getElementById('answerInputSection').style.display = 'block';
  }
});

socket.on('gameEnded', (data) => {
  showScreen('winnerScreen');
  
  const winnerDisplay = document.getElementById('winnerDisplay');
  if (data.winner) {
    winnerDisplay.textContent = `🏆 ${data.winner.name} WINS! 🏆`;
  } else {
    winnerDisplay.textContent = '🤝 NO WINNER - TIE! 🤝';
  }
  
  displayStandings(data.players);
});

socket.on('gameReset', () => {
  showScreen('lobbyScreen');
  isEliminated = false;
  
  document.getElementById('answerInput').value = '';
  document.getElementById('answerInput').disabled = false;
  document.getElementById('answerStatus').textContent = '';
  document.getElementById('answerReviewSection').style.display = 'none';
  document.getElementById('eliminatedMessage').style.display = 'none';
});

// Helper Functions
function updateTimer(timeLeft) {
  const timerDisplay = document.getElementById('timerDisplay');
  const timerCircle = document.getElementById('timerCircle');
  
  timerDisplay.textContent = timeLeft;
  
  if (timeLeft <= 3 && timeLeft > 0) {
    timerCircle.classList.add('warning');
  } else {
    timerCircle.classList.remove('warning');
  }
  
  if (timeLeft === 0) {
    document.getElementById('answerInput').disabled = true;
    timerDisplay.textContent = '⏰';
  }
}

function displayAnswerGroups(groups) {
  const container = document.getElementById('answerGroups');
  container.innerHTML = '';
  
  // Duplicates first
  if (groups.duplicates && groups.duplicates.length > 0) {
    const duplicatesSection = document.createElement('div');
    duplicatesSection.className = 'answer-group duplicates';
    duplicatesSection.innerHTML = '<h4>🚨 DUPLICATE ANSWERS (DANGER!)</h4>';
    
    groups.duplicates.forEach(group => {
      const groupLabel = document.createElement('div');
      groupLabel.className = 'group-label';
      groupLabel.innerHTML = `<strong>"${group.answer}"</strong> - ${group.count} players matched`;
      duplicatesSection.appendChild(groupLabel);
      
      group.players.forEach(player => {
        const item = createAnswerItem(player);
        duplicatesSection.appendChild(item);
      });
    });
    
    container.appendChild(duplicatesSection);
  }
  
  // Unique answers
  if (groups.unique && groups.unique.length > 0) {
    const uniqueSection = document.createElement('div');
    uniqueSection.className = 'answer-group unique';
    uniqueSection.innerHTML = '<h4>✅ UNIQUE ANSWERS (SAFE!)</h4>';
    
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
  
  const textSpan = document.createElement('span');
  textSpan.className = 'answer-text';
  textSpan.textContent = `${player.playerName}: "${player.answer}"`;
  item.appendChild(textSpan);
  
  if (isGameMaster) {
    const actions = document.createElement('div');
    actions.className = 'answer-actions';
    
    const eliminateBtn = document.createElement('button');
    eliminateBtn.className = 'btn-eliminate';
    eliminateBtn.textContent = '❌ OUT';
    eliminateBtn.onclick = () => eliminatePlayer(player.playerId);
    
    actions.appendChild(eliminateBtn);
    item.appendChild(actions);
  }
  
  return item;
}

function displayStandings(players) {
  const container = document.getElementById('finalStandings');
  container.innerHTML = '';
  
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
    if (!player.eliminated && index === 0) medal = '🥇 ';
    else if (index === 1) medal = '🥈 ';
    else if (index === 2) medal = '🥉 ';
    else medal = `${index + 1}. `;
    
    const status = player.eliminated ? '❌ Eliminated' : '✅ Winner';
    
    item.innerHTML = `
      <span>${medal}${player.name}${player.isGameMaster ? ' 👑' : ''}</span>
      <span>${status}</span>
    `;
    
    container.appendChild(item);
  });
}
