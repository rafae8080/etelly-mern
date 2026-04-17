// client/src/utils/socket.js
import io from "socket.io-client";

// Use the correct port - your backend runs on 5000
const SOCKET_URL = "http://localhost:5000";

let socket = null;

export const connectSocket = () => {
  if (!socket) {
    console.log("Connecting to Socket.IO at:", SOCKET_URL);

    socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      console.log("✅ Socket connected successfully:", socket.id);
    });

    socket.on("connect_error", (error) => {
      console.log("❌ Socket connection error:", error);
      console.log("Make sure your backend server is running on port 5000");
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", reason);
    });

    socket.on("new_emergency_report", (data) => {
      console.log("🔔 NEW REPORT RECEIVED:", data);
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const getSocket = () => socket;
