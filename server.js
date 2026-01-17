const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');
const path = require('path');

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

// Game state
let gameRooms = {};

// Load questions for Odd One In
let oddOneInQuestions = JSON.parse(fs.readFileSync(path.join(__dirname, 'games', 'odd-one-in', 'questions.json'), 'utf8'));

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join game room
  socket.on('joinGame', (data) => {
    const { roomId, playerName, isGameMaster } = data;
    
    if (!gameRooms[roomId]) {
      gameRooms[roomId] = {
        players: [],
        gameMaster: null,
        gameStarted: false,
        currentRound: 0,
        currentQuestion: null,
        answers: {},
        timerActive: false,
        timerPaused: false,
        currentTimerInterval: null
      };
    }

    const room = gameRooms[roomId];
    
    // Check if player already exists
    const existingPlayer = room.players.find(p => p.id === socket.id);
    if (!existingPlayer) {
      // Only first person in empty room becomes Game Master
      const canBeGameMaster = isGameMaster && room.players.length === 0;
      
      const player = {
        id: socket.id,
        name: playerName,
        isGameMaster: canBeGameMaster,
        eliminated: false
      };
      
      room.players.push(player);
      
      if (canBeGameMaster) {
        room.gameMaster = socket.id;
      }
    }

    socket.join(roomId);
    socket.roomId = roomId;
    
    io.to(roomId).emit('playerListUpdate', {
      players: room.players,
      gameMaster: room.gameMaster
    });
    
    socket.emit('roomJoined', {
      roomId: roomId,
      isGameMaster: socket.id === room.gameMaster,
      gameStarted: room.gameStarted
    });
  });

  // Remove player
  socket.on('removePlayer', (data) => {
    const { roomId, playerId } = data;
    const room = gameRooms[roomId];
    
    if (room && socket.id === room.gameMaster) {
      room.players = room.players.filter(p => p.id !== playerId);
      io.to(playerId).emit('removedFromGame');
      
      io.to(roomId).emit('playerListUpdate', {
        players: room.players,
        gameMaster: room.gameMaster
      });
    }
  });

  // Start game
  socket.on('startGame', (roomId) => {
    const room = gameRooms[roomId];
    
    if (room && socket.id === room.gameMaster && !room.gameStarted) {
      room.gameStarted = true;
      room.currentRound = 1;
      
      const activePlayers = room.players.filter(p => !p.eliminated).length;
      const question = selectQuestion(activePlayers);
      room.currentQuestion = question;
      
      io.to(roomId).emit('gameStarted', {
        round: room.currentRound,
        question: question
      });
      
      setTimeout(() => {
        if (room && room.gameStarted) {
          startTimer(roomId);
        }
      }, 2000);
    }
  });

  // Submit answer
  socket.on('submitAnswer', (data) => {
    const { roomId, answer } = data;
    const room = gameRooms[roomId];
    
    if (room && room.timerActive && !room.timerPaused) {
      const player = room.players.find(p => p.id === socket.id);
      if (player && !player.eliminated && !room.answers[socket.id]) {
        room.answers[socket.id] = {
          playerName: player.name,
          answer: answer.trim(),
          playerId: socket.id
        };
        
        socket.emit('answerSubmitted', { answer: answer });
      }
    }
  });

  // Game Master controls
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
    const room = gameRooms[roomId];
    if (room && socket.id === room.gameMaster) {
      if (room.currentTimerInterval) {
        clearInterval(room.currentTimerInterval);
        room.timerActive = false;
      }
      nextRound(roomId);
    }
  });

  socket.on('editQuestion', (data) => {
    const { roomId, newQuestion } = data;
    const room = gameRooms[roomId];
    if (room && socket.id === room.gameMaster) {
      room.currentQuestion = newQuestion;
      io.to(roomId).emit('questionUpdated', { question: newQuestion });
    }
  });

  socket.on('eliminatePlayer', (data) => {
    const { roomId, playerId } = data;
    const room = gameRooms[roomId];
    
    if (room && socket.id === room.gameMaster) {
      const player = room.players.find(p => p.id === playerId);
      if (player) {
        player.eliminated = true;
        io.to(roomId).emit('playerEliminated', {
          playerId: playerId,
          playerName: player.name
        });
        
        io.to(roomId).emit('playerListUpdate', {
          players: room.players,
          gameMaster: room.gameMaster
        });
      }
    }
  });

  socket.on('nextRound', (roomId) => {
    const room = gameRooms[roomId];
    if (room && socket.id === room.gameMaster) {
      nextRound(roomId);
    }
  });

  socket.on('resetGame', (roomId) => {
    const room = gameRooms[roomId];
    if (room && socket.id === room.gameMaster) {
      if (room.currentTimerInterval) {
        clearInterval(room.currentTimerInterval);
      }
      
      room.players.forEach(p => {
        p.eliminated = false;
      });
      room.currentRound = 0;
      room.gameStarted = false;
      room.answers = {};
      room.timerActive = false;
      room.timerPaused = false;
      
      io.to(roomId).emit('gameReset');
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    if (socket.roomId) {
      const room = gameRooms[socket.roomId];
      if (room) {
        room.players = room.players.filter(p => p.id !== socket.id);
        
        if (socket.id === room.gameMaster && room.players.length > 0) {
          room.gameMaster = room.players[0].id;
          room.players[0].isGameMaster = true;
        }
        
        io.to(socket.roomId).emit('playerListUpdate', {
          players: room.players,
          gameMaster: room.gameMaster
        });
        
        if (room.players.length === 0) {
          delete gameRooms[socket.roomId];
        }
      }
    }
  });
});

