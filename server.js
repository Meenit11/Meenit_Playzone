const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

let players = {};
let hostId = null;

io.on("connection", (socket) => {
  if (!hostId) {
    hostId = socket.id;
    socket.emit("isHost", true);
  }

  socket.on("joinGame", (name) => {
    players[socket.id] = { id: socket.id, name, status: "alive", answer: "" };
    io.emit("updatePlayers", Object.values(players));
  });

  socket.on("startTimer", () => {
    if (socket.id !== hostId) return;
    let count = 10;
    io.emit("timerUpdate", count);
    const timer = setInterval(() => {
      count--;
      io.emit("timerUpdate", count);
      if (count <= 0) {
        clearInterval(timer);
        io.emit("timeUp");
      }
    }, 1000);
  });

  socket.on("submitAnswer", (ans) => {
    if (players[socket.id]) players[socket.id].answer = ans.trim();
    io.emit("updatePlayers", Object.values(players));
  });

  socket.on("toggleStatus", (id) => {
    if (socket.id === hostId && players[id]) {
      players[id].status = (players[id].status === "alive") ? "out" : "alive";
      io.emit("updatePlayers", Object.values(players));
    }
  });

  socket.on("resetGame", () => {
    if (socket.id !== hostId) return;
    for (let id in players) {
      players[id].status = "alive";
      players[id].answer = "";
    }
    io.emit("updatePlayers", Object.values(players));
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    if (socket.id === hostId) hostId = Object.keys(players)[0] || null;
    io.emit("updatePlayers", Object.values(players));
  });
});

server.listen(process.env.PORT || 3000);
