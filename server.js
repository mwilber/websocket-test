const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });
let socketConnection;

function sendMessage() {
	if (!socketConnection) return;
	const randomNumber = Math.floor(Math.random() * 1001);
	socketConnection.send(JSON.stringify({ type: 'random', value: randomNumber }));
}

// Send a random number every 5 seconds
const interval = setInterval(() => sendMessage(), 5000);

wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
    const reversed = message.toString().split('').reverse().join('');
    ws.send(JSON.stringify({ type: 'reverse', value: reversed }));
  });

  ws.on('close', () => {
    socketConnection = null;
    clearInterval(interval);
  });

  socketConnection = ws;
});

console.log('WebSocket server running on ws://localhost:8080'); 