// Helper functions
function selectQuestion(playerCount) {
  let tier;
  if (playerCount >= 10) {
    tier = oddOneInQuestions.tier1_broad.questions;
  } else if (playerCount >= 5) {
    tier = oddOneInQuestions.tier2_medium.questions;
  } else if (playerCount >= 3) {
    tier = oddOneInQuestions.tier3_narrow.questions;
  } else {
    tier = oddOneInQuestions.tier4_final.questions;
  }
  
  return tier[Math.floor(Math.random() * tier.length)];
}

function startTimer(roomId) {
  const room = gameRooms[roomId];
  if (!room) return;
  
  if (room.currentTimerInterval) {
    clearInterval(room.currentTimerInterval);
  }
  
  room.timerActive = true;
  room.timerPaused = false;
  let timeLeft = 10;
  
  io.to(roomId).emit('timerStarted', { timeLeft: timeLeft });
  
  room.currentTimerInterval = setInterval(() => {
    if (!room || !room.timerActive) {
      clearInterval(room.currentTimerInterval);
      return;
    }
    
    if (!room.timerPaused) {
      timeLeft--;
      io.to(roomId).emit('timerUpdate', { timeLeft: timeLeft });
      
      if (timeLeft <= 0) {
        clearInterval(room.currentTimerInterval);
        room.timerActive = false;
        endRound(roomId);
      }
    }
  }, 1000);
}

function endRound(roomId) {
  const room = gameRooms[roomId];
  if (!room) return;
  
  room.players.forEach(player => {
    if (!player.eliminated && !room.answers[player.id]) {
      player.eliminated = true;
    }
  });
  
  const answerGroups = groupAnswers(room.answers);
  
  io.to(roomId).emit('roundEnded', {
    answers: room.answers,
    answerGroups: answerGroups
  });
  
  io.to(roomId).emit('playerListUpdate', {
    players: room.players,
    gameMaster: room.gameMaster
  });
}

function groupAnswers(answers) {
  const groups = {
    duplicates: [],
    unique: []
  };
  
  const answerMap = {};
  
  Object.values(answers).forEach(ans => {
    const key = ans.answer.toLowerCase().trim();
    if (!answerMap[key]) {
      answerMap[key] = [];
    }
    answerMap[key].push(ans);
  });
  
  Object.entries(answerMap).forEach(([key, players]) => {
    if (players.length > 1) {
      groups.duplicates.push({
        answer: key,
        players: players,
        count: players.length
      });
    } else {
      groups.unique.push(players[0]);
    }
  });
  
  return groups;
}

function nextRound(roomId) {
  const room = gameRooms[roomId];
  if (!room) return;
  
  if (room.currentTimerInterval) {
    clearInterval(room.currentTimerInterval);
    room.timerActive = false;
  }
  
  room.answers = {};
  
  const activePlayers = room.players.filter(p => !p.eliminated);
  
  if (activePlayers.length <= 1) {
    io.to(roomId).emit('gameEnded', {
      winner: activePlayers.length === 1 ? activePlayers[0] : null,
      players: room.players
    });
    return;
  }
  
  room.currentRound++;
  const question = selectQuestion(activePlayers.length);
  room.currentQuestion = question;
  
  io.to(roomId).emit('nextRound', {
    round: room.currentRound,
    question: question
  });
  
  setTimeout(() => {
    if (room && room.gameStarted) {
      startTimer(roomId);
    }
  }, 2000);
}

http.listen(PORT, () => {
  console.log(`🎪 Meenit's Playzone running on port ${PORT}`);
});
