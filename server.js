const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fs = require('fs');

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// Game state
let gameRooms = {};

// Load questions
let questions = JSON.parse(fs.readFileSync('questions.json', 'utf8'));

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join game room
  socket.on('joinGame', (data) => {
    const { roomId, playerName, isGameMaster } = data;
    
    if (!gameRooms[roomId]) {
      gameRooms[roomId] = {
        players: [],
        gameMaster: null,
        moderator: null,
        gameStarted: false,
        currentRound: 0,
        currentQuestion: null,
        answers: {},
        eliminated: [],
        timerActive: false,
        timerPaused: false
      };
    }

    const room = gameRooms[roomId];
    
    // Check if player already exists
    const existingPlayer = room.players.find(p => p.id === socket.id);
    if (!existingPlayer) {
      const player = {
        id: socket.id,
        name: playerName,
        isGameMaster: isGameMaster,
        eliminated: false
      };
      
      room.players.push(player);
      
      if (isGameMaster) {
        room.gameMaster = socket.id;
      }
    }

    socket.join(roomId);
    socket.roomId = roomId;
    
    // Send updated player list to everyone
    io.to(roomId).emit('playerListUpdate', {
      players: room.players,
      gameMaster: room.gameMaster
    });
    
    // Send room state to the joining player
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
      
      // Disconnect the removed player
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
    
    if (room && socket.id === room.gameMaster) {
      room.gameStarted = true;
      room.currentRound = 1;
      
      // Select appropriate question based on player count
      const activePlayers = room.players.filter(p => !p.eliminated).length;
      const question = selectQuestion(activePlayers);
      room.currentQuestion = question;
      
      io.to(roomId).emit('gameStarted', {
        round: room.currentRound,
        question: question
      });
      
      // Show "Get Ready" message for 2 seconds, then start timer
      io.to(roomId).emit('showGetReady');
      
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
    
    if (room && room.timerActive) {
      const player = room.players.find(p => p.id === socket.id);
      if (player && !player.eliminated) {
        room.answers[socket.id] = {
          playerName: player.name,
          answer: answer.trim(),
          playerId: socket.id
        };
        
        // Notify player their answer was submitted
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
      // Clear current timer if running
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
      }
    }
  });

  socket.on('savePlayer', (data) => {
    const { roomId, playerId } = data;
    const room = gameRooms[roomId];
    
    if (room && socket.id === room.gameMaster) {
      const player = room.players.find(p => p.id === playerId);
      if (player) {
        player.saved = true;
        io.to(roomId).emit('playerSaved', {
          playerId: playerId,
          playerName: player.name
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
      // Reset all players
      room.players.forEach(p => {
        p.eliminated = false;
        p.saved = false;
      });
      room.currentRound = 0;
      room.gameStarted = false;
      room.answers = {};
      room.timerActive = false;
      
      io.to(roomId).emit('gameReset');
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove player from room
    if (socket.roomId) {
      const room = gameRooms[socket.roomId];
      if (room) {
        room.players = room.players.filter(p => p.id !== socket.id);
        
        // If game master left, assign new one
        if (socket.id === room.gameMaster && room.players.length > 0) {
          room.gameMaster = room.players[0].id;
          room.players[0].isGameMaster = true;
        }
        
        io.to(socket.roomId).emit('playerListUpdate', {
          players: room.players,
          gameMaster: room.gameMaster
        });
      }
    }
  });
});

// Helper functions
function selectQuestion(playerCount) {
  let tier;
  if (playerCount >= 10) {
    tier = questions.tier1_broad.questions;
  } else if (playerCount >= 5) {
    tier = questions.tier2_medium.questions;
  } else if (playerCount >= 3) {
    tier = questions.tier3_narrow.questions;
  } else {
    tier = questions.tier4_final.questions;
  }
  
  return tier[Math.floor(Math.random() * tier.length)];
}

function startTimer(roomId) {
  const room = gameRooms[roomId];
  if (!room) return;
  
  room.timerActive = true;
  room.timerPaused = false;
  let timeLeft = 10;
  
  io.to(roomId).emit('timerStarted', { timeLeft: timeLeft });
  
  const timerInterval = setInterval(() => {
    if (!room || !room.timerActive) {
      clearInterval(timerInterval);
      return;
    }
    
    if (!room.timerPaused) {
      timeLeft--;
      io.to(roomId).emit('timerUpdate', { timeLeft: timeLeft });
      
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        room.timerActive = false;
        endRound(roomId);
      }
    }
  }, 1000);
  
  // Store interval reference for potential cleanup
  room.currentTimerInterval = timerInterval;
}

function endRound(roomId) {
  const room = gameRooms[roomId];
  if (!room) return;
  
  // Eliminate players who didn't answer
  room.players.forEach(player => {
    if (!player.eliminated && !room.answers[player.id]) {
      player.eliminated = true;
    }
  });
  
  // Group answers
  const answerGroups = groupAnswers(room.answers);
  
  io.to(roomId).emit('roundEnded', {
    answers: room.answers,
    answerGroups: answerGroups
  });
}

function groupAnswers(answers) {
  const groups = {
    duplicates: [],
    similar: [],
    unique: []
  };
  
  const answerMap = {};
  
  // Group by exact match (case-insensitive)
  Object.values(answers).forEach(ans => {
    const key = ans.answer.toLowerCase();
    if (!answerMap[key]) {
      answerMap[key] = [];
    }
    answerMap[key].push(ans);
  });
  
  // Categorize
  Object.entries(answerMap).forEach(([key, players]) => {
    if (players.length > 1) {
      groups.duplicates.push({
        answer: key,
        players: players
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
  
  // Clear current timer if running
  if (room.currentTimerInterval) {
    clearInterval(room.currentTimerInterval);
    room.timerActive = false;
  }
  
  // Reset answers
  room.answers = {};
  
  // Check for winner
  const activePlayers = room.players.filter(p => !p.eliminated);
  
  if (activePlayers.length <= 1) {
    io.to(roomId).emit('gameEnded', {
      winner: activePlayers.length === 1 ? activePlayers[0] : null,
      players: room.players
    });
    return;
  }
  
  // Start next round
  room.currentRound++;
  const question = selectQuestion(activePlayers.length);
  room.currentQuestion = question;
  
  io.to(roomId).emit('nextRound', {
    round: room.currentRound,
    question: question
  });
  
  // Show "Get Ready" message for 2 seconds, then start timer
  io.to(roomId).emit('showGetReady');
  
  setTimeout(() => {
    if (room && room.gameStarted) {
      startTimer(roomId);
    }
  }, 2000);
}

http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
