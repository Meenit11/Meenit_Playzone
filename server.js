// server.js - Meenit's Playzone Server
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));
app.use('/games', express.static('games'));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/odd-one-in', (req, res) => {
  res.sendFile(path.join(__dirname, 'games', 'odd-one-in', 'game.html'));
});

app.get('/undercover', (req, res) => {
  res.sendFile(path.join(__dirname, 'games', 'undercover', 'game.html'));
});

app.get('/mafia', (req, res) => {
  res.sendFile(path.join(__dirname, 'games', 'mafia', 'game.html'));
});

// Game State Storage
const rooms = new Map();

// Helper Functions
function getQuestionTier(playerCount) {
  if (playerCount >= 10) return 'tier1_broad';
  if (playerCount >= 5) return 'tier2_medium';
  if (playerCount >= 3) return 'tier3_narrow';
  return 'tier4_showdown';
}

function getRandomQuestion(tier, usedQuestions) {
  const questionsPath = path.join(__dirname, 'games', 'odd-one-in', 'questions.json');
  const questionsData = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
  
  const availableQuestions = questionsData[tier].questions.filter(
    q => !usedQuestions.includes(q)
  );
  
  if (availableQuestions.length === 0) {
    return null; // All questions used
  }
  
  return availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
}

// Socket.io Connection
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Create Room
  socket.on('createRoom', ({ roomId, playerName, game }) => {
    if (rooms.has(roomId)) {
      socket.emit('error', { message: 'Room already exists' });
      return;
    }

    const room = {
      id: roomId,
      game: game,
      gm: socket.id,
      gmName: playerName,
      players: [{ id: socket.id, name: playerName, isGM: true, eliminated: false }],
      state: 'lobby',
      currentQuestion: null,
      answers: {},
      usedQuestions: [],
      timer: null,
      timerDuration: 10,
      isPaused: false,
      timeRemaining: 10
    };

    rooms.set(roomId, room);
    socket.join(roomId);
    
    socket.emit('roomCreated', { 
      roomId, 
      inviteLink: `${req.headers.host || 'localhost:3000'}/odd-one-in?room=${roomId}` 
    });
    
    io.to(roomId).emit('updatePlayers', room.players);
  });

  // Join Room
  socket.on('joinRoom', ({ roomId, playerName }) => {
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (room.state !== 'lobby') {
      socket.emit('error', { message: 'Game already in progress' });
      return;
    }

    const playerExists = room.players.some(p => p.name === playerName);
    if (playerExists) {
      socket.emit('error', { message: 'Name already taken' });
      return;
    }

    room.players.push({ 
      id: socket.id, 
      name: playerName, 
      isGM: false, 
      eliminated: false 
    });
    
    socket.join(roomId);
    socket.emit('joinedRoom', { roomId, isGM: false });
    io.to(roomId).emit('updatePlayers', room.players);
  });

  // Remove Player (GM only)
  socket.on('removePlayer', ({ roomId, playerId }) => {
    const room = rooms.get(roomId);
    if (!room || room.gm !== socket.id) return;

    room.players = room.players.filter(p => p.id !== playerId);
    
    const playerSocket = io.sockets.sockets.get(playerId);
    if (playerSocket) {
      playerSocket.leave(roomId);
      playerSocket.emit('kicked');
    }
    
    io.to(roomId).emit('updatePlayers', room.players);
  });

  // Start Game
  socket.on('startGame', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.gm !== socket.id) return;

    if (room.players.length < 2) {
      socket.emit('error', { message: 'Need at least 2 players to start' });
      return;
    }

    room.state = 'question';
    room.answers = {};
    
    const activePlayers = room.players.filter(p => !p.eliminated).length;
    const tier = getQuestionTier(activePlayers);
    room.currentQuestion = getRandomQuestion(tier, room.usedQuestions);
    
    if (room.currentQuestion) {
      room.usedQuestions.push(room.currentQuestion);
    }

    room.timeRemaining = room.timerDuration;
    
    io.to(roomId).emit('gameStarted', {
      question: room.currentQuestion,
      timeRemaining: room.timeRemaining
    });

    startTimer(roomId);
  });

  // Submit Answer
  socket.on('submitAnswer', ({ roomId, answer }) => {
    const room = rooms.get(roomId);
    if (!room || room.state !== 'question') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.eliminated) return;

    room.answers[socket.id] = {
      playerName: player.name,
      answer: answer.trim(),
      isGM: player.isGM
    };

    socket.emit('answerSubmitted');
    
    // Notify GM of submission count
    const submissionCount = Object.keys(room.answers).length;
    const activeCount = room.players.filter(p => !p.eliminated).length;
    io.to(room.gm).emit('submissionUpdate', { 
      submitted: submissionCount, 
      total: activeCount 
    });
  });

  // Pause Timer
  socket.on('pauseTimer', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.gm !== socket.id) return;

    room.isPaused = true;
    if (room.timer) {
      clearInterval(room.timer);
      room.timer = null;
    }
    io.to(roomId).emit('timerPaused', { timeRemaining: room.timeRemaining });
  });

  // Resume Timer
  socket.on('resumeTimer', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.gm !== socket.id || !room.isPaused) return;

    room.isPaused = false;
    startTimer(roomId);
    io.to(roomId).emit('timerResumed', { timeRemaining: room.timeRemaining });
  });

  // Show Answers (Manual)
  socket.on('showAnswers', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.gm !== socket.id) return;

    if (room.timer) {
      clearInterval(room.timer);
      room.timer = null;
    }

    room.state = 'review';
    const sortedAnswers = sortAnswers(room.answers);
    io.to(roomId).emit('answersRevealed', { answers: sortedAnswers });
  });

  // Skip Question
  socket.on('skipQuestion', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.gm !== socket.id) return;

    if (room.timer) {
      clearInterval(room.timer);
      room.timer = null;
    }

    nextQuestion(roomId);
  });

  // Edit Question
  socket.on('editQuestion', ({ roomId, newQuestion }) => {
    const room = rooms.get(roomId);
    if (!room || room.gm !== socket.id) return;

    room.currentQuestion = newQuestion;
    room.answers = {};
    room.timeRemaining = room.timerDuration;

    if (room.timer) {
      clearInterval(room.timer);
      room.timer = null;
    }

    io.to(roomId).emit('questionEdited', { 
      question: newQuestion,
      timeRemaining: room.timeRemaining
    });

    startTimer(roomId);
  });

  // Eliminate Players
  socket.on('eliminatePlayers', ({ roomId, playerIds }) => {
    const room = rooms.get(roomId);
    if (!room || room.gm !== socket.id) return;

    playerIds.forEach(playerId => {
      const player = room.players.find(p => p.id === playerId);
      if (player) {
        player.eliminated = true;
      }
    });

    io.to(roomId).emit('playersEliminated', { 
      eliminatedIds: playerIds,
      players: room.players 
    });

    // Check for winner
    const activePlayers = room.players.filter(p => !p.eliminated);
    if (activePlayers.length === 1) {
      room.state = 'ended';
      io.to(roomId).emit('gameEnded', { winner: activePlayers[0] });
    }
  });

  // Next Question
  socket.on('nextQuestion', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.gm !== socket.id) return;

    nextQuestion(roomId);
  });

  // Restart Game
  socket.on('restartGame', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.gm !== socket.id) return;

    room.players.forEach(p => p.eliminated = false);
    room.state = 'lobby';
    room.answers = {};
    room.usedQuestions = [];
    room.currentQuestion = null;

    if (room.timer) {
      clearInterval(room.timer);
      room.timer = null;
    }

    io.to(roomId).emit('gameRestarted');
    io.to(roomId).emit('updatePlayers', room.players);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    rooms.forEach((room, roomId) => {
      const player = room.players.find(p => p.id === socket.id);
      
      if (player) {
        if (player.isGM) {
          // GM left - end game
          io.to(roomId).emit('gmLeft');
          rooms.delete(roomId);
        } else {
          // Regular player left
          room.players = room.players.filter(p => p.id !== socket.id);
          io.to(roomId).emit('updatePlayers', room.players);
        }
      }
    });
  });
});

