# 🎮 Meenit's Playzone - Odd One In

A real-time multiplayer party game where players answer questions and try to match answers. The Game Master eliminates players with odd answers until one winner remains!

## 🌟 Features

- ✅ Real-time multiplayer gameplay with Socket.io
- 👑 Game Master controls (pause, skip, edit questions)
- 📱 Fully responsive design
- 🎨 Beautiful animated UI with playful theme
- ⏱️ Dynamic question tiers based on player count
- 🎯 Live answer submission tracking
- 🏆 Winner celebration with confetti

## 📁 Project Structure

```
meenits-playzone/
│
├── server.js                    # Express + Socket.io server
├── package.json
├── README.md
│
├── public/
│   ├── index.html              # Home page
│   ├── playzone.js             # Home page logic
│   ├── style.css               # Home page styles
│   └── images/
│       ├── meenit-logo.png
│       ├── odd-one-in-logo.png
│       ├── undercover-logo.png
│       └── mafia-logo.png
│
└── games/
    └── odd-one-in/
        ├── game.html           # Game interface
        ├── game.js             # Game logic
        ├── game-style.css      # Game styles
        └── questions.json      # Question bank
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm (v8 or higher)

### Installation

1. **Clone the repository**
```bash
git clone <your-repo-url>
cd meenits-playzone
```

2. **Install dependencies**
```bash
npm install
```

3. **Start the server**
```bash
npm start
```

4. **Open in browser**
```
http://localhost:3000
```

### Development Mode
```bash
npm run dev
```

## 🎮 How to Play

### Game Master (GM):
1. Click "Odd One In" on home page
2. Enter your name and click "Create Game"
3. Copy and share the invite link with players
4. Wait for players to join
5. Click "START GAME" when ready
6. Control the game using GM buttons:
   - ⏸ **Pause/Resume** - Control the timer
   - ⏭ **Skip** - Move to next question
   - ✏ **Edit** - Change current question
   - 👀 **Show Answers** - Reveal answers early
   - 🔁 **Restart** - Reset the entire game

7. Review answers and eliminate players
8. Continue until one winner remains!

### Players:
1. Open the invite link shared by GM
2. Enter your name and click "Join Game"
3. Wait for GM to start
4. Answer questions within time limit
5. Try to match answers with other players
6. Survive eliminations to win!

## 📊 Question Tiers

The game automatically selects questions based on remaining players:

- **10+ players**: Broad questions (500+ options)
- **5-9 players**: Medium questions (50+ options)
- **3-4 players**: Narrow questions (30+ options)
- **2 players**: Final showdown questions (Yes/No style)

## 🌐 Deployment to Render

### Step 1: Prepare for Deployment

1. **Ensure your GitHub repository is up to date**
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

2. **Verify package.json has start script**
```json
"scripts": {
  "start": "node server.js"
}
```

### Step 2: Deploy on Render

1. **Sign up/Login to Render**
   - Go to [render.com](https://render.com)
   - Sign up with GitHub

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select your `meenits-playzone` repository

3. **Configure Service**
   ```
   Name: meenits-playzone (or your choice)
   Region: Choose closest to your users
   Branch: main
   Runtime: Node
   Build Command: npm install
   Start Command: npm start
   ```

4. **Environment Variables** (if needed)
   ```
   PORT: (Leave empty - Render provides this)
   NODE_ENV: production
   ```

5. **Create Web Service**
   - Click "Create Web Service"
   - Wait for deployment (3-5 minutes)

6. **Your app will be live at:**
   ```
   https://your-app-name.onrender.com
   ```

### Step 3: Update Invite Links

In `server.js`, update the invite link generation:

```javascript
socket.emit('roomCreated', { 
  roomId, 
  inviteLink: `https://your-app-name.onrender.com/odd-one-in?room=${roomId}` 
});
```

### Troubleshooting Deployment

**Issue: App doesn't start**
- Check Render logs for errors
- Verify `package.json` start script
- Ensure all dependencies are in `dependencies` (not `devDependencies`)

**Issue: WebSocket connection fails**
- Render automatically handles WebSocket connections
- Ensure you're using `https://` in production URLs
- Check if firewall is blocking WebSocket connections

**Issue: Images not loading**
- Verify image paths are correct
- Ensure `public` folder is properly structured
- Check if images are committed to Git

## 🛠️ Technical Stack

- **Backend**: Node.js, Express.js
- **Real-time**: Socket.io
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Styling**: Custom CSS with animations
- **Fonts**: Google Fonts (Fredoka, Chewy)

## 🎨 Customization

### Change Timer Duration
In `server.js`, modify:
```javascript
timerDuration: 10, // Change to desired seconds
```

### Add Custom Questions
Edit `games/odd-one-in/questions.json`:
```json
{
  "tier1_broad": {
    "questions": [
      "Your custom question here"
    ]
  }
}
```

### Change Theme Colors
Edit `games/odd-one-in/game-style.css`:
```css
.primary-btn {
  background: linear-gradient(135deg, #your-color-1, #your-color-2);
}
```

## 📝 Game Flow

1. **Name Screen** → Enter name
2. **Lobby** → Wait for players
3. **Question Phase** → Answer within time
4. **Review Phase** → GM eliminates players
5. **Repeat 3-4** → Until one winner
6. **Winner Screen** → Celebrate! 🎉

## 🔒 Security Notes

- Room IDs are randomly generated (6 characters)
- GM-only actions are validated server-side
- Player removal requires GM authentication
- No persistent data storage (privacy-friendly)

## 🐛 Known Issues & Future Improvements

- [ ] Add sound effects
- [ ] Implement reconnection logic
- [ ] Add player statistics
- [ ] Create mobile app version
- [ ] Add more game modes

## 📄 License

MIT License - Feel free to use and modify!

## 👨‍💻 Author

Made with ❤️ by **Meenit Doshi**

---

## 🆘 Support

Having issues? 
1. Check the Render logs
2. Verify all files are properly uploaded
3. Ensure Socket.io is properly installed
4. Check browser console for errors

## 🎉 Enjoy the Game!

Share with friends and have fun! 🎮✨
