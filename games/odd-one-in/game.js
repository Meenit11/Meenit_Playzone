// Odd One In - Enhanced Game Logic

const socket = io();

let currentRoomId = null;
let isGameMaster = false;
let playerName = null;
let isEliminated = false;

// ========== SCREEN MANAGEMENT ==========
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

// ========== INITIALIZATION ==========
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  currentRoomId = urlParams.get('room');
  const isGM = urlParams.get('gm') === 'true';
  
  if (!currentRoomId) {
    alert('Invalid game link!');
    window.location.href = '/';
    return;
  }
  
  isGameMaster = isGM;
  showScreen('nameScreen');
  
  // Enter key listener for name input
  const nameInput = document.getElementById('playerNameInput');
  if (nameInput) {
    nameInput.focus();
    nameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') joinGame();
    });
  }
  
  // Enter key listener for answer input
  const answerInput = document.getElementById('answerInput');
  if (answerInput) {
    answerInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') submitAnswer();
    });
  }
});

// ========== JOIN GAME ==========
function joinGame() {
  const nameInput = document.getElementById('playerNameInput');
  playerName = nameInput.value.trim();
  
  if (!playerName) {
    alert('Please enter your name!');
    nameInput.focus();
    return;
  }
  
  socket.emit('joinGame', {
    roomId: currentRoomId,
    playerName: playerName,
    isGameMaster: isGameMaster,
    gameType: 'odd-one-in'
  });
}

function backToHome() {
  if (confirm('Are you sure you want to leave the game?')) {
    window.location.href = '/';
  }
}

function copyInvite() {
  const inviteLink = document.getElementById('inviteLink');
  inviteLink.select();
  inviteLink.setSelectionRange(0, 99999);
  
  try {
    document.execCommand('copy');
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '✅ Copied!';
    btn.style.background = '#4CAF50';
    
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = '';
    }, 2000);
  } catch (err) {
    alert('Failed to copy. Please copy manually.');
  }
}

// ========== GAME CONTROLS ==========
function startGame() {
  const playerCount = document.querySelectorAll('.player-item').length;
  if (playerCount < 3) {
    alert('Need at least 3 players to start!');
    return;
  }
  socket.emit('startGame', { roomId: currentRoomId });
}

function submitAnswer() {
  const answerInput = document.getElementById('answerInput');
  const answer = answerInput.value.trim();
  
  if (!answer) {
    alert('Please enter an answer!');
    answerInput.focus();
    return;
  }
  
  socket.emit('submitAnswer', {
    roomId: currentRoomId,
    answer: answer
  });
}

function pauseTimer() {
  socket.emit('pauseTimer', currentRoomId);
}

function resumeTimer() {
  socket.emit('resumeTimer', currentRoomId);
}

function skipQuestion() {
  if (confirm('Skip this question and move to next round?')) {
    socket.emit('skipQuestion', currentRoomId);
  }
}

function editQuestion() {
  const currentQuestion = document.getElementById('questionText').textContent;
  const newQuestion = prompt('Enter new question:', currentQuestion);
  if (newQuestion && newQuestion.trim() && newQuestion !== currentQuestion) {
    socket.emit('editQuestion', {
      roomId: currentRoomId,
      newQuestion: newQuestion.trim()
    });
  }
}

function resetGame() {
  if (confirm('Reset the entire game? All progress will be lost and everyone will return to the lobby.')) {
    socket.emit('resetGame', currentRoomId);
  }
}

function eliminatePlayer(playerId) {
  if (confirm('Eliminate this player?')) {
    socket.emit('eliminatePlayer', {
      roomId: currentRoomId,
      playerId: playerId
    });
  }
}

function nextRound() {
  socket.emit('nextRound', currentRoomId);
}

function playAgain() {
  socket.emit('resetGame', currentRoomId);
}

// ========== SOCKET EVENTS ==========

