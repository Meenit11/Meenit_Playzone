const socket = io();

let currentRoomId = null;
let isGameMaster = false;
let playerName = null;
let isEliminated = false;
let hasSubmittedAnswer = false;

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentRoomId = urlParams.get('room');
    isGameMaster = urlParams.get('gm') === 'true';
    
    if (!currentRoomId) {
        window.location.href = '/';
        return;
    }
    showScreen('nameScreen');

    // Auto-focus name input
    document.getElementById('playerNameInput').focus();
});

function joinGame() {
    const nameInput = document.getElementById('playerNameInput');
    playerName = nameInput.value.trim();
    if (!playerName) return alert('Enter a name!');
    
    socket.emit('joinGame', {
        roomId: currentRoomId,
        playerName: playerName,
        isGameMaster: isGameMaster,
        gameType: 'odd-one-in'
    });
}

// ========== SOCKET LISTENERS ==========

socket.on('roomJoined', (data) => {
    showScreen('lobbyScreen');
    if (isGameMaster) {
        document.getElementById('inviteSection').style.display = 'block';
        document.getElementById('inviteLink').value = `${window.location.origin}/odd-one-in?room=${currentRoomId}`;
        document.getElementById('startBtn').style.display = 'block';
        document.getElementById('backBtn').style.display = 'block';
        document.getElementById('waitingMsg').style.display = 'none';
    }
});

socket.on('playerListUpdate', (data) => {
    const list = document.getElementById('playerList');
    document.getElementById('playerCount').textContent = data.players.length;
    list.innerHTML = '';

    data.players.forEach(p => {
        const item = document.createElement('div');
        item.className = `player-item ${p.eliminated ? 'eliminated' : ''}`;
        item.innerHTML = `
            <span class="player-name">${p.isGameMaster ? '👑 ' : ''}${p.name} ${p.eliminated ? '💀' : ''}</span>
            ${isGameMaster && p.id !== socket.id ? `<button class="btn-remove" onclick="kickPlayer('${p.id}')">Kick</button>` : ''}
        `;
        list.appendChild(item);
    });
    
    const activeCount = data.players.filter(p => !p.eliminated).length;
    if(document.getElementById('activePlayers')) document.getElementById('activePlayers').textContent = activeCount;
});

socket.on('gameStarted', (data) => {
    showScreen('gameScreen');
    resetRoundUI(data);
});

socket.on('timerUpdate', (data) => {
    const timerNum = document.getElementById('timerNum');
    timerNum.textContent = data.timeLeft;
    if (data.timeLeft <= 3) document.getElementById('timerCircle').classList.add('warning');
});

socket.on('roundEnded', (data) => {
    document.getElementById('answerSection').style.display = 'none';
    document.getElementById('reviewSection').style.display = 'block';
    
    displayResults(data.answerGroups);
    
    if (isGameMaster) {
        document.getElementById('nextRoundBtn').style.display = 'block';
        document.getElementById('waitingNextRound').style.display = 'none';
    } else {
        document.getElementById('nextRoundBtn').style.display = 'none';
        document.getElementById('waitingNextRound').style.display = 'block';
    }
});

socket.on('playerEliminated', (data) => {
    if (data.playerId === socket.id) {
        isEliminated = true;
        document.getElementById('eliminatedMsg').style.display = 'block';
        document.getElementById('answerSection').style.display = 'none';
        if (isGameMaster) document.getElementById('gmNote').style.display = 'block';
    }
});

socket.on('nextRound', (data) => {
    resetRoundUI(data);
});

socket.on('questionUpdated', (data) => {
    document.getElementById('questionText').textContent = data.question;
});

// ========== UI HELPERS ==========

function resetRoundUI(data) {
    document.getElementById('roundNum').textContent = data.round;
    document.getElementById('questionText').textContent = data.question;
    document.getElementById('reviewSection').style.display = 'none';
    document.getElementById('timerCircle').classList.remove('warning');
    
    if (isGameMaster) document.getElementById('gmControls').style.display = 'flex';
    
    if (!isEliminated) {
        document.getElementById('answerSection').style.display = 'block';
        document.getElementById('answerInput').disabled = false;
        document.getElementById('answerInput').value = '';
        document.getElementById('eliminatedMsg').style.display = 'none';
        hasSubmittedAnswer = false;
    } else {
        document.getElementById('answerSection').style.display = 'none';
        document.getElementById('eliminatedMsg').style.display = 'block';
    }
}

function displayResults(groups) {
    const container = document.getElementById('answerGroups');
    container.innerHTML = '';

    // 1. Show No-Answers (Red) - Sorted by Name
    groups.duplicates.filter(g => g.answer === "").forEach(g => {
        g.players.sort((a,b) => a.playerName.localeCompare(b.playerName)).forEach(p => {
            container.appendChild(createResultItem(p, "No Answer", "red"));
        });
    });

    // 2. Show Duplicates (Red) - Sorted by Name
    groups.duplicates.filter(g => g.answer !== "").forEach(g => {
        g.players.sort((a,b) => a.playerName.localeCompare(b.playerName)).forEach(p => {
            container.appendChild(createResultItem(p, p.answer, "red"));
        });
    });

    // 3. Show Unique (Green) - Sorted by Answer Alphabetically
    groups.unique.sort((a,b) => a.answer.localeCompare(b.answer)).forEach(p => {
        container.appendChild(createResultItem(p, p.answer, "green"));
    });
}

function createResultItem(player, text, color) {
    const div = document.createElement('div');
    div.className = `answer-item ${color}`;
    div.innerHTML = `
        <span class="player-name"><strong>${player.playerName}</strong>: ${text || 'BLANK'}</span>
        ${isGameMaster ? `<button class="btn-eliminate" onclick="eliminatePlayer('${player.playerId}')">OUT</button>` : ''}
    `;
    return div;
}

// ========== ACTIONS ==========
function kickPlayer(id) { socket.emit('removePlayer', { roomId: currentRoomId, playerId: id }); }
function startGame() { socket.emit('startGame', { roomId: currentRoomId }); }
function submitAnswer() {
    if (hasSubmittedAnswer) return;
    const val = document.getElementById('answerInput').value.trim();
    socket.emit('submitAnswer', { roomId: currentRoomId, answer: val });
    document.getElementById('answerInput').disabled = true;
    hasSubmittedAnswer = true;
}
function eliminatePlayer(id) {
    if(confirm("Manual override: Eliminate this player?")) {
        socket.emit('eliminatePlayer', { roomId: currentRoomId, playerId: id });
    }
}
function editQuestion() {
    const newQ = prompt("Enter custom question:");
    if(newQ) socket.emit('editQuestion', { roomId: currentRoomId, newQuestion: newQ });
}
function nextRound() { socket.emit('nextRound', currentRoomId); }
function pauseTimer() { socket.emit('pauseTimer', currentRoomId); }
function resumeTimer() { socket.emit('resumeTimer', currentRoomId); }
function skipQuestion() { socket.emit('skipQuestion', currentRoomId); }
function resetGame() { if(confirm("Reset entire game?")) socket.emit('resetGame', currentRoomId); }
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}
