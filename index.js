const fs = require('fs');
const http = require('http');
const dgram = require('dgram');
const WebSocket = require('ws');
const events = require('events');

const emitter = new events.EventEmitter();

async function handleRequest(req, res) {
  const content = await fs.promises.readFile('index.html');
  res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
  res.write(content);
  res.end();
}

const server = http.createServer(handleRequest);
const wss = new WebSocket.Server({ server });

fs.watch('segments', async (eventType, filename) => {
  if (filename.endsWith('.ts') && eventType === 'change') {
    const relativePath = `segments/${filename}`;
    const contents = await fs.promises.readFile(relativePath);
    emitter.emit('segment', Buffer.from(contents));
  }
});

// What I'd like to do is listen for packets on a UDP port and let the browser
// assemble them into segments.

// const socket = dgram.createSocket('udp4');
// socket.on('message', (d) => {
//   emitter.emit('segment', d.buffer);
// });
// socket.bind(1234);

wss.on('connection', async function connection(ws) {
  console.log('we have a connection');

  emitter.on('segment', (s) => {
    ws.send(s);
  });
});

server.listen(8000);
