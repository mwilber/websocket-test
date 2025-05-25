const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

// Store all connections by sessionId and pending requests
const clients = new Map(); // sessionId -> ws
const pendingRequests = new Map(); // requestId -> { resolve, timeout, sessionId }

function sendMessage(ws) {
	const randomNumber = Math.floor(Math.random() * 1001);
	ws.send(JSON.stringify({ type: 'random', value: randomNumber }));
}

function getSeriesInfo(sessionId) {
	return new Promise((resolve, reject) => {
		const ws = clients.get(sessionId);
		if (!ws) return reject(new Error('No client for sessionId'));
		const requestId = Math.random().toString(36).substr(2, 9);
		const timeout = setTimeout(() => {
			pendingRequests.delete(requestId);
			reject(new Error('Timeout waiting for client response'));
		}, 10000); // 10s timeout
		pendingRequests.set(requestId, { resolve, timeout, sessionId });
		ws.send(JSON.stringify({ type: 'getSeriesInfo', requestId }));
	});
}

async function simulateMcp(sessionId) {
	const ws = clients.get(sessionId);
	if (!ws) return;
	try {
		const response = await getSeriesInfo(sessionId);
		ws.send(JSON.stringify({ type: 'mcpResult', value: response }));
	} catch (err) {
		ws.send(JSON.stringify({ type: 'mcpResult', value: { error: err.message } }));
	}
}

wss.on('connection', function connection(ws) {
	let sessionId = null;
	let interval = null;

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

		// Handle initial sessionId registration
		if (data.type === 'registerSession' && typeof data.sessionId === 'string') {
			sessionId = data.sessionId;
			clients.set(sessionId, ws);
			// Start random number interval for this client
			interval = setInterval(() => sendMessage(ws), 5000);
			return;
		}

		// Handle response to getSeriesInfo
		if (data.type === 'seriesInfoResponse' && data.requestId && pendingRequests.has(data.requestId)) {
			const { resolve, timeout, sessionId: reqSessionId } = pendingRequests.get(data.requestId);
			clearTimeout(timeout);
			pendingRequests.delete(data.requestId);
			resolve(data.value);
			return;
		}
		// Handle simulateMcp trigger from client
		if (data.type === 'simulateMcp') {
			if (sessionId) simulateMcp(sessionId);
			return;
		}
		// Fallback: reverse logic for other messages
		if (typeof data === 'string' || data.type === 'reverse') {
			const reversed = message.toString().split('').reverse().join('');
			ws.send(JSON.stringify({ type: 'reverse', value: reversed }));
		}
	});

	ws.on('close', () => {
		if (sessionId) {
			clients.delete(sessionId);
		}
		if (interval) {
			clearInterval(interval);
		}
	});
});

console.log('WebSocket server running on ws://localhost:8080'); 