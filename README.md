# 📝 Realtime Whiteboard

A real-time collaborative whiteboard application built with React, Node.js, Express, and Socket.io. Create rooms, share the room ID with others, and start drawing together instantly. 🎨

---

## 🤔 What is this?

This is a whiteboard app where multiple people can draw on the same canvas in real-time. Think of it like a shared piece of paper where everyone can see what others are drawing as they draw it. It's great for:

- 💡 Brainstorming with your team
- 📚 Teaching or tutoring online
- 💬 Quick visual discussions
- 🎯 Any time you need to draw something together

---

## ✨ Features

Here's what you can do with this whiteboard:

### 🖌️ Drawing
- Freehand brush with adjustable stroke size
- Eraser to remove parts of your drawing
- Text tool to add labels or notes
- Shape tools: lines, rectangles, circles, and arrows

### 👥 Collaboration
- Create a room and get a unique room ID
- Share that ID with anyone you want to collaborate with
- Everyone sees drawings in real-time
- Works with as many people as you want

### 🎁 Extras
- 9 preset colors plus a custom color picker
- Undo your last action
- Export your drawing as a PNG image
- Dark mode and light mode
- Keyboard shortcuts (B for brush, E for eraser, and so on)

---

## 🛠️ Tech Stack

This project uses:

- **Frontend**: React 19 ⚛️, Vite 7 ⚡, Socket.io-client 🔌
- **Backend**: Node.js 🟢, Express 🚀, Socket.io 4 🔌

---

## 🚀 Getting Started

### Prerequisites

You need Node.js installed on your machine (version 18 or higher).

### Installation

1. First, install the server dependencies:
   ```bash
   cd server
   npm install
   ```

2. Then install the client dependencies:
   ```bash
   cd ../client
   npm install
   ```

### Running the App

1. Start the server:
   ```bash
   cd server
   npm run dev
   ```
   Server runs on http://localhost:5000

2. In a new terminal, start the client:
   ```bash
   cd client
   npm run dev
   ```
   Client runs on http://localhost:5173

3. Open your browser to http://localhost:5173
4. Enter a room ID or click "New Room" to create one
5. Share the room ID with others to collaborate

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| B | Brush 🖌️ |
| E | Eraser 🧹 |
| T | Text 📝 |
| L | Line ➖ |
| R | Rectangle ▢ |
| C | Circle ⭕ |
| A | Arrow ➡️ |
| Z | Undo ↩️ |
| S | Export as PNG 💾 |

---

## 📁 Project Structure

```
realtime-whiteboard/
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.jsx       # Main component
│   │   └── App.css       # Styles
│   ├── package.json
│   └── vite.config.js
│
├── server/                 # Node.js backend
│   ├── server.js         # Socket.io server
│   └── package.json
│
└── README.md
```

---

## 🔌 Socket Events

The server handles these Socket.io events:

- `join-room` — Join a room 🚪
- `start-draw`, `drawing`, `end-draw` — Drawing sync ✏️
- `start-shape`, `drawing-shape`, `end-shape` — Shape drawing 📐
- `clear`, `clear-canvas` — Clear canvas 🗑️
- `draw-text` — Add text 📃
- `undo`, `redo` — History actions 🔄
- `cursor-move` — Track cursor position 🖱️
- `disconnect` — User left 👋

---

## ⚙️ Customization

**Server port**: Edit `server/server.js` and change `5000` to your desired port.

**Client socket URL**: Edit `client/src/App.jsx` and change the `SOCKET_URL` constant.

---

## 📜 License

ISC License — feel free to use this for any purpose.

---

Made with ❤️ for real-time collaboration

