const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

/* -------------------- STATIC -------------------- */
app.use(express.static('public'));
app.use('/games', express.static('games'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/odd-one-in', (req, res) => {
  res.sendFile(path.join(__dirname, 'games/odd-one-in/game.html'));
});

app.get('/undercover', (req, res) => {
  res.sendFile(path.join(__dirname, 'games/undercover/game.html'));
});

app.get('/mafia', (req, res) => {
  res.sendFile(path.join(__dirname, 'games/mafia/game.html'));
});

/* -------------------- GAME STATE -------------------- */
const gameRooms = {};

/* -------------------- LOAD QUESTIONS -------------------- */
let oddOneInQuestions = {};
try {
  oddOneInQuestions = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'games/odd-one-in/questions.json'), 'utf8')
  );
} catch {
  console.log('⚠️ Using fallback questions');
}

/* -------------------- SOCKET -------------------- */
io.on('connection', (socket) => {
  console.log('🔌 Connected:', socket.id);

  /* ---------- JOIN ---------- */
  socket.on('joinGame', ({ roomId, playerName, isGameMaster, gameType }) => {
    if (!gameRooms[roomId]) {
      gameRooms[roomId] = {
        gameType,
        players: [],
        gameMaster: null,
        gameStarted: false,
        currentRound: 0,
        currentQuestion: null,
        answers: {},
        timerActive: false,
        timerPaused: false,
        timerInterval: null
      };
    }

    const room = gameRooms[roomId];

    if (!room.players.find(p => p.id === socket.id)) {
      const isGM = isGameMaster && room.players.length === 0;
      room.players.push({
        id: socket.id,
        name: playerName,
        eliminated: false,
        isGameMaster: isGM
      });

      if (isGM) room.gameMaster = socket.id;
    }

    socket.join(roomId);
    socket.roomId = roomId;

    io.to(roomId).emit('playerListUpdate', {
      players: room.players,
      gameMaster: room.gameMaster
    });

    socket.emit('roomJoined', {
      roomId,
      isGameMaster: socket.id === room.gameMaster,
      gameStarted: room.gameStarted
    });
  });

  /* ---------- REMOVE PLAYER ---------- */
  socket.on('removePlayer', ({ roomId, playerId }) => {
    const room = gameRooms[roomId];
    if (!room || socket.id !== room.gameMaster) return;

    room.players = room.players.filter(p => p.id !== playerId);
    io.to(playerId).emit('removedFromGame');

    io.to(roomId).emit('playerListUpdate', {
      players: room.players,
      gameMaster: room.gameMaster
    });
  });

  /* ---------- START GAME ---------- */
  socket.on('startGame', ({ roomId }) => {
    const room = gameRooms[roomId];
    if (!room || socket.id !== room.gameMaster || room.gameStarted) return;

    room.gameStarted = true;
    room.currentRound = 1;

    const question = selectQuestion(room.players.filter(p => !p.eliminated).length);
    room.currentQuestion = question;

    io.to(roomId).emit('gameStarted', {
      round: room.currentRound,
      question
    });

    setTimeout(() => startTimer(roomId), 2000);
  });

  /* ---------- SUBMIT ANSWER ---------- */
  socket.on('submitAnswer', ({ roomId, answer }) => {
    const room = gameRooms[roomId];
    if (!room || !room.timerActive || room.timerPaused) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.eliminated) return;

    if (room.answers[socket.id]) return; // prevent double submit

    room.answers[socket.id] = {
      playerId: socket.id,
      playerName: player.name,
      answer: answer.trim()
    };

    socket.emit('answerSubmitted');
  });

  /* ---------- TIMER CONTROLS ---------- */
  socket.on('pauseTimer', (roomId) => {
    const room = gameRooms[roomId];
    if (room && socket.id === room.gameMaster) {
      room.timerPaused = true;
      io.to(roomId).emit('timerPaused');
    }
  });

  socket.on('resumeTimer', (roomId) => {
    const room = gameRooms[roomId];
    if (room && socket.id === room.gameMaster) {
      room.timerPaused = false;
      io.to(roomId).emit('timerResumed');
    }
  });

  socket.on('skipQuestion', (roomId) => {
    if (socket.id === gameRooms[roomId]?.gameMaster) {
      endRound(roomId);
    }
  });

  socket.on('editQuestion', ({ roomId, newQuestion }) => {
    if (socket.id === gameRooms[roomId]?.gameMaster) {
      gameRooms[roomId].currentQuestion = newQuestion;
      io.to(roomId).emit('questionUpdated', { question: newQuestion });
    }
  });

  /* ---------- GM ELIMINATION ---------- */
  socket.on('eliminatePlayer', ({ roomId, playerId }) => {
    const room = gameRooms[roomId];
    if (!room || socket.id !== room.gameMaster) return;

    const player = room.players.find(p => p.id === playerId);
    if (player) player.eliminated = true;

    io.to(roomId).emit('playerListUpdate', {
      players: room.players,
      gameMaster: room.gameMaster
    });
  });

  /* ---------- NEXT ROUND ---------- */
  socket.on('nextRound', (roomId) => {
    if (socket.id === gameRooms[roomId]?.gameMaster) {
      nextRound(roomId);
    }
  });

  /* ---------- RESET ---------- */
  socket.on('resetGame', (roomId) => {
    const room = gameRooms[roomId];
    if (!room || socket.id !== room.gameMaster) return;

    clearInterval(room.timerInterval);

    room.players.forEach(p => p.eliminated = false);
    room.gameStarted = false;
    room.currentRound = 0;
    room.answers = {};
    room.timerActive = false;
    room.timerPaused = false;

    io.to(roomId).emit('gameReset');
  });

  /* ---------- DISCONNECT ---------- */
  socket.on('disconnect', () => {
    const room = gameRooms[socket.roomId];
    if (!room) return;

    room.players = room.players.filter(p => p.id !== socket.id);

    if (socket.id === room.gameMaster && room.players.length > 0) {
      room.players.forEach(p => p.isGameMaster = false);
      room.players[0].isGameMaster = true;
      room.gameMaster = room.players[0].id;
    }

    io.to(socket.roomId).emit('playerListUpdate', {
      players: room.players,
      gameMaster: room.gameMaster
    });

    if (room.players.length === 0) {
      delete gameRooms[socket.roomId];
    }
  });
});

