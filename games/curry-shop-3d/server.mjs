import crypto from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {TikTokLiveConnection, WebcastEvent, ControlEvent} from 'tiktok-live-connector';
import {MsEdgeTTS, OUTPUT_FORMAT} from 'msedge-tts';
import {startBridge} from './tikfinity-bridge.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, '..', '..');
const SETTINGS_FILE = path.join(projectRoot, 'settings.json');
const clients = new Set();
const stageSpeakers = [];
const actions = new Set(['incense','temple','tree','fruit','lamp','lantern','bell','grand']);
let id = 0;
const journal = [];
const epoch = crypto.randomUUID();
const ttsCache = new Map();
const gamePort = Number(process.env.PORT || 4011);
const bridgePort = Number(process.env.BRIDGE_PORT || 4012);

// ---------- Settings persistence (settings.json giống LIVE-TRANGNGUYEN) ----------
let settings = {
 channelName: 'Phở Cô Ba',
 tiktokUser: '',
 bienHieu: '',
 tenQuan: '',
 ttsVoice: 'edge:vi-VN-HoaiMyNeural',
 ttsRate: 1
};
try {
 if (fs.existsSync(SETTINGS_FILE)) {
  settings = {...settings, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'))};
 }
} catch {}

function saveSettings(patch) {
 settings = {...settings, ...patch};
 try {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
 } catch (err) {
  console.error('Không lưu được settings.json:', err.message);
 }
}

const caiDat = () => ({
 channelName: settings.channelName || 'Phở Cô Ba',
 bienHieu: settings.bienHieu || '',
 tenQuan: settings.tenQuan || '',
 ttsVoice: settings.ttsVoice || 'edge:vi-VN-HoaiMyNeural',
 ttsRate: Number(settings.ttsRate) || 1
});

const clamp01 = (v, fallback) => {
 const n = Number(v);
 return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
};

const audioCfg = () => ({
 masterEnabled: settings.masterEnabled !== false,
 musicEnabled: settings.musicEnabled !== false,
 voiceEnabled: settings.voiceEnabled !== false,
 musicVolume: clamp01(settings.musicVolume, 0.12),
 sfxVolume: clamp01(settings.sfxVolume, 0.35),
 voiceVolume: clamp01(settings.voiceVolume, 1.0),
 orderScript: settings.orderScript !== false,
 greetJoin: settings.greetJoin !== false,
 idleCta: settings.idleCta !== false
});

// ---------- DNS Rebinding Guard (cho phép localhost, 127.0.0.1, lvh.me, trycloudflare) ----------
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', 'lvh.me']);
function hostAllowed(req) {
 const rawHost = String(req.headers.host || '').replace(/:\d+$/, '').toLowerCase();
 if (!rawHost) return true;
 if (LOCAL_HOSTS.has(rawHost) || rawHost.endsWith('.trycloudflare.com')) return true;
 return false;
}

// ---------- Broadcast SSE + Poll Journal ----------
function pushEvent(event, recordInJournal = true) {
 const payload = recordInJournal ? {id: ++id, ...event} : event;
 if (recordInJournal) {
  journal.push(payload);
  if (journal.length > 512) journal.shift();
 }
 const line = 'data: ' + JSON.stringify(payload) + '\n\n';
 for (const client of clients) {
  try { client.res.write(line); } catch {}
 }
 return payload;
}

function announceSpeaker() {
 pushEvent({kind: 'speaker', speakerId: stageSpeakers.at(-1) ?? null, stageCount: stageSpeakers.length}, false);
}

// ---------- Map quà TikTok sang 8 món Phở (theo tên/ID hoặc tự động theo mức xu diamondCount) ----------
const GIFT_BY_NAME = new Map([
 ['rose','incense'],['hoa hồng','incense'],['5655','incense'],
 ['finger heart','temple'],['bắn tim','temple'],['tim tay','temple'],['5487','temple'],
 ['rosa','tree'],['bông hồng','tree'],['8913','tree'],
 ['perfume','fruit'],['nước hoa','fruit'],['5658','fruit'],
 ['doughnut','lamp'],['donut','lamp'],['bánh vòng','lamp'],['5879','lamp'],
 ['paper crane','lantern'],['hạc giấy','lantern'],['5659','lantern'],
 ['hand heart','bell'],['thả tim','bell'],['tim đôi','bell'],['6968','bell'],
 ['galaxy','grand'],['dải ngân hà','grand'],['sư tử','grand'],['lion','grand'],['11046','grand'],['6369','grand']
]);

function mapGiftToAction(giftName = '', giftId = '', diamondCount = 1) {
 const byId = GIFT_BY_NAME.get(String(giftId).trim().toLowerCase());
 if (byId) return byId;
 const byName = GIFT_BY_NAME.get(String(giftName).trim().toLowerCase());
 if (byName) return byName;
 const coins = Number(diamondCount) || 1;
 if (coins >= 500) return 'grand';
 if (coins >= 100) return 'bell';
 if (coins >= 50) return 'lantern';
 if (coins >= 30) return 'lamp';
 if (coins >= 20) return 'fruit';
 if (coins >= 10) return 'tree';
 if (coins >= 5) return 'temple';
 return 'incense';
}

// ---------- Kết nối trực tiếp TikTok LIVE (giống hệt LIVE-TRANGNGUYEN) ----------
const emptyStats = () => ({
 isConnected: false,
 isConnecting: false,
 username: '',
 roomId: '',
 viewerCount: 0,
 totalLikes: 0,
 error: ''
});
let liveStats = emptyStats();
let activeConn = null;
let wantUser = String(settings.tiktokUser || '').trim();
let reconnectTimer = null;
let reconnectTries = 0;

function broadcastStatus() {
 pushEvent({kind: 'status', status: liveStats}, false);
}

function stopReconnect() {
 if (reconnectTimer) clearTimeout(reconnectTimer);
 reconnectTimer = null;
 reconnectTries = 0;
}

function scheduleReconnect(why) {
 if (!wantUser || reconnectTimer) return;
 const delay = Math.min(120_000, 15_000 * 2 ** reconnectTries);
 reconnectTries++;
 liveStats = {...liveStats, isConnected: false, isConnecting: false, error: `${why}. Tự kết nối lại sau ${delay / 1000} giây`};
 broadcastStatus();
 reconnectTimer = setTimeout(() => {
  reconnectTimer = null;
  connectTikTok(wantUser).catch(err => scheduleReconnect(`Chưa kết nối lại được (${err?.message || err})`));
 }, delay);
}

const nickOf = data => data?.user?.nickname || data?.nickname || data?.user?.uniqueId || data?.uniqueId || 'Khách TikTok';
const userOf = data => data?.user?.uniqueId || data?.uniqueId || data?.user?.displayId || nickOf(data);
const socialThrottle = new Map();
function allowSocial(type, gapMs) {
 const now = Date.now();
 if (now - (socialThrottle.get(type) || 0) < gapMs) return false;
 socialThrottle.set(type, now);
 return true;
}

async function connectTikTok(cleanUser) {
 if (activeConn) {
  try { activeConn.disconnect(); } catch {}
  activeConn = null;
 }
 liveStats = {...emptyStats(), isConnecting: true, username: cleanUser};
 broadcastStatus();

 const conn = new TikTokLiveConnection(cleanUser, {
  processInitialData: true,
  enableExtendedGiftInfo: false
 });

 conn.on(ControlEvent.CONNECTED, state => {
  console.log(`[TikTok] Đã kết nối @${cleanUser}, room ${state?.roomId}`);
  liveStats = {...liveStats, isConnected: true, isConnecting: false, roomId: state?.roomId || '', error: ''};
  reconnectTries = 0;
  broadcastStatus();
 });

 conn.on(ControlEvent.DISCONNECTED, () => {
  if (activeConn !== conn) return;
  liveStats = {...liveStats, isConnected: false, isConnecting: false};
  broadcastStatus();
  scheduleReconnect('Mất kết nối TikTok');
 });

 conn.on(WebcastEvent.STREAM_END, () => {
  if (activeConn !== conn) return;
  liveStats = {...liveStats, isConnected: false, isConnecting: false, error: 'Phiên live đã kết thúc'};
  broadcastStatus();
  scheduleReconnect('Phiên live đã kết thúc');
 });

 const streakCounts = new Map();
 conn.on(WebcastEvent.GIFT, data => {
  const username = userOf(data);
  const giftId = data?.giftId || 0;
  const key = `${username}_${giftId}`;
  const total = Number(data?.repeatCount) || 1;
  const delta = total - (streakCounts.get(key) || 0);
  const isStreakable = (data?.gift?.type ?? data?.giftDetails?.giftType ?? data?.giftType) === 1;
  if (isStreakable && !data?.repeatEnd) streakCounts.set(key, total);
  else streakCounts.delete(key);
  if (delta <= 0) return;
  const giftName = data?.gift?.name || data?.giftDetails?.giftName || data?.giftName || 'Quà';
  const diamondCount = data?.gift?.diamondCount || data?.diamondCount || data?.giftDetails?.diamondCount || 1;
  const action = mapGiftToAction(giftName, giftId, diamondCount);
  pushEvent({action, name: String(nickOf(data)).slice(0, 40), count: Math.min(100, delta), giftLabel: giftName});
 });

 conn.on(WebcastEvent.MEMBER, data => {
  if (!allowSocial('join', 8000)) return;
  pushEvent({kind: 'social', social: 'join', name: String(nickOf(data)).slice(0, 40)});
 });

 conn.on(WebcastEvent.FOLLOW, data => {
  if (!allowSocial('follow', 5000)) return;
  pushEvent({kind: 'social', social: 'follow', name: String(nickOf(data)).slice(0, 40)});
 });

 conn.on(WebcastEvent.LIKE, data => {
  if (typeof data?.totalLikeCount === 'number') {
   liveStats.totalLikes = data.totalLikeCount;
   broadcastStatus();
  }
  if (!allowSocial('like', 6000)) return;
  pushEvent({kind: 'social', social: 'like', name: String(nickOf(data)).slice(0, 40), likeCount: Number(data?.likeCount) || 1});
 });

 conn.on(WebcastEvent.CHAT, data => {
  if (!allowSocial('chat', 6000)) return;
  const comment = String(data?.content || data?.comment || '').trim().slice(0, 80);
  if (!comment) return;
  pushEvent({kind: 'social', social: 'chat', name: String(nickOf(data)).slice(0, 40), comment});
 });

 conn.on(WebcastEvent.ROOM_USER, data => {
  if (typeof data?.viewerCount === 'number') {
   liveStats.viewerCount = data.viewerCount;
   broadcastStatus();
  }
 });

 conn.on(ControlEvent.ERROR, err => {
  liveStats.error = err?.message || String(err);
  broadcastStatus();
 });

 activeConn = conn;
 try {
  const live = await conn.fetchIsLive().catch(() => true);
  if (!live) throw new Error('TikTok báo tài khoản này CHƯA LIVE. Bấm Phát trực tiếp trong LIVE Studio trước rồi mới kết nối');
  return await Promise.race([
   conn.connect(),
   new Promise((_, reject) => setTimeout(() => reject(new Error('quá 30 giây không vào được phòng live')), 30_000))
  ]);
 } catch (err) {
  const msg = err?.message || String(err);
  liveStats = {...liveStats, isConnected: false, isConnecting: false, error: msg};
  broadcastStatus();
  if (activeConn === conn) {
   try { conn.disconnect(); } catch {}
   activeConn = null;
  }
  throw err;
 }
}

// ---------- Hệ thống giọng đọc đồng nhất (VieNeu AI local + Microsoft Edge Neural + Google TTS) ----------
let vieneuState = 'unavailable';
let vieneuVoices = [];
let vieneuProc = null;
let nextJobId = 1;
let currentJob = null;
const vieneuQueue = [];
const vieneuCache = new Map();

function getTtsStatus() {
 return {
  state: vieneuState,
  voice: settings.ttsVoice || 'edge:vi-VN-HoaiMyNeural',
  rate: Number(settings.ttsRate) || 1,
  voices: vieneuVoices
 };
}

function findVieneuPaths() {
 const candidates = [
  process.env.VIENEU_DIR,
  path.join(projectRoot, 'VieNeu-TTS'),
  path.resolve(projectRoot, '..', 'LIVE-TRANGNGUYEN', 'VieNeu-TTS')
 ].filter(Boolean);
 for (const dir of candidates) {
  const pyExe = path.join(dir, '.venv', 'Scripts', 'python.exe');
  const workerCandidates = [
   path.join(projectRoot, 'tools', 'vieneu-worker.py'),
   path.resolve(dir, '..', 'tools', 'vieneu-worker.py')
  ];
  const worker = workerCandidates.find(w => fs.existsSync(w));
  if (fs.existsSync(pyExe) && worker) return {dir, pyExe, worker};
 }
 return null;
}

function pumpVieneu() {
 if (currentJob || vieneuState !== 'ready' || !vieneuProc?.stdin?.writable) return;
 while (vieneuQueue.length > 0) {
  const job = vieneuQueue.shift();
  if (job.res.writableEnded || job.res.destroyed) {
   clearTimeout(job.timer);
   job.resolve(true);
   continue;
  }
  const key = `${job.voice}|${job.text}`;
  if (vieneuCache.has(key)) {
   clearTimeout(job.timer);
   const buf = vieneuCache.get(key);
   job.res.writeHead(200, {'Content-Type': 'audio/wav', 'Content-Length': buf.length});
   job.res.end(buf);
   job.resolve(true);
   continue;
  }
  currentJob = job;
  try {
   vieneuProc.stdin.write(JSON.stringify({id: job.id, text: job.text, voice: job.voice}) + '\n');
   return;
  } catch {
   clearTimeout(job.timer);
   currentJob = null;
   job.resolve(false);
  }
 }
}

function startVieneuWorker() {
 const found = findVieneuPaths();
 if (!found) {
  vieneuState = 'unavailable';
  return;
 }
 vieneuState = 'loading';
 pushEvent({kind: 'ttsStatus', tts: getTtsStatus()}, false);
 const proc = spawn(found.pyExe, ['-u', found.worker], {
  cwd: found.dir,
  stdio: ['pipe', 'pipe', 'inherit'],
  windowsHide: true,
  env: {...process.env, PYTHONIOENCODING: 'utf-8', HF_HUB_DISABLE_SYMLINKS_WARNING: '1', HF_HUB_OFFLINE: '1', VIENEU_PRECISION: 'int8', VIENEU_WATERMARK: '0'}
 });
 vieneuProc = proc;
 let rxBuf = Buffer.alloc(0);
 proc.stdout.on('data', chunk => {
  rxBuf = rxBuf.length === 0 ? chunk : Buffer.concat([rxBuf, chunk]);
  while (rxBuf.length >= 9) {
   const frameType = rxBuf.readUInt8(0);
   const reqId = rxBuf.readUInt32BE(1);
   const payloadLen = rxBuf.readUInt32BE(5);
   if (rxBuf.length < 9 + payloadLen) break;
   const payload = rxBuf.subarray(9, 9 + payloadLen);
   rxBuf = rxBuf.subarray(9 + payloadLen);
   if (frameType === 1) {
    try { vieneuVoices = JSON.parse(payload.toString('utf8')).voices || []; } catch { vieneuVoices = []; }
    vieneuState = 'ready';
    pushEvent({kind: 'ttsStatus', tts: getTtsStatus()}, false);
    pumpVieneu();
   } else if (frameType === 2 && currentJob?.id === reqId) {
    if (!currentJob.res.headersSent) currentJob.res.writeHead(200, {'Content-Type': 'audio/wav', 'Cache-Control': 'no-store'});
    currentJob.parts.push(Buffer.from(payload));
    if (!currentJob.res.writableEnded) currentJob.res.write(payload);
   } else if (frameType === 3 && currentJob?.id === reqId) {
    const job = currentJob; currentJob = null; clearTimeout(job.timer);
    if (!job.res.writableEnded) job.res.end();
    if (job.parts.length > 0) {
     vieneuCache.set(`${job.voice}|${job.text}`, Buffer.concat(job.parts));
     if (vieneuCache.size > 100) vieneuCache.delete(vieneuCache.keys().next().value);
    }
    job.resolve(true); pumpVieneu();
   } else if (frameType === 4 && currentJob?.id === reqId) {
    const job = currentJob; currentJob = null; clearTimeout(job.timer);
    job.resolve(false); pumpVieneu();
   }
  }
 });
 proc.on('exit', () => {
  if (vieneuProc !== proc) return;
  vieneuProc = null; vieneuState = 'unavailable';
  pushEvent({kind: 'ttsStatus', tts: getTtsStatus()}, false);
 });
}
process.on('exit', () => { try { vieneuProc?.kill(); } catch {} });

function speakVieneu(text, voiceName, res) {
 const key = `${voiceName}|${text}`;
 if (vieneuCache.has(key)) {
  const buf = vieneuCache.get(key);
  res.writeHead(200, {'Content-Type': 'audio/wav', 'Content-Length': buf.length});
  res.end(buf);
  return Promise.resolve(true);
 }
 if (vieneuState !== 'ready') return Promise.resolve(false);
 return new Promise(resolve => {
  const job = {
   id: nextJobId++, text, voice: voiceName, res, parts: [], resolve,
   timer: setTimeout(() => {
    const idx = vieneuQueue.indexOf(job);
    if (idx !== -1) vieneuQueue.splice(idx, 1);
    if (currentJob !== job) resolve(false);
   }, 12_000)
  };
  vieneuQueue.push(job);
  pumpVieneu();
 });
}

const escapeXml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
async function edgeTtsBuffer(text, voiceId, rate = 1) {
 const tts = new MsEdgeTTS();
 try {
  await tts.setMetadata(voiceId, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const pitch = voiceId.includes('HoaiMy') ? '+2%' : '-2%';
  const {audioStream} = tts.toStream(escapeXml(text), {rate: `${Math.round((rate - 1) * 100)}%`, pitch});
  const chunks = [];
  await Promise.race([
   (async () => { for await (const c of audioStream) chunks.push(c); })(),
   new Promise((_, rej) => setTimeout(() => rej(new Error('Edge TTS timeout')), 12_000))
  ]);
  if (!chunks.length) throw new Error('Edge TTS empty');
  return Buffer.concat(chunks);
 } finally {
  tts.close();
 }
}

async function googleTtsBuffer(text) {
 const clean = text.slice(0, 190);
 const ttsUrl = 'https://translate.googleapis.com/translate_tts?ie=UTF-8&client=tw-ob&tl=vi&q=' + encodeURIComponent(clean);
 const upstream = await fetch(ttsUrl, {headers: {'User-Agent': 'Mozilla/5.0'}, signal: AbortSignal.timeout(8000)});
 if (!upstream.ok) throw Error('Google TTS HTTP ' + upstream.status);
 return Buffer.from(await upstream.arrayBuffer());
}

async function readJsonBody(req, maxBytes = 8192) {
 let raw = '';
 for await (const c of req) {
  raw += c;
  if (raw.length > maxBytes) throw Error('Payload too large');
 }
 return raw ? JSON.parse(raw) : {};
}

// ---------- HTTP Server ----------
const server = http.createServer(async (req, res) => {
 if (!hostAllowed(req)) { res.writeHead(403); res.end(); return; }
 const url = new URL(req.url, 'http://localhost');
 const sendJson = (code, obj) => {
  res.writeHead(code, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'});
  res.end(JSON.stringify(obj));
 };

 if (url.pathname === '/api/poll' && req.method === 'GET') {
  const after = Number(url.searchParams.get('after'));
  const reset = !url.searchParams.has('after') || url.searchParams.get('epoch') !== epoch || !Number.isInteger(after) || after < 0 || after > id || (journal.length && after < journal[0].id - 1);
  const events = reset ? [] : journal.filter(e => e.id > after).slice(0, 64);
  sendJson(200, {ready: true, reset, epoch, cursor: events.at(-1)?.id ?? id, events, status: liveStats, caiDat: caiDat()});
  return;
 }

 if ((url.pathname === '/api/events' || url.pathname === '/api/tiktok/events') && req.method === 'GET') {
  res.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive'});
  res.write(': connected\n\n');
  const stageId = String(url.searchParams.get('stage') || '').slice(0, 40);
  const entry = {res, stageId};
  clients.add(entry);
  res.write('data: ' + JSON.stringify({kind: 'status', status: liveStats}) + '\n\n');
  res.write('data: ' + JSON.stringify({kind: 'caiDat', caiDat: caiDat()}) + '\n\n');
  res.write('data: ' + JSON.stringify({kind: 'ttsStatus', tts: getTtsStatus()}) + '\n\n');
  res.write('data: ' + JSON.stringify({kind: 'audioCfg', audio: audioCfg()}) + '\n\n');
  if (stageId) {
   const idx = stageSpeakers.indexOf(stageId);
   if (idx !== -1) stageSpeakers.splice(idx, 1);
   stageSpeakers.push(stageId);
   announceSpeaker();
  } else {
   res.write('data: ' + JSON.stringify({kind: 'speaker', speakerId: stageSpeakers.at(-1) ?? null, stageCount: stageSpeakers.length}) + '\n\n');
  }
  req.on('close', () => {
   clients.delete(entry);
   if (stageId) {
    const idx = stageSpeakers.indexOf(stageId);
    if (idx !== -1) stageSpeakers.splice(idx, 1);
    announceSpeaker();
   }
  });
  return;
 }

 if (url.pathname === '/api/audio' && req.method === 'GET') {
  sendJson(200, audioCfg());
  return;
 }

 if (url.pathname === '/api/audio' && req.method === 'POST') {
  try {
   const body = await readJsonBody(req);
   const patch = {};
   for (const boolKey of ['masterEnabled', 'musicEnabled', 'voiceEnabled', 'orderScript', 'greetJoin', 'idleCta']) {
    if (body[boolKey] !== undefined) patch[boolKey] = Boolean(body[boolKey]);
   }
   for (const [numKey, def] of [['musicVolume', 0.12], ['sfxVolume', 0.35], ['voiceVolume', 1.0]]) {
    if (body[numKey] !== undefined) patch[numKey] = clamp01(body[numKey], def);
   }
   saveSettings(patch);
   const next = audioCfg();
   pushEvent({kind: 'audioCfg', audio: next}, false);
   sendJson(200, {success: true, ...next});
  } catch (err) {
   sendJson(400, {success: false, error: err.message});
  }
  return;
 }

 if (url.pathname === '/api/tiktok/status' && req.method === 'GET') {
  sendJson(200, {success: true, data: liveStats, bridge: bridge.status});
  return;
 }

 if (url.pathname === '/api/tiktok/connect' && req.method === 'POST') {
  try {
   const body = await readJsonBody(req);
   const cleanUser = String(body.username || '').replace(/^@/, '').trim();
   if (!cleanUser) { sendJson(400, {success: false, error: 'Chưa nhập username TikTok'}); return; }
   stopReconnect();
   wantUser = cleanUser;
   saveSettings({tiktokUser: cleanUser});
   const state = await connectTikTok(cleanUser);
   sendJson(200, {success: true, roomId: state?.roomId});
  } catch (err) {
   const msg = err?.message || String(err);
   scheduleReconnect(`Không kết nối được: ${msg}`);
   sendJson(400, {success: false, error: `Không kết nối được @${wantUser}: ${msg}`});
  }
  return;
 }

 if (url.pathname === '/api/tiktok/disconnect' && req.method === 'POST') {
  stopReconnect();
  wantUser = '';
  saveSettings({tiktokUser: ''});
  try { activeConn?.disconnect(); } catch {}
  activeConn = null;
  liveStats = emptyStats();
  broadcastStatus();
  sendJson(200, {success: true});
  return;
 }

 if (url.pathname === '/api/server/shutdown' && req.method === 'POST') {
  stopReconnect();
  wantUser = '';
  try { activeConn?.disconnect(); } catch {}
  activeConn = null;
  pushEvent({kind: 'shutdown', port: gamePort}, false);
  sendJson(200, {success: true, port: gamePort, message: `Đã tắt Server và giải phóng hoàn toàn cổng ${gamePort}`});
  setTimeout(() => {
   clearInterval(heartbeat);
   for (const c of clients) { try { c.res.end(); } catch {} }
   clients.clear();
   try { bridge.close(); } catch {}
   try { vieneuProc?.kill(); } catch {}
   try { server.closeAllConnections?.(); } catch {}
   server.close(() => process.exit(0));
   setTimeout(() => process.exit(0), 300).unref();
  }, 180);
  return;
 }

 if (url.pathname === '/api/tts/status' && req.method === 'GET') {
  sendJson(200, getTtsStatus());
  return;
 }

 if (url.pathname === '/api/tts/voice' && req.method === 'POST') {
  try {
   const body = await readJsonBody(req);
   const voice = String(body.voice || 'edge:vi-VN-HoaiMyNeural').trim().slice(0, 60);
   saveSettings({ttsVoice: voice});
   pushEvent({kind: 'ttsStatus', tts: getTtsStatus()}, false);
   sendJson(200, {success: true, ...getTtsStatus()});
  } catch (err) {
   sendJson(400, {success: false, error: err.message});
  }
  return;
 }

 if (url.pathname === '/api/tts' && req.method === 'GET') {
  try {
   const raw = String(url.searchParams.get('text') || '').replace(/\s+/g, ' ').trim().slice(0, 450);
   if (!raw) { res.writeHead(400); res.end('Empty text'); return; }
   const selected = String(url.searchParams.get('voice') || settings.ttsVoice || 'edge:vi-VN-HoaiMyNeural');
   const rate = Math.min(1.5, Math.max(0.6, Number(url.searchParams.get('rate') || settings.ttsRate) || 1));
   if (selected.startsWith('vieneu:')) {
    const vName = selected.slice(7);
    if (await speakVieneu(raw, vName, res)) return;
   }
   const cleanText = raw.replace(/\[[^\]]*\]\s*/g, '').trim();
   const cacheKey = `${selected}|${rate}|${cleanText}`;
   let audio = ttsCache.get(cacheKey);
   if (!audio) {
    if (selected === 'google:vi') {
     audio = await googleTtsBuffer(cleanText);
    } else {
     const edgeVoice = selected.startsWith('edge:') ? selected.slice(5) : 'vi-VN-HoaiMyNeural';
     try { audio = await edgeTtsBuffer(cleanText, edgeVoice, rate); }
     catch { audio = await googleTtsBuffer(cleanText); }
    }
    ttsCache.set(cacheKey, audio);
    if (ttsCache.size > 160) ttsCache.delete(ttsCache.keys().next().value);
   }
   res.writeHead(200, {'Content-Type': 'audio/mpeg', 'Content-Length': audio.length, 'Cache-Control': 'private, max-age=3600'});
   res.end(audio);
  } catch (err) {
   sendJson(502, {error: err.message});
  }
  return;
 }

 if (url.pathname === '/api/cai-dat' && req.method === 'GET') {
  sendJson(200, caiDat());
  return;
 }

 if (url.pathname === '/api/cai-dat' && req.method === 'POST') {
  try {
   const body = await readJsonBody(req);
   const clean = (v, max = 34) => typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : undefined;
   const patch = {};
   if (body.bienHieu !== undefined) patch.bienHieu = clean(body.bienHieu, 34);
   if (body.tenQuan !== undefined) patch.tenQuan = clean(body.tenQuan, 30);
   if (body.channelName !== undefined) patch.channelName = clean(body.channelName, 40) || 'Phở Cô Ba';
   saveSettings(patch);
   pushEvent({kind: 'caiDat', caiDat: caiDat()}, false);
   sendJson(200, {success: true, ...caiDat()});
  } catch (err) {
   sendJson(400, {success: false, error: err.message});
  }
  return;
 }

 if (url.pathname === '/api/control' && req.method === 'POST') {
  try {
   const body = await readJsonBody(req);
   const action = String(body.action || '');
   const text = typeof body.text === 'string' ? body.text.trim().slice(0, 500) : '';
   if (!['speak', 'setRate', 'reset', 'setName', 'custom'].includes(action)) {
    sendJson(400, {success: false, error: 'Lệnh không hợp lệ'}); return;
   }
   if (action === 'setRate') saveSettings({ttsRate: Math.min(1.5, Math.max(0.6, Number(text) || 1))});
   if (action === 'setName' && text) {
    saveSettings({channelName: text.slice(0, 40)});
    pushEvent({kind: 'caiDat', caiDat: caiDat()}, false);
   }
   pushEvent({kind: 'control', action, text}, false);
   sendJson(200, {success: true, pages: clients.size});
  } catch (err) {
   sendJson(400, {success: false, error: err.message});
  }
  return;
 }

 if (url.pathname === '/api/test/emit' && req.method === 'POST') {
  try {
   const {type, data = {}} = await readJsonBody(req);
   const name = String(data.nickname || data.username || 'Khách thử').slice(0, 40);
   if (type === 'gift') {
    const action = mapGiftToAction(data.giftName, data.giftId, data.diamondCount);
    const count = Math.min(100, Math.max(1, Number(data.repeatCount) || 1));
    pushEvent({action, name, count, giftLabel: data.giftName || 'Hoa hồng', preview: true});
   } else if (['member', 'follow', 'like', 'chat'].includes(type)) {
    if (type === 'like') {
     liveStats.totalLikes += Number(data.likeCount) || 1;
     broadcastStatus();
    }
    pushEvent({
     kind: 'social',
     social: type === 'member' ? 'join' : type,
     name,
     likeCount: Number(data.likeCount) || 1,
     comment: String(data.comment || '').slice(0, 80),
     force: true,
     preview: true
    });
   } else {
    sendJson(400, {success: false, error: 'Loại sự kiện không hợp lệ'}); return;
   }
   sendJson(200, {success: true});
  } catch (err) {
   sendJson(400, {success: false, error: err.message});
  }
  return;
 }

 if (url.pathname === '/api/bridge' && req.method === 'GET') {
  sendJson(200, bridge.status);
  return;
 }

 if (url.pathname === '/api/social' && req.method === 'POST') {
  try {
   const e = await readJsonBody(req, 4096);
   if (!['join', 'like', 'follow', 'chat'].includes(e.social)) throw Error('invalid social');
   const ev = pushEvent({kind: 'social', social: e.social, name: String(e.name || 'Khách quý').slice(0, 40), likeCount: Math.min(999, Math.max(1, Number(e.likeCount || 1))), comment: String(e.comment || '').slice(0, 80), preview: e.preview === true});
   sendJson(200, {ok: true, id: ev.id});
  } catch {
   res.writeHead(400); res.end('Invalid social event');
  }
  return;
 }

 if (url.pathname === '/api/event' && req.method === 'POST') {
  if (!String(req.headers['content-type']).startsWith('application/json')) { res.writeHead(415); res.end(); return; }
  try {
   const e = await readJsonBody(req);
   if (!actions.has(e.action) || !Number.isInteger(e.count) || e.count < 1 || e.count > 100) throw Error('invalid');
   const ev = pushEvent({action: e.action, name: String(e.name || 'Khách quý').slice(0, 40), count: e.count, ...(e.preview === true ? {preview: true} : {})});
   sendJson(200, {ok: true, id: ev.id});
  } catch {
   res.writeHead(400); res.end('Invalid event');
  }
  return;
 }

 if (url.pathname === '/api/models' && req.method === 'GET') {
  const modelsDir = path.join(root, 'assets', 'models');
  const available = {};
  for (const key of ['coba', 'customer-female', 'customer-male', 'customer-vip']) {
   available[key] = fs.existsSync(path.join(modelsDir, `${key}.glb`));
  }
  sendJson(200, {ok: true, models: available});
  return;
 }

 const files = {'/': 'index.html', '/index.html': 'index.html', '/style.css': 'style.css', '/game.js': 'game.js', '/vendor/three.module.js': 'vendor/three.module.js'};
 if (/^\/vendor\/[a-zA-Z0-9._-]+\.js$/.test(url.pathname) && fs.existsSync(path.join(root, url.pathname.slice(1)))) files[url.pathname] = url.pathname.slice(1);
 if (/^\/assets\/[a-f0-9]{64}\.(png|webp|jpg|mp3)$/.test(url.pathname) && fs.existsSync(path.join(root, url.pathname.slice(1)))) files[url.pathname] = url.pathname.slice(1);
 if (/^\/assets\/models\/[a-zA-Z0-9_-]+\.glb$/.test(url.pathname) && fs.existsSync(path.join(root, url.pathname.slice(1)))) files[url.pathname] = url.pathname.slice(1);
 if (req.method !== 'GET' || !files[url.pathname]) { res.writeHead(404); res.end(); return; }
 const file = files[url.pathname];
 const types = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary'};
 res.writeHead(200, {'Content-Type': types[path.extname(file)], 'Cache-Control': file.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache'});
 fs.createReadStream(path.join(root, file)).pipe(res);
});

const bridge = startBridge({root, gameUrl: `http://127.0.0.1:${gamePort}`, port: bridgePort});
startVieneuWorker();
const heartbeat = setInterval(() => { for (const c of clients) { try { c.res.write(': heartbeat\n\n'); } catch {} } }, 15000);

server.listen(gamePort, '127.0.0.1', () => {
 console.log(`Admin Dashboard: http://localhost:${gamePort}  |  Link LIVE Studio: http://lvh.me:${gamePort}/?view=stage`);
 if (wantUser) {
  connectTikTok(wantUser).catch(err => scheduleReconnect(`Chưa kết nối được (${err?.message || err})`));
 }
});
server.on('error', err => { console.error(err.message); bridge.close(); clearInterval(heartbeat); process.exitCode = 1; });
