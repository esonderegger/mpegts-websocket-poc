const fs = require('fs');
const http = require('http');
const dgram = require('dgram');
const WebSocket = require('ws');
const events = require('events');
const muxjs = require('mux.js');

const transmuxer = new muxjs.mp4.Transmuxer();
const emitter = new events.EventEmitter();

async function handleRequest(req, res) {
  const content = await fs.promises.readFile('index.html');
  res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
  res.write(content);
  res.end();
}

const server = http.createServer(handleRequest);
const wss = new WebSocket.Server({ server });

function segmentsToBuffer(segments, firstSegment) {
  let bytes = new Uint8Array(0);
  segments.forEach((segment, i) => {
    if (firstSegment && i === 0) {
      bytes = new Uint8Array(segment.initSegment.byteLength + segment.data.byteLength);
      bytes.set(segment.initSegment, 0);
      bytes.set(segment.data, segment.initSegment.byteLength);
    } else {
      const newBytes = new Uint8Array(bytes.length + segment.data.byteLength);
      newBytes.set(bytes, 0);
      newBytes.set(segment.data, bytes.length);
      bytes = newBytes;
    }
  });
  return bytes;
}

fs.watch('segments', async (eventType, filename) => {
  if (filename.endsWith('.ts') && eventType === 'change') {
    const relativePath = `segments/${filename}`;
    const contents = await fs.promises.readFile(relativePath);
    transmuxer.push(new Uint8Array(Buffer.from(contents)));
    transmuxer.flush();
  }
});

let gopSegments = [];

transmuxer.on('data', (segment) => {
  const keyframe = 'slice_layer_without_partitioning_rbsp_idr';
  const parsed = muxjs.mp4.tools.inspect(segment.data);
  const found = parsed.find((p) => p.type === 'mdat' && p.nals.includes(keyframe));
  if (found && gopSegments.length > 0) {
    emitter.emit('gop', gopSegments);
    gopSegments = [segment];
  } else {
    gopSegments.push(segment);
  }
});

const socket = dgram.createSocket('udp4');
socket.on('message', (d) => {
  transmuxer.push(new Uint8Array(d.buffer));
  transmuxer.flush();
});
socket.bind(1234);

wss.on('connection', async function connection(ws) {
  let initRequired = true;

  emitter.on('gop', (g) => {
    const buf = segmentsToBuffer(g, initRequired);
    ws.send(buf);
    initRequired = false;
  });
});

server.listen(8000);