/* -------------------- HELPERS -------------------- */

function selectQuestion(count) {
  let pool =
    count >= 10 ? oddOneInQuestions.tier1_broad?.questions :
    count >= 5  ? oddOneInQuestions.tier2_medium?.questions :
    count >= 3  ? oddOneInQuestions.tier3_narrow?.questions :
                  oddOneInQuestions.tier4_final?.questions;

  pool = pool || ['Say anything'];
  return pool[Math.floor(Math.random() * pool.length)];
}

function startTimer(roomId) {
  const room = gameRooms[roomId];
  if (!room) return;

  clearInterval(room.timerInterval);

  room.timerActive = true;
  room.timerPaused = false;
  let timeLeft = 10;

  io.to(roomId).emit('timerStarted', { timeLeft });

  room.timerInterval = setInterval(() => {
    if (!room.timerActive) return clearInterval(room.timerInterval);

    if (!room.timerPaused) {
      timeLeft--;
      io.to(roomId).emit('timerUpdate', { timeLeft });

      if (timeLeft <= 0) {
        clearInterval(room.timerInterval);
        room.timerActive = false;
        endRound(roomId);
      }
    }
  }, 1000);
}

function endRound(roomId) {
  const room = gameRooms[roomId];
  if (!room) return;

  // Ensure blanks exist
  room.players.forEach(p => {
    if (!p.eliminated && !room.answers[p.id]) {
      room.answers[p.id] = {
        playerId: p.id,
        playerName: p.name,
        answer: ""
      };
    }
  });

  io.to(roomId).emit('roundEnded', {
    answers: room.answers,
    answerGroups: groupAnswers(room.answers)
  });
}

function groupAnswers(answers) {
  const map = {};
  const duplicates = [];
  const uniques = [];
  const blanks = [];

  Object.values(answers).forEach(a => {
    if (!a.answer.trim()) {
      blanks.push(a);
      return;
    }

    const key = a.answer.toLowerCase().trim();
    map[key] = map[key] || [];
    map[key].push(a);
  });

  Object.values(map).forEach(group => {
    group.length > 1 ? duplicates.push(group) : uniques.push(group[0]);
  });

  duplicates.sort((a, b) => a[0].answer.localeCompare(b[0].answer));
  blanks.sort((a, b) => a.playerName.localeCompare(b.playerName));
  uniques.sort((a, b) => a.playerName.localeCompare(b.playerName));

  return { duplicates, blanks, uniques };
}

function nextRound(roomId) {
  const room = gameRooms[roomId];
  if (!room) return;

  room.answers = {};

  const alive = room.players.filter(p => !p.eliminated);
  if (alive.length <= 1) {
    io.to(roomId).emit('gameEnded', {
      winner: alive[0] || null,
      players: room.players
    });
    return;
  }

  room.currentRound++;
  room.currentQuestion = selectQuestion(alive.length);

  io.to(roomId).emit('nextRound', {
    round: room.currentRound,
    question: room.currentQuestion
  });

  setTimeout(() => startTimer(roomId), 2000);
}

/* -------------------- START -------------------- */
http.listen(PORT, () => {
  console.log(`🎮 Meenit's Playzone running on port ${PORT}`);
});