socket.on('roomJoined', (data) => {
  isGameMaster = data.isGameMaster;
  showScreen('lobbyScreen');
  
  // Show/hide back button based on GM status
  const backHomeBtn = document.getElementById('backHomeBtn');
  if (backHomeBtn) {
    backHomeBtn.style.display = isGameMaster ? 'block' : 'none';
  }
  
  if (isGameMaster) {
    document.getElementById('inviteSection').style.display = 'block';
    const inviteLink = `${window.location.origin}/odd-one-in?room=${data.roomId}`;
    document.getElementById('inviteLink').value = inviteLink;
    document.getElementById('startBtn').style.display = 'block';
    document.getElementById('waitingMsg').style.display = 'none';
  }
  
  if (data.gameStarted) {
    showScreen('gameScreen');
    if (isGameMaster) {
      document.getElementById('gmControls').style.display = 'flex';
    }
  }
});

socket.on('playerListUpdate', (data) => {
  const playerList = document.getElementById('playerList');
  const playerCount = document.getElementById('playerCount');
  
  playerCount.textContent = data.players.length;
  playerList.innerHTML = '';
  
  data.players.forEach(player => {
    const item = document.createElement('div');
    item.className = 'player-item';
    if (player.eliminated) item.classList.add('eliminated');
    
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
    
    if (player.eliminated) {
      const eliminatedBadge = document.createElement('span');
      eliminatedBadge.style.marginLeft = '10px';
      eliminatedBadge.style.color = '#f44336';
      eliminatedBadge.textContent = '💀 OUT';
      nameSpan.appendChild(eliminatedBadge);
    }
    
    nameDiv.appendChild(nameSpan);
    item.appendChild(nameDiv);
    
    if (isGameMaster && player.id !== socket.id && !player.eliminated) {
      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn-remove';
      removeBtn.textContent = '❌ Kick';
      removeBtn.onclick = () => {
        if (confirm(`Remove ${player.name} from the game?`)) {
          socket.emit('removePlayer', {
            roomId: currentRoomId,
            playerId: player.id
          });
        }
      };
      item.appendChild(removeBtn);
    }
    
    playerList.appendChild(item);
  });
  
  // Update active players count in game
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
    document.getElementById('gmControls').style.display = 'flex';
  }
  
  document.getElementById('roundNum').textContent = data.round;
  document.getElementById('questionText').textContent = data.question;
  document.getElementById('timerNum').textContent = 'Ready';
  
  const answerInput = document.getElementById('answerInput');
  answerInput.value = '';
  answerInput.disabled = true;
  
  document.getElementById('answerStatus').textContent = '';
  document.getElementById('answerStatus').className = 'answer-status';
  document.getElementById('reviewSection').style.display = 'none';
  document.getElementById('eliminatedMsg').style.display = 'none';
  document.getElementById('answerSection').style.display = 'block';
});

socket.on('timerStarted', (data) => {
  if (!isEliminated) {
    const answerInput = document.getElementById('answerInput');
    answerInput.disabled = false;
    answerInput.focus();
  }
  updateTimer(data.timeLeft);
});

socket.on('timerUpdate', (data) => {
  updateTimer(data.timeLeft);
});

socket.on('timerPaused', () => {
  const timerCircle = document.getElementById('timerCircle');
  timerCircle.style.opacity = '0.5';
  timerCircle.style.filter = 'grayscale(1)';
});

socket.on('timerResumed', () => {
  const timerCircle = document.getElementById('timerCircle');
  timerCircle.style.opacity = '1';
  timerCircle.style.filter = 'grayscale(0)';
});

socket.on('questionUpdated', (data) => {
  document.getElementById('questionText').textContent = data.question;
});

socket.on('answerSubmitted', (data) => {
  const answerInput = document.getElementById('answerInput');
  const answerStatus = document.getElementById('answerStatus');
  
  answerInput.disabled = true;
  answerStatus.textContent = `✅ Submitted: "${data.answer}"`;
  answerStatus.className = 'answer-status submitted';
});

socket.on('roundEnded', (data) => {
  document.getElementById('answerSection').style.display = 'none';
  document.getElementById('reviewSection').style.display = 'block';
  document.getElementById('timerNum').textContent = '⏰';
  
  displayAnswerGroups(data.answerGroups);
  
  if (isGameMaster) {
    document.getElementById('nextRoundBtn').style.display = 'block';
  }
});

