// api/socket.js
export default defineEventHandler(event => {
    // Simply proxy the WebSocket upgrade request to the actual handler
    const upgradeHeader = event.node.req.headers.upgrade;
    
    // Check if this is a WebSocket request
    if (upgradeHeader === 'websocket') {
      console.log('WebSocket connection received, forwarding to handler');
      
      // Extract room code from URL if present
      const url = new URL(event.node.req.url, `http://${event.node.req.headers.host}`);
      const pathParts = url.pathname.split('/');
      const roomCode = pathParts[pathParts.length - 1];
      
      console.log(`WebSocket connection for room: ${roomCode}`);
      
      // Forward to actual WebSocket handling
      import('../server/websocket/index').then(module => {
        const handler = module.default;
        handler(event);
      }).catch(error => {
        console.error('Error importing WebSocket handler:', error);
      });
    }
    
    // Return a basic response for non-WebSocket requests
    return { status: 'WebSocket endpoint' };
  });