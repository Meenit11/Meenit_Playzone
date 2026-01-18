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
    
    // Sort and Display Results
    displayResults(data.answerGroups);
    
    if (isGameMaster) {
        document.getElementById('nextRoundBtn').style.display = 'block';
    } else {
        document.getElementById('waitingNextRound').style.display = 'block';
    }
});

// ========== UI HELPERS ==========

function resetRoundUI(data) {
    document.getElementById('roundNum').textContent = data.round;
    document.getElementById('questionText').textContent = data.question;
    document.getElementById('reviewSection').style.display = 'none';
    document.getElementById('waitingNextRound').style.display = 'none';
    
    if (isGameMaster) document.getElementById('gmControls').style.display = 'flex';
    
    if (!isEliminated) {
        document.getElementById('answerSection').style.display = 'block';
        document.getElementById('answerInput').disabled = false;
        document.getElementById('answerInput').value = '';
        hasSubmittedAnswer = false;
    } else {
        document.getElementById('answerSection').style.display = 'none';
        document.getElementById('eliminatedMsg').style.display = 'block';
    }
}

function displayResults(groups) {
    const container = document.getElementById('answerGroups');
    container.innerHTML = '';

    // 1. Show No-Answers First (Sorted Alphabetically)
    if (groups.unique) {
        const noAns = groups.unique.filter(p => p.answer === "" || !p.answer).sort((a,b) => a.playerName.localeCompare(b.playerName));
        noAns.forEach(p => container.appendChild(createResultItem(p, "No Answer", "red")));
    }

    // 2. Show Duplicates (Eliminated)
    groups.duplicates.forEach(g => {
        g.players.sort((a,b) => a.playerName.localeCompare(b.playerName)).forEach(p => {
            container.appendChild(createResultItem(p, p.answer, "red"));
        });
    });

    // 3. Show Unique (Safe)
    groups.unique.filter(p => p.answer !== "").sort((a,b) => a.answer.localeCompare(b.answer)).forEach(p => {
        container.appendChild(createResultItem(p, p.answer, "green"));
    });
}

function createResultItem(player, text, color) {
    const div = document.createElement('div');
    div.className = `answer-item ${color}`;
    div.innerHTML = `
        <span class="player-name">${player.playerName}: <strong>${text || 'BLANK'}</strong></span>
        ${isGameMaster ? `<button class="btn-eliminate" onclick="eliminatePlayer('${player.playerId}')">OUT</button>` : ''}
    `;
    return div;
}

// ========== GM ACTIONS ==========
function kickPlayer(id) { socket.emit('removePlayer', { roomId: currentRoomId, playerId: id }); }
function startGame() { socket.emit('startGame', { roomId: currentRoomId }); }
function submitAnswer() {
    const val = document.getElementById('answerInput').value;
    socket.emit('submitAnswer', { roomId: currentRoomId, answer: val });
    document.getElementById('answerInput').disabled = true;
    hasSubmittedAnswer = true;
}
function nextRound() { socket.emit('nextRound', currentRoomId); }
function pauseTimer() { socket.emit('pauseTimer', currentRoomId); }
function resumeTimer() { socket.emit('resumeTimer', currentRoomId); }
function skipQuestion() { socket.emit('skipQuestion', currentRoomId); }

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}
