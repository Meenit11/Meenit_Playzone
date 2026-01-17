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

app.get('/undercover', (req, res) => {
  res.sendFile(path.join(__dirname, 'games', 'undercover', 'game.html'));
});

app.get('/mafia', (req, res) => {
  res.sendFile(path.join(__dirname, 'games', 'mafia', 'game.html'));
});

// Game state
let gameRooms = {};

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join game room
  socket.on('joinGame', (data) => {
    const { roomId, playerName, isGameMaster, gameType } = data;
    
    if (!gameRooms[roomId]) {
      gameRooms[roomId] = {
        gameType: gameType,
        players: [],
        gameMaster: null,
        gameStarted: false,
        gameState: {}
      };
    }

    const room = gameRooms[roomId];
    
    const existingPlayer = room.players.find(p => p.id === socket.id);
    if (!existingPlayer) {
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

  // Generic game events - can be extended per game
  socket.on('startGame', (data) => {
    const room = gameRooms[data.roomId];
    if (room && socket.id === room.gameMaster) {
      room.gameStarted = true;
      io.to(data.roomId).emit('gameStarted', data);
    }
  });

  socket.on('gameAction', (data) => {
    io.to(data.roomId).emit('gameUpdate', data);
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

http.listen(PORT, () => {
  console.log(`🎪 Meenit's Playzone running on port ${PORT}`);
});
