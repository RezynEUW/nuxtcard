// server/websocket/index.js
import { Server } from 'ws';
import { defineEventHandler } from 'h3';
import { eventHandler } from 'nitro';

let wss = null;

export default defineEventHandler(async (event) => {
  // Only set up WebSocket server once
  if (!wss) {
    const httpServer = event.node.res.socket.server;
    
    wss = new Server({ server: httpServer });
    
    // Store connected clients by room
    const rooms = new Map();
    
    wss.on('connection', (socket) => {
      let clientRoomCode = null;
      
      socket.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          
          // Handle join room event
          if (data.type === 'join_room') {
            clientRoomCode = data.payload.roomCode;
            
            // Create room if it doesn't exist
            if (!rooms.has(clientRoomCode)) {
              rooms.set(clientRoomCode, new Set());
            }
            
            // Add client to room
            rooms.get(clientRoomCode).add(socket);
            
            // Confirm room join
            socket.send(JSON.stringify({
              type: 'room_joined',
              payload: { roomCode: clientRoomCode }
            }));
          }
          
          // Re-broadcast messages to room (except sender)
          if (clientRoomCode && rooms.has(clientRoomCode)) {
            rooms.get(clientRoomCode).forEach((client) => {
              if (client !== socket && client.readyState === client.OPEN) {
                client.send(message);
              }
            });
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });
      
      // Handle disconnection
      socket.on('close', () => {
        if (clientRoomCode && rooms.has(clientRoomCode)) {
          rooms.get(clientRoomCode).delete(socket);
          
          // Clean up empty rooms
          if (rooms.get(clientRoomCode).size === 0) {
            rooms.delete(clientRoomCode);
          }
        }
      });
    });
    
    // Add broadcast helper method
    wss.broadcast = (roomCode, data) => {
      if (rooms.has(roomCode)) {
        const message = typeof data === 'string' ? data : JSON.stringify(data);
        rooms.get(roomCode).forEach((client) => {
          if (client.readyState === client.OPEN) {
            client.send(message);
          }
        });
      }
    };
    
    // Expose WebSocket server to API routes
    global.wss = wss;
  }
  
  return { success: true };
});