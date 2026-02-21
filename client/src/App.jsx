import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const SOCKET_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000"
    : "https://realtime-collaborative-whiteboard-y7ak.onrender.com";

// Create socket instance without auto-connecting
// We'll connect only when user joins a room
let socket = null;

const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, { 
      autoConnect: false, // Don't auto-connect on creation
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000, // Add connection timeout
    });
    
    // Set up error handlers
    socket.on("connect_error", (err) => {
      console.error("Connection error:", err.message);
    });
    socket.on("error", (err) => {
      console.error("Socket error:", err);
    });
  }
  return socket;
};

const PRESET_COLORS = [
  "#1e293b", "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

const TOOLS = {
  BRUSH: "brush",
  ERASER: "eraser",
  TEXT: "text",
  LINE: "line",
  RECTANGLE: "rectangle",
  CIRCLE: "circle",
  ARROW: "arrow"
};

const KEYBOARD_SHORTCUTS = {
  b: TOOLS.BRUSH,
  e: TOOLS.ERASER,
  t: TOOLS.TEXT,
  l: TOOLS.LINE,
  r: TOOLS.RECTANGLE,
  c: TOOLS.CIRCLE,
  a: TOOLS.ARROW,
  z: "undo",
  s: "export",
};

// Custom cursor SVG for brush tool - simple pen icon
const BRUSH_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24'%3E%3Cpath d='M3 17.25V21h3.75L17.81 9.93l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z' fill='%23000'/%3E%3C/svg%3E") 2 20, pointer`;

export default function App() {
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [color, setColor] = useState("#1e293b");
  const [size, setSize] = useState(4);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [showCustomColor, setShowCustomColor] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tool, setTool] = useState(TOOLS.BRUSH);
  const [canUndo, setCanUndo] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 });
  const [isPlacingText, setIsPlacingText] = useState(false);
  const [showTextMarker, setShowTextMarker] = useState(false);
  
  // New UI state
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("whiteboard-dark-mode");
    return saved ? JSON.parse(saved) : false;
  });
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [showTooltip, setShowTooltip] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showFab, setShowFab] = useState(false);

  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const historyRef = useRef([]);
  const isDrawingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const tempCanvasRef = useRef(null);

  // Set up socket connection handlers when component mounts
  useEffect(() => {
    const currentSocket = getSocket();
    
    const updateStatus = () => {
      setConnectionStatus(currentSocket.connected ? "connected" : "disconnected");
    };
    
    const handleConnectError = (err) => {
      console.error("Connection error:", err.message);
      setConnectionStatus("disconnected");
    };
    
    const handleDisconnect = (reason) => {
      console.warn("Disconnected:", reason);
      setConnectionStatus("disconnected");
    };
    
    const handleReconnect = (attemptNumber) => {
      console.log("Reconnected after", attemptNumber, "attempts");
      setConnectionStatus("connected");
    };
    
    const handleReconnectFailed = () => {
      console.error("Failed to reconnect");
      setConnectionStatus("disconnected");
    };
    
    // Initial status check
    updateStatus();
    
    currentSocket.on("connect", updateStatus);
    currentSocket.on("disconnect", updateStatus);
    currentSocket.on("connect_error", handleConnectError);
    currentSocket.on("disconnect", handleDisconnect);
    currentSocket.on("reconnect", handleReconnect);
    currentSocket.on("reconnect_failed", handleReconnectFailed);
    
    return () => {
      currentSocket.off("connect", updateStatus);
      currentSocket.off("disconnect", updateStatus);
      currentSocket.off("connect_error", handleConnectError);
      currentSocket.off("disconnect", handleDisconnect);
      currentSocket.off("reconnect", handleReconnect);
      currentSocket.off("reconnect_failed", handleReconnectFailed);
    };
  }, []);

  // Dark mode effect
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("whiteboard-dark-mode", JSON.stringify(darkMode));
  }, [darkMode]);

  // Clear text marker when switching away from text tool
  useEffect(() => {
    if (tool !== TOOLS.TEXT && showTextMarker) {
      setShowTextMarker(false);
      setIsPlacingText(false);
      setTextInput("");
    }
  }, [tool]);

  // Splash screen timer - hide after 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const saveCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL("image/png");
      historyRef.current.push(dataUrl);
      if (historyRef.current.length > 30) {
        historyRef.current.shift();
      }
      setCanUndo(historyRef.current.length > 1);
    } catch (e) {
      console.error("Save error:", e);
    }
  };

  const restoreCanvas = (dataUrl) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = dataUrl;
  };

  const handleUndo = () => {
    if (historyRef.current.length > 1) {
      historyRef.current.pop();
      const prev = historyRef.current[historyRef.current.length - 1];
      if (prev) {
        restoreCanvas(prev);
      }
      setCanUndo(historyRef.current.length > 1);
    }
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `whiteboard-${roomId}-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctxRef.current = ctx;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    historyRef.current = [];
    saveCanvas();
  };

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  useEffect(() => {
    if (!joined) return;

    const canvas = canvasRef.current;
    const ctx = ctxRef.current || canvas.getContext("2d");
    ctxRef.current = ctx;
    const currentSocket = getSocket();

    const handlePointerDown = (e) => {
      if (e.button && e.button !== 0) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Handle text tool - set position and show marker
      if (tool === TOOLS.TEXT) {
        setTextPosition({ x, y });
        setIsPlacingText(true);
        setShowTextMarker(true);
        return;
      }
      
      canvas.setPointerCapture?.(e.pointerId);
      isDrawingRef.current = true;
      startPosRef.current = { x, y };
      
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = tool === TOOLS.ERASER ? "#ffffff" : color;
      ctx.lineWidth = tool === TOOLS.ERASER ? size * 3 : size;
      
      // For shapes, create temp canvas for preview
      if ([TOOLS.LINE, TOOLS.RECTANGLE, TOOLS.CIRCLE, TOOLS.ARROW].includes(tool)) {
        tempCanvasRef.current = document.createElement("canvas");
        tempCanvasRef.current.width = canvas.width;
        tempCanvasRef.current.height = canvas.height;
        const tempCtx = tempCanvasRef.current.getContext("2d");
        tempCtx.drawImage(canvas, 0, 0);
      }
      
      currentSocket.emit("start-draw", { roomId, x, y, color: tool === TOOLS.ERASER ? "#ffffff" : color, size: tool === TOOLS.ERASER ? size * 3 : size, tool });
    };

    const handlePointerMove = (e) => {
      if (!isDrawingRef.current) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const startX = startPosRef.current.x;
      const startY = startPosRef.current.y;
      
      if ([TOOLS.LINE, TOOLS.RECTANGLE, TOOLS.CIRCLE, TOOLS.ARROW].includes(tool)) {
        const tempCtx = tempCanvasRef.current?.getContext("2d");
        if (tempCtx) {
          ctx.putImageData(tempCtx.getImageData(0, 0, canvas.width, canvas.height), 0, 0);
        }
        
        ctx.strokeStyle = color;
        ctx.lineWidth = size;
        
        if (tool === TOOLS.LINE) {
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(x, y);
          ctx.stroke();
        } else if (tool === TOOLS.RECTANGLE) {
          ctx.strokeRect(startX, startY, x - startX, y - startY);
        } else if (tool === TOOLS.CIRCLE) {
          const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
          ctx.beginPath();
          ctx.arc(startX, startY, radius, 0, Math.PI * 2);
          ctx.stroke();
        } else if (tool === TOOLS.ARROW) {
          drawArrow(ctx, startX, startY, x, y, size);
        }
      } else {
        ctx.lineTo(x, y);
        ctx.strokeStyle = tool === TOOLS.ERASER ? "#ffffff" : color;
        ctx.lineWidth = tool === TOOLS.ERASER ? size * 3 : size;
        ctx.stroke();
      }
      
      currentSocket.emit("drawing", { roomId, x, y, color, size, tool });
    };

    const stopDrawing = (e) => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      ctx.closePath();
      
      try { canvas.releasePointerCapture?.(e.pointerId); } catch (err) {}
      
      currentSocket.emit("end-draw", { roomId, tool });
      saveCanvas();
    };

    function drawArrow(ctx, fromX, fromY, toX, toY, lineWidth) {
      const headLength = lineWidth * 4;
      const angle = Math.atan2(toY - fromY, toX - fromX);
      
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    }

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDrawing);
    canvas.addEventListener("pointercancel", stopDrawing);
    canvas.addEventListener("pointerleave", stopDrawing);

    const handleRemoteStart = (data) => {
      if (!data || data.roomId !== roomId) return;
      ctx.beginPath();
      ctx.moveTo(data.x, data.y);
      ctx.strokeStyle = data.color || "#000";
      ctx.lineWidth = data.size || 3;
    };
    const handleRemoteDrawing = (data) => {
      if (!data || data.roomId !== roomId) return;
      ctx.strokeStyle = data.color || "#000";
      ctx.lineWidth = data.size || 3;
      ctx.lineTo(data.x, data.y);
      ctx.stroke();
    };
    const handleRemoteEnd = (data) => {
      if (!data || data.roomId !== roomId) return;
      ctx.closePath();
    };
    const handleRemoteText = (data) => {
      if (!data || data.roomId !== roomId) return;
      ctx.font = `${data.fontSize}px Inter, sans-serif`;
      ctx.fillStyle = data.color;
      ctx.fillText(data.text, data.x, data.y);
    };

    currentSocket.on("start-draw", handleRemoteStart);
    currentSocket.on("drawing", handleRemoteDrawing);
    currentSocket.on("end-draw", handleRemoteEnd);
    currentSocket.on("draw-text", handleRemoteText);

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDrawing);
      canvas.removeEventListener("pointercancel", stopDrawing);
      canvas.removeEventListener("pointerleave", stopDrawing);
      currentSocket.off("start-draw", handleRemoteStart);
      currentSocket.off("drawing", handleRemoteDrawing);
      currentSocket.off("end-draw", handleRemoteEnd);
      currentSocket.off("draw-text", handleRemoteText);
    };
  }, [joined, roomId, color, size, tool]);

  const handleJoin = () => {
    if (!roomId) { alert("Enter a room id first"); return; }
    setIsLoading(true);
    
    const currentSocket = getSocket();
    
    // If socket is not connected, wait for connection before joining
    if (!currentSocket.connected) {
      const connectHandler = () => {
        currentSocket.emit("join-room", roomId);
        setJoined(true);
        currentSocket.off("connect", connectHandler);
        setTimeout(() => { 
          resizeCanvas(); 
          setIsLoading(false);
        }, 500);
      };
      
      currentSocket.on("connect", connectHandler);
      currentSocket.connect();
    } else {
      currentSocket.emit("join-room", roomId);
      setJoined(true);
      setTimeout(() => { 
        resizeCanvas(); 
        setIsLoading(false);
      }, 500);
    }
  };

  const clearBoard = () => {
    saveCanvas();
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); }
    // Clear text marker too
    setShowTextMarker(false);
    setIsPlacingText(false);
    setTextInput("");
    const currentSocket = getSocket();
    currentSocket.emit("clear", roomId);
    saveCanvas();
  };

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) { console.error("Failed to copy:", err); }
  };

  useEffect(() => {
    const currentSocket = getSocket();
    const onClear = (room) => {
      if (room !== roomId) return;
      const ctx = ctxRef.current;
      const canvas = canvasRef.current;
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      saveCanvas();
    };
    currentSocket.on("clear", onClear);
    return () => currentSocket.off("clear", onClear);
  }, [roomId]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!joined) return;
    
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      
      const key = e.key.toLowerCase();
      if (KEYBOARD_SHORTCUTS[key]) {
        const action = KEYBOARD_SHORTCUTS[key];
        if (Object.values(TOOLS).includes(action)) {
          setTool(action);
        } else if (action === "undo") {
          handleUndo();
        } else if (action === "export") {
          handleExport();
        }
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [joined]);

  const getTooltipContent = (item) => {
    const tooltips = {
      "brush": "Brush (B)", "eraser": "Eraser (E)", "text": "Text (T)",
      "line": "Line (L)", "rectangle": "Rectangle (R)", "circle": "Circle (C)",
      "arrow": "Arrow (A)", "undo": "Undo (Z)", "export": "Export (S)",
      "theme": darkMode ? "Light Mode" : "Dark Mode",
      "collapse": toolbarCollapsed ? "Expand" : "Collapse",
    };
    return tooltips[item] || item;
  };

  return (
    <div className="app-root">
      {/* Splash Screen */}
      {showSplash && (
        <div className="splash-screen">
          <div className="splash-content">
            <div className="splash-logo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
              </svg>
            </div>
            <h1>Welcome to Whiteboard</h1>
            <p>Real-time collaboration made simple</p>
          </div>
        </div>
      )}
      
      {!joined && !showSplash && (
        <div className="join-card">
          <div className="join-card__logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
            </svg>
          </div>
          <h1>Realtime Whiteboard</h1>
          <p className="join-card__subtitle">Create or join a room to collaborate</p>
          <div className="join-card__input-wrapper">
            <input placeholder="Enter Room ID" value={roomId} onChange={(e) => setRoomId(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleJoin()} />
          </div>
          <div className="row">
            <button className="join-card__btn--primary" onClick={handleJoin} disabled={isLoading}>
              {isLoading ? <><span className="spinner"></span>Joining...</> : "Join Room"}
            </button>
            <button className="join-card__btn--secondary" onClick={() => setRoomId("room-" + Math.random().toString(36).slice(2, 8))}>New Room</button>
          </div>
        </div>
      )}

      {joined && (
        <div className="board-root">
          {/* Floating Action Button */}
          {joined && (
          <div className="fab" onClick={(e) => { e.stopPropagation(); setShowFab(!showFab); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
            </svg>
            {showFab && (
              <div className="fab__menu">
                <button className="fab__menu-item" onClick={(e) => { e.stopPropagation(); handleExport(); }} title="Export">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                </button>
                <button className="fab__menu-item fab__menu-item--danger" onClick={(e) => { e.stopPropagation(); clearBoard(); }} title="Clear">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                </button>
              </div>
            )}
          </div>
          )}

          {/* Toolbar */}
          <div className={`toolbar-card ${toolbarCollapsed ? 'toolbar-card--collapsed' : ''}`}>
            <div className="toolbar-card__header">
              <div className="toolbar-card__left">
                <div className="toolbar-card__title"><h2>Whiteboard</h2></div>
                <div className="toolbar-card__room">
                  <span className="toolbar-card__room-id">{roomId}</span>
                  <button className="toolbar-card__copy-btn" onClick={copyRoomId}>
                    {copied ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>}
                  </button>
                </div>
              </div>
              <div className="toolbar-card__actions">
                <button className="toolbar-action-btn" onClick={() => setDarkMode(!darkMode)} title={darkMode ? "Light Mode" : "Dark Mode"}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {darkMode ? <><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></> : <><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></>}
                  </svg>
                </button>
                <button className="toolbar-action-btn" onClick={() => setToolbarCollapsed(!toolbarCollapsed)} title={toolbarCollapsed ? "Expand" : "Collapse"}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {toolbarCollapsed ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
                  </svg>
                </button>
              </div>
            </div>

            {!toolbarCollapsed && (
              <>
                <div className={`toolbar-card__status toolbar-card__status--${connectionStatus}`}>
                  <span className="toolbar-card__status-dot"></span>
                  <span>{connectionStatus === "connected" ? "Connected" : "Disconnected"}</span>
                </div>
                
                <div className="toolbar-card__section">
                  <span className="toolbar-card__section-label">Drawing Tools</span>
                  <div className="tool-buttons">
                    {["brush", "eraser", "text", "undo", "export"].map((t) => {
                      const toolKey = TOOLS[t.toUpperCase()];
                      return (
                        <div className="tool-btn-wrapper" key={t}>
                          <button className={`tool-btn ${tool === toolKey ? 'tool-btn--active' : ''}`} onClick={(e) => { e.stopPropagation(); t === "undo" ? handleUndo() : t === "export" ? handleExport() : setTool(toolKey); }} disabled={t === "undo" && !canUndo}
                            onMouseEnter={() => setShowTooltip(t)} onMouseLeave={() => setShowTooltip(null)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              {t === "brush" && <><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /></>}
                              {t === "eraser" && <><path d="M20 20H7L3 16c-.6-.6-.6-1.5 0-2.1L13.1 3.8c.6-.6 1.5-.6 2.1 0l5.7 5.7c.6.6.6 1.5 0 2.1L13 19.5" /></>}
                              {t === "text" && <><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></>}
                              {t === "undo" && <><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></>}
                              {t === "export" && <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>}
                            </svg>
                          </button>
                          {showTooltip === t && <div className="tooltip">{getTooltipContent(t)}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="toolbar-card__section">
                  <span className="toolbar-card__section-label">Shapes</span>
                  <div className="tool-buttons">
                    {["line", "rectangle", "circle", "arrow"].map((t) => {
                      const toolKey = TOOLS[t.toUpperCase()];
                      return (
                        <div className="tool-btn-wrapper" key={t}>
                          <button className={`tool-btn ${tool === toolKey ? 'tool-btn--active' : ''}`} onClick={() => setTool(toolKey)}
                            onMouseEnter={() => setShowTooltip(t)} onMouseLeave={() => setShowTooltip(null)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              {t === "line" && <line x1="5" y1="19" x2="19" y2="5" />}
                              {t === "rectangle" && <rect x="3" y="3" width="18" height="18" rx="2" />}
                              {t === "circle" && <circle cx="12" cy="12" r="10" />}
                              {t === "arrow" && <><line x1="5" y1="19" x2="19" y2="5" /><polyline points="10 5 19 5 19 14" /></>}
                            </svg>
                          </button>
                          {showTooltip === t && <div className="tooltip">{getTooltipContent(t)}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {(tool === TOOLS.BRUSH || tool === TOOLS.ERASER || [TOOLS.LINE, TOOLS.RECTANGLE, TOOLS.CIRCLE, TOOLS.ARROW].includes(tool)) && (
                  <div className="toolbar-card__section">
                    <span className="toolbar-card__section-label">{tool === TOOLS.ERASER ? 'Eraser Size' : 'Stroke Size'}</span>
                    <div className="size-control">
                      <div className="size-preview"><div className="size-preview__circle" style={{ width: Math.min(tool === TOOLS.ERASER ? size * 3 : size, 24), height: Math.min(tool === TOOLS.ERASER ? size * 3 : size, 24) }} /></div>
                      <input type="range" min="1" max="30" value={size} onChange={(e) => setSize(Number(e.target.value))} />
                      <span className="size-value">{size}</span>
                    </div>
                  </div>
                )}

                {tool === TOOLS.TEXT && (
                  <div className="toolbar-card__section">
                    <span className="toolbar-card__section-label">{isPlacingText ? "Type below & press Enter" : "Click canvas to place text"}</span>
                    <input type="text" className="text-tool-input" value={textInput} onChange={(e) => setTextInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && textInput.trim() && textPosition.x && textPosition.y) {
                          const canvas = canvasRef.current;
                          const ctx = ctxRef.current;
                          if (canvas && ctx) {
                            const dpr = window.devicePixelRatio || 1;
                            ctx.font = `${size * 4}px Inter, sans-serif`;
                            ctx.fillStyle = color;
                            ctx.fillText(textInput, textPosition.x * dpr, textPosition.y * dpr);
                            saveCanvas();
                            const currentSocket = getSocket();
                            currentSocket.emit("draw-text", { roomId, text: textInput, x: textPosition.x * dpr, y: textPosition.y * dpr, color, fontSize: size * 4 });
                            setTextInput("");
                            setIsPlacingText(false);
                          }
                        }
                      }}
                      placeholder={isPlacingText ? "Type here..." : "Click canvas first..."} disabled={!isPlacingText} onFocus={() => setShowTextMarker(true)} />
                  </div>
                )}

                {(tool === TOOLS.TEXT || tool === TOOLS.BRUSH || [TOOLS.LINE, TOOLS.RECTANGLE, TOOLS.CIRCLE, TOOLS.ARROW].includes(tool)) && (
                  <div className="toolbar-card__section">
                    <span className="toolbar-card__section-label">Color</span>
                    <div className="color-palette">
                      {PRESET_COLORS.map((c) => (<button key={c} className={`color-swatch ${color === c ? 'color-swatch--active' : ''}`} style={{ backgroundColor: c }} onClick={() => { setColor(c); setShowCustomColor(false); }} />))}
                      <button className={`color-swatch color-swatch--custom ${showCustomColor ? 'color-swatch--active' : ''}`} onClick={() => setShowCustomColor(!showCustomColor)}>
                        <input type="color" value={color} onChange={(e) => { setColor(e.target.value); setShowCustomColor(true); }} />
                      </button>
                    </div>
                  </div>
                )}

                <div className="toolbar-card__section">
                  <button className="clear-btn" onClick={clearBoard}>Clear Board</button>
                </div>
              </>
            )}
          </div>

          <div className="canvas-area">
            <div className="canvas-grid" />
            <canvas ref={canvasRef} className="whiteboard-canvas" style={{ cursor: tool === TOOLS.BRUSH ? BRUSH_CURSOR : tool === TOOLS.ERASER ? 'cell' : 'crosshair' }} />
            {showTextMarker && isPlacingText && (
              <div className="text-position-marker" style={{ left: textPosition.x, top: textPosition.y }}>
                <div className="text-position-marker__box">
                  <span className="text-position-marker__text" style={{ color: color, fontSize: size * 4 }}>{textInput || "Type here..."}</span>
                </div>
                <div className="text-position-marker__cursor"></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
