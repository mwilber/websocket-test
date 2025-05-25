const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

// Store all connections and pending requests
const clients = new Set();
const pendingRequests = new Map();

function sendMessage(ws) {
	const randomNumber = Math.floor(Math.random() * 1001);
	ws.send(JSON.stringify({ type: 'random', value: randomNumber }));
}

function getSeriesInfo(ws) {
	return new Promise((resolve, reject) => {
		const requestId = Math.random().toString(36).substr(2, 9);
		const timeout = setTimeout(() => {
			pendingRequests.delete(requestId);
			reject(new Error('Timeout waiting for client response'));
		}, 10000); // 10s timeout
		pendingRequests.set(requestId, { resolve, timeout });
		ws.send(JSON.stringify({ type: 'getSeriesInfo', requestId }));
	});
}

async function simulateMcp(ws) {
	try {
		const response = await getSeriesInfo(ws);
		// Send the response to the client to display in the output div
		ws.send(JSON.stringify({ type: 'mcpResult', value: response }));
	} catch (err) {
		ws.send(JSON.stringify({ type: 'mcpResult', value: { error: err.message } }));
	}
}

wss.on('connection', function connection(ws) {
	clients.add(ws);
	// Send a random number every 5 seconds
	const interval = setInterval(() => sendMessage(ws), 5000);

	ws.on('message', function incoming(message) {
		let data;
		try {
			data = JSON.parse(message);
		} catch (e) {
			// Fallback for plain text (reverse logic)
			const reversed = message.toString().split('').reverse().join('');
			ws.send(JSON.stringify({ type: 'reverse', value: reversed }));
			return;
		}
		// Handle response to getSeriesInfo
		if (data.type === 'seriesInfoResponse' && data.requestId && pendingRequests.has(data.requestId)) {
			const { resolve, timeout } = pendingRequests.get(data.requestId);
			clearTimeout(timeout);
			pendingRequests.delete(data.requestId);
			resolve(data.value);
			return;
		}
		// Handle simulateMcp trigger from client
		if (data.type === 'simulateMcp') {
			simulateMcp(ws);
			return;
		}
		// Fallback: reverse logic for other messages
		if (typeof data === 'string' || data.type === 'reverse') {
			const reversed = message.toString().split('').reverse().join('');
			ws.send(JSON.stringify({ type: 'reverse', value: reversed }));
		}
	});

	ws.on('close', () => {
		clients.delete(ws);
		clearInterval(interval);
	});
});

console.log('WebSocket server running on ws://localhost:8080'); 