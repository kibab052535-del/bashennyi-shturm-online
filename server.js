'use strict';
const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const rooms = new Map();
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, service: 'bashennyi-shturm' }));
function send(ws, data) { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)); }
function code() { const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c; do { c=Array.from({length:5},()=>chars[Math.random()*chars.length|0]).join(''); } while(rooms.has(c)); return c; }
function leave(ws) { const c=ws.roomCode; if(!c)return; const r=rooms.get(c); if(!r)return; if(r.host===ws){send(r.guest,{type:'error',message:'Создатель комнаты отключился.'});rooms.delete(c);} else if(r.guest===ws){r.guest=null;send(r.host,{type:'error',message:'Друг отключился от комнаты.'});} ws.roomCode=null; }
wss.on('connection', ws => {
  ws.on('message', raw => {
    let m; try { m=JSON.parse(raw.toString()); } catch { return; }
    if(m.type==='create') { const c=code(); const r={host:ws,guest:null,hostDeck:Array.isArray(m.deck)?m.deck:[]};rooms.set(c,r);ws.roomCode=c;ws.role='host';send(ws,{type:'created',code:c});return; }
    if(m.type==='join') { const c=String(m.code||'').toUpperCase();const r=rooms.get(c);if(!r){send(ws,{type:'error',message:'Комната не найдена. Проверь код.'});return;}if(r.guest){send(ws,{type:'error',message:'В комнате уже два игрока.'});return;}if(r.host===ws){send(ws,{type:'error',message:'Нельзя войти в свою же комнату как второй игрок.'});return;}r.guest=ws;r.guestDeck=Array.isArray(m.deck)?m.deck:[];ws.roomCode=c;ws.role='guest';send(ws,{type:'joined',code:c});send(r.host,{type:'start',deckB:r.guestDeck});send(ws,{type:'start',deckB:r.guestDeck});return; }
    if(m.type==='play' && ws.role==='guest') { const r=rooms.get(ws.roomCode);if(r&&r.host)send(r.host,{type:'play',i:m.i|0,x:Number(m.x)||180,y:Number(m.y)||100});return; }
    if(m.type==='snapshot' && ws.role==='host') { const r=rooms.get(ws.roomCode);if(r&&r.guest)send(r.guest,{type:'snapshot',state:m.state});return; }
  });
  ws.on('close',()=>leave(ws));
  ws.on('error',()=>leave(ws));
});
const port=Number(process.env.PORT)||3000;
server.listen(port,'0.0.0.0',()=>console.log(`Башенный штурм online server listening on ${port}`));
