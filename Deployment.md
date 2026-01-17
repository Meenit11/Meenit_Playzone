# 🚀 Deployment Guide

## 📁 File Structure on GitHub

Upload files to your `Meenit_Playzone` repository with this **exact structure**:

```
Meenit_Playzone/
│
├── package.json
├── server.js
├── README.md
├── DEPLOYMENT.md
│
├── public/
│   ├── index.html
│   ├── style.css
│   └── playground.js
│
└── games/
    └── odd-one-in/
        ├── game.html
        ├── game-style.css
        ├── game.js
        └── questions.json
```

## ✅ Step-by-Step Upload to GitHub

### Option 1: Via GitHub Website

1. Go to your repository: `github.com/yourusername/Meenit_Playzone`
2. Click "Add file" → "Upload files"
3. **Upload root files first:**
   - `package.json`
   - `server.js`
   - `README.md`
   - `DEPLOYMENT.md`

4. **Create `public/` folder:**
   - Click "Add file" → "Create new file"
   - Type `public/index.html` in the name field
   - Paste content
   - Repeat for `style.css` and `playground.js`

5. **Create `games/odd-one-in/` folder:**
   - Click "Add file" → "Create new file"
   - Type `games/odd-one-in/game.html`
   - Paste content
   - Repeat for other game files

### Option 2: Via Git Command Line

```bash
# Clone your repo
git clone https://github.com/yourusername/Meenit_Playzone.git
cd Meenit_Playzone

# Create folder structure
mkdir -p public
mkdir -p games/odd-one-in

# Copy all files to their locations
# (paste files into respective folders)

# Commit and push
git add .
git commit -m "Complete restructure with new UI"
git push origin main
```

## 🔗 Render.com Deployment

Your Render service should **auto-deploy** when you push to GitHub.

If it doesn't:
1. Go to render.com dashboard
2. Click your service "meenit-playzone"
3. Click "Manual Deploy" → "Deploy latest commit"

### Render Settings (verify these):
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Environment:** Node
- **Branch:** main

## 🧪 Testing After Deployment

1. **Homepage Test:**
   - Visit `meenit-playzone.onrender.com`
   - Should see beautiful playground with Odd One In card

2. **Game Test (as Game Master):**
   - Click "Odd One In"
   - Enter name
   - Get invite link
   - Share link in incognito tab
   - Join with different name
   - Start game and test

3. **Timer Test:**
   - Make sure timer counts from 10 → 0
   - No freezing at 2 seconds
   - Answer submission works

## 🐛 Common Issues

### Issue: "Cannot GET /odd-one-in"
**Fix:** Make sure `games/odd-one-in/game.html` exists

### Issue: CSS not loading
**Fix:** Check file paths in `server.js`:
```javascript
app.use(express.static('public'));
app.use('/games', express.static('games'));
```

### Issue: Timer freezes
**Fix:** Server restarts reset all game state. This is normal on Render's free tier.

### Issue: Players can't join
**Fix:** Make sure room ID is in URL: `/odd-one-in?room=XXXXXX`

## 📊 Monitoring

After deployment, monitor in Render dashboard:
- **Logs:** Check for errors
- **Metrics:** CPU/Memory usage
- **Events:** Deployment history

## 🎉 Success!

If you see:
```
✅ Homepage loads with playground
✅ Game Master can create games
✅ Players can join via link
✅ Timer works smoothly
✅ Game flows from start to winner
```

**You're live! Share with friends! 🎮**

---

## 🆘 Need Help?

If something breaks:
1. Check Render logs
2. Verify file structure matches exactly
3. Make sure all files uploaded correctly
4. Try manual deploy on Render