// Timer Function
function startTimer(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.timer = setInterval(() => {
    if (room.isPaused) return;

    room.timeRemaining--;
    io.to(roomId).emit('timerUpdate', { timeRemaining: room.timeRemaining });

    if (room.timeRemaining <= 0) {
      clearInterval(room.timer);
      room.timer = null;
      room.state = 'review';
      
      const sortedAnswers = sortAnswers(room.answers);
      io.to(roomId).emit('answersRevealed', { answers: sortedAnswers });
    }
  }, 1000);
}

// Next Question Function
function nextQuestion(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  const activePlayers = room.players.filter(p => !p.eliminated);
  
  if (activePlayers.length === 1) {
    room.state = 'ended';
    io.to(roomId).emit('gameEnded', { winner: activePlayers[0] });
    return;
  }

  room.state = 'question';
  room.answers = {};
  
  const tier = getQuestionTier(activePlayers.length);
  room.currentQuestion = getRandomQuestion(tier, room.usedQuestions);
  
  if (!room.currentQuestion) {
    // All questions exhausted
    room.currentQuestion = "Name something random!";
  } else {
    room.usedQuestions.push(room.currentQuestion);
  }

  room.timeRemaining = room.timerDuration;
  
  io.to(roomId).emit('nextQuestion', {
    question: room.currentQuestion,
    timeRemaining: room.timeRemaining
  });

  startTimer(roomId);
}

// Sort Answers Helper
function sortAnswers(answers) {
  const answersArray = Object.entries(answers).map(([id, data]) => ({
    playerId: id,
    playerName: data.playerName,
    answer: data.answer,
    isGM: data.isGM
  }));

  return answersArray.sort((a, b) => {
    // Blank answers first
    if (!a.answer && b.answer) return -1;
    if (a.answer && !b.answer) return 1;
    if (!a.answer && !b.answer) return 0;

    // Alphabetical order (case-insensitive)
    return a.answer.toLowerCase().localeCompare(b.answer.toLowerCase());
  });
}

// Start Server
server.listen(PORT, () => {
  console.log(`🎮 Meenit's Playzone running on port ${PORT}`);
});