socket.on('playerEliminated', (data) => {
  if (data.playerId === socket.id) {
    isEliminated = true;
    document.getElementById('eliminatedMsg').style.display = 'block';
    document.getElementById('answerSection').style.display = 'none';
    
    if (isGameMaster) {
      document.getElementById('gmNote').style.display = 'block';
    }
  }
  
  // Show notification for all players
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(244,67,54,0.95);
    color: white;
    padding: 15px 25px;
    border-radius: 15px;
    font-weight: 700;
    z-index: 1000;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    animation: slideDown 0.5s ease;
  `;
  notification.textContent = `💀 ${data.playerName} has been eliminated!`;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideUp 0.5s ease';
    setTimeout(() => notification.remove(), 500);
  }, 3000);
});

socket.on('nextRound', (data) => {
  document.getElementById('roundNum').textContent = data.round;
  document.getElementById('questionText').textContent = data.question;
  document.getElementById('timerNum').textContent = 'Ready';
  
  const answerInput = document.getElementById('answerInput');
  answerInput.value = '';
  answerInput.disabled = true;
  
  document.getElementById('answerStatus').textContent = '';
  document.getElementById('answerStatus').className = 'answer-status';
  document.getElementById('reviewSection').style.display = 'none';
  
  if (!isEliminated) {
    document.getElementById('answerSection').style.display = 'block';
  }
});

socket.on('gameEnded', (data) => {
  showScreen('winnerScreen');
  
  const winnerName = document.getElementById('winnerName');
  if (data.winner) {
    winnerName.textContent = `🏆 ${data.winner.name} WINS! 🏆`;
  } else {
    winnerName.textContent = '🤝 NO WINNER - TIE! 🤝';
  }
  
  // Show home button for GM only on winner screen
  const winnerHomeBtn = document.getElementById('winnerHomeBtn');
  if (winnerHomeBtn) {
    winnerHomeBtn.style.display = isGameMaster ? 'inline-block' : 'none';
  }
  
  displayStandings(data.players);
});

socket.on('gameReset', () => {
  showScreen('lobbyScreen');
  isEliminated = false;
  
  // Reset all game elements
  document.getElementById('answerInput').value = '';
  document.getElementById('answerInput').disabled = false;
  document.getElementById('answerStatus').textContent = '';
  document.getElementById('answerStatus').className = 'answer-status';
  document.getElementById('reviewSection').style.display = 'none';
  document.getElementById('eliminatedMsg').style.display = 'none';
  document.getElementById('timerNum').textContent = '10';
  document.getElementById('questionText').textContent = 'Get ready...';
  document.getElementById('answerSection').style.display = 'block';
  
  const timerCircle = document.getElementById('timerCircle');
  timerCircle.classList.remove('warning');
  timerCircle.style.opacity = '1';
  timerCircle.style.filter = 'grayscale(0)';
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  alert('Connection error. Please refresh the page.');
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

// ========== HELPER FUNCTIONS ==========

function updateTimer(timeLeft) {
  const timerNum = document.getElementById('timerNum');
  const timerCircle = document.getElementById('timerCircle');
  
  timerNum.textContent = timeLeft;
  
  if (timeLeft <= 3 && timeLeft > 0) {
    timerCircle.classList.add('warning');
  } else {
    timerCircle.classList.remove('warning');
  }
  
  if (timeLeft === 0) {
    const answerInput = document.getElementById('answerInput');
    if (answerInput) {
      answerInput.disabled = true;
    }
    timerNum.textContent = '⏰';
  }
}

function displayAnswerGroups(groups) {
  const container = document.getElementById('answerGroups');
  container.innerHTML = '';
  
  // Display duplicates first (eliminated)
  if (groups.duplicates && groups.duplicates.length > 0) {
    const duplicatesSection = document.createElement('div');
    duplicatesSection.className = 'answer-group duplicates';
    
    const header = document.createElement('h4');
    header.textContent = '🚨 DUPLICATE ANSWERS - ELIMINATED!';
    header.style.color = '#f44336';
    duplicatesSection.appendChild(header);
    
    groups.duplicates.forEach(group => {
      const groupLabel = document.createElement('div');
      groupLabel.className = 'group-label';
      groupLabel.innerHTML = `<strong>"${group.answer}"</strong> - ${group.count} players matched`;
      duplicatesSection.appendChild(groupLabel);
      
      group.players.forEach(player => {
        const item = createAnswerItem(player, true);
        duplicatesSection.appendChild(item);
      });
    });
    
    container.appendChild(duplicatesSection);
  }
  
  // Display unique answers (safe)
  if (groups.unique && groups.unique.length > 0) {
    const uniqueSection = document.createElement('div');
    uniqueSection.className = 'answer-group unique';
    
    const header = document.createElement('h4');
    header.textContent = '✅ UNIQUE ANSWERS - SAFE!';
    header.style.color = '#4CAF50';
    uniqueSection.appendChild(header);
    
    groups.unique.forEach(player => {
      const item = createAnswerItem(player, false);
      uniqueSection.appendChild(item);
    });
    
    container.appendChild(uniqueSection);
  }
  
  // Display players who didn't answer
  if (groups.noAnswer && groups.noAnswer.length > 0) {
    const noAnswerSection = document.createElement('div');
    noAnswerSection.className = 'answer-group duplicates';
    
    const header = document.createElement('h4');
    header.textContent = '🤐 NO ANSWER - ELIMINATED!';
    header.style.color = '#ff9800';
    noAnswerSection.appendChild(header);
    
    groups.noAnswer.forEach(player => {
      const item = document.createElement('div');
      item.className = 'answer-item';
      item.style.opacity = '0.7';
      
      const textSpan = document.createElement('span');
      textSpan.className = 'answer-text';
      textSpan.textContent = `${player.playerName}: (No answer)`;
      textSpan.style.color = '#ff9800';
      item.appendChild(textSpan);
      
      noAnswerSection.appendChild(item);
    });
    
    container.appendChild(noAnswerSection);
  }
}

function createAnswerItem(player, isDuplicate) {
  const item = document.createElement('div');
  item.className = 'answer-item';
  
  const textSpan = document.createElement('span');
  textSpan.className = 'answer-text';
  textSpan.textContent = `${player.playerName}: "${player.answer}"`;
  
  if (isDuplicate) {
    textSpan.style.textDecoration = 'line-through';
    textSpan.style.color = '#f44336';
  } else {
    textSpan.style.color = '#4CAF50';
  }
  
  item.appendChild(textSpan);
  
  // GM can manually eliminate/save players
  if (isGameMaster) {
    const actions = document.createElement('div');
    actions.className = 'answer-actions';
    
    const eliminateBtn = document.createElement('button');
    eliminateBtn.className = 'btn-eliminate';
    eliminateBtn.textContent = '❌ Eliminate';
    eliminateBtn.title = 'Host override: Eliminate this player';
    eliminateBtn.onclick = () => eliminatePlayer(player.playerId);
    
    actions.appendChild(eliminateBtn);
    item.appendChild(actions);
  }
  
  return item;
}

function displayStandings(players) {
  const container = document.getElementById('standingsList');
  container.innerHTML = '';
  
  // Sort: Winners first, then eliminated
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
    const activeIndex = sorted.filter(p => !p.eliminated).indexOf(player);
    
    if (!player.eliminated) {
      if (activeIndex === 0) medal = '🥇 ';
      else if (activeIndex === 1) medal = '🥈 ';
      else if (activeIndex === 2) medal = '🥉 ';
      else medal = `${activeIndex + 1}. `;
    } else {
      medal = `${index + 1}. `;
    }
    
    const status = player.eliminated ? '❌ Eliminated' : '✅ Winner';
    
    const leftSide = document.createElement('span');
    leftSide.textContent = `${medal}${player.name}${player.isGameMaster ? ' 👑' : ''}`;
    
    const rightSide = document.createElement('span');
    rightSide.textContent = status;
    rightSide.style.color = player.eliminated ? '#f44336' : '#4CAF50';
    
    item.appendChild(leftSide);
    item.appendChild(rightSide);
    
    container.appendChild(item);
  });
}
