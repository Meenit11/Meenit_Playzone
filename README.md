# 🎪 Meenit's Playzone

A multiplayer game hub where friends can play fun real-time games together!

## 📁 Project Structure

```
Meenit_Playzone/
├── server.js                    # Main Express + Socket.IO server
├── package.json                 # Dependencies
├── README.md                    # This file
│
├── public/                      # Main playground (homepage)
│   ├── index.html              # Playground homepage
│   ├── style.css               # Playground styles
│   └── playground.js           # Playground logic
│
└── games/                       # Individual games folder
    └── odd-one-in/             # Odd One In game
        ├── game.html           # Game interface
        ├── game-style.css      # Game styles
        ├── game.js             # Game logic
        └── questions.json      # Question bank (280+ questions)
```

## 🎮 Current Games

### 1. Odd One In 🎯
**Don't match anyone else's answer!**
- 2-20 players
- 10-second rounds
- Smart question selection based on player count
- Game Master controls (pause, skip, edit, eliminate)
- Last unique player wins!

## 🚀 How to Deploy on Render

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Restructured project with better UI"
   git push
   ```

2. **Render Settings:**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: Node

3. **Your game will be live at:**
   - Homepage: `meenit-playzone.onrender.com`
   - Odd One In: `meenit-playzone.onrender.com/odd-one-in?room=XXXXXX`

## 🎯 How to Play (Game Master)

1. Visit the homepage
2. Click "ODD ONE IN"
3. Enter your name
4. Share the invite link with friends
5. Wait for everyone to join
6. Click "START GAME"
7. Control the game with GM powers!

## 🎯 How to Play (Regular Players)

1. Click the invite link from Game Master
2. Enter your name
3. Wait for GM to start
4. Answer questions uniquely!
5. Don't match anyone!

## ✨ Features

### For Everyone:
- ✅ Beautiful, modern UI
- ✅ Real-time multiplayer
- ✅ Mobile-friendly
- ✅ No login required
- ✅ Instant play

### For Game Master:
- ✅ Control panel with pause/resume
- ✅ Skip or edit questions
- ✅ Remove players from lobby
- ✅ Manual elimination control
- ✅ Reset game anytime

### Smart Question System:
- **10+ players:** Broad questions (fruits, movies, brands)
- **5-9 players:** Medium questions (directions, colors)
- **3-4 players:** Narrow questions (yes/no, binary)
- **2 players:** Final showdown questions

## 🔮 Future Games

- Game 2: Coming Soon
- Game 3: Coming Soon

## 📝 Adding New Games

1. Create a new folder in `games/`
2. Add `game.html`, `game-style.css`, `game.js`
3. Add route in `server.js`
4. Update `public/index.html` with new game card
5. Deploy!

## 🛠️ Tech Stack

- **Backend:** Node.js + Express
- **Real-time:** Socket.IO
- **Frontend:** Vanilla JS (no frameworks!)
- **Styling:** Pure CSS with modern gradients
- **Hosting:** Render.com

Made with ❤️ by Meenit

---

**Current Version:** 1.0.0  
**Last Updated:** January 2026
