const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    console.log(`User joined room: ${roomId}`);
    
    // Notify others in the room about new user
    socket.to(roomId).emit("user-joined", { userId: socket.id });
  });

  socket.on("start-draw", (data) => {
    socket.to(data.roomId).emit("start-draw", data);
  });

  socket.on("drawing", (data) => {
    socket.to(data.roomId).emit("drawing", data);
  });

  socket.on("end-draw", (data) => {
    socket.to(data.roomId).emit("end-draw", data);
  });

  // Cursor position tracking
  socket.on("cursor-move", (data) => {
    socket.to(data.roomId).emit("cursor-move", {
      userId: socket.id,
      x: data.x,
      y: data.y,
      color: data.color,
    });
  });

  // Shape drawing events
  socket.on("start-shape", (data) => {
    socket.to(data.roomId).emit("start-shape", data);
  });

  socket.on("drawing-shape", (data) => {
    socket.to(data.roomId).emit("drawing-shape", data);
  });

  socket.on("end-shape", (data) => {
    socket.to(data.roomId).emit("end-shape", data);
  });

  // Clear canvas event
  socket.on("clear-canvas", (data) => {
    socket.to(data.roomId).emit("clear-canvas");
  });

  // Clear event (required)
  socket.on("clear", (roomId) => {
    socket.to(roomId).emit("clear", roomId);
  });

  // Text drawing event
  socket.on("draw-text", (data) => {
    socket.to(data.roomId).emit("draw-text", data);
  });

  // Undo/Redo sync
  socket.on("undo", (data) => {
    socket.to(data.roomId).emit("undo", { userId: socket.id });
  });

  socket.on("redo", (data) => {
    socket.to(data.roomId).emit("redo", { userId: socket.id });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    // Notify others about user leaving
    io.emit("user-left", { userId: socket.id });
  });
});

server.listen(5000, () => {
  console.log("Server running on port 5000");
});

