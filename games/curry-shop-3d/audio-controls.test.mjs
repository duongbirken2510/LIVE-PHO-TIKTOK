import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import net from 'node:net';

const source = fs.readFileSync(new URL('./game.js', import.meta.url), 'utf8');
const audioCode = source.split('// ORIGINAL RESTAURANT AUDIO START')[1].split('// ORIGINAL RESTAURANT AUDIO END')[0];
const voiceCode = source.split('// SELLER VOICE START')[1].split('// SELLER VOICE END')[0];
const {createRestaurantAudio} = await import('data:text/javascript,' + encodeURIComponent(audioCode));
const {createSellerVoice} = await import('data:text/javascript,' + encodeURIComponent(voiceCode));

function makeMockAudioCtx() {
 const gains = [];
 const param = () => ({
  value: 0,
  cancelScheduledValues() {},
  setValueAtTime(v) { this.value = v; },
  linearRampToValueAtTime(v) { this.value = v; },
  exponentialRampToValueAtTime(v) { this.value = v; },
  setTargetAtTime(v) { this.value = v; }
 });
 const node = name => {
  const n = {name, gain: param(), frequency: param(), connect(next) { return next; }, disconnect() { this.disconnected = true; }, start() { this.started = true; }, stop(at) { this.stopped = true; if (at === undefined) this.onended?.(); }};
  if (name === 'gain') gains.push(n);
  return n;
 };
 const ctx = {
  currentTime: 0,
  state: 'suspended',
  sampleRate: 1000,
  destination: {name: 'dest'},
  gains,
  async resume() { this.state = 'running'; },
  async close() { this.state = 'closed'; },
  createGain: () => node('gain'),
  createDynamicsCompressor: () => node('comp'),
  createBiquadFilter: () => node('filter'),
  createMediaElementSource: () => node('media'),
  createBuffer: (_ch, len) => ({getChannelData: () => new Float32Array(len)}),
  createOscillator: () => node('osc'),
  createBufferSource: () => node('bufsrc')
 };
 return ctx;
}

test('1. Nút Nhạc nền, Tiếng bếp, Ducking và thanh trượt 0% -> 100% chính xác tuyệt đối', async () => {
 let ctx;
 const audio = createRestaurantAudio(() => (ctx = makeMockAudioCtx()));
 await audio.start();
 const [masterGain, musicGain] = ctx.gains;

 // Mặc định bật cả tiếng bếp & nhạc nền
 assert.equal(audio.getState().enabled, true);
 assert.equal(audio.getState().musicEnabled, true);
 assert.equal(audio.getState().musicPlaying, true);
 assert.ok(Math.abs(masterGain.gain.value - 0.35) < 1e-6);
 assert.ok(Math.abs(musicGain.gain.value - 0.12) < 1e-6);

 // Tắt riêng nhạc nền -> nhạc dừng nhưng tiếng bếp vẫn kêu bình thường
 audio.setMusicEnabled(false);
 assert.equal(audio.getState().musicEnabled, false);
 assert.equal(audio.getState().musicPlaying, false);
 assert.equal(audio.getState().enabled, true);
 ctx.currentTime = 2;
 assert.equal(audio.play('serve'), true);

 // Bật lại nhạc nền -> nhạc chạy lại
 audio.setMusicEnabled(true);
 assert.equal(audio.getState().musicPlaying, true);

 // Kéo thanh trượt Nhạc nền về 0% ('0') -> phải bằng 0 tuyệt đối (không nhảy về mặc định)
 audio.setMusicVolume('0');
 assert.equal(audio.getState().musicVolume, 0);
 assert.equal(musicGain.gain.value, 0);

 // Kéo thanh trượt Nhạc nền lên 65%
 audio.setMusicVolume('0.65');
 assert.equal(audio.getState().musicVolume, 0.65);
 assert.ok(Math.abs(musicGain.gain.value - 0.65) < 1e-6);

 // Kéo thanh trượt Tiếng bếp về 0% ('0') -> bằng 0 tuyệt đối
 audio.setVolume('0');
 assert.equal(audio.getState().volume, 0);
 assert.equal(masterGain.gain.value, 0);

 // Kéo thanh trượt Tiếng bếp lên 80%
 audio.setVolume('0.8');
 assert.equal(audio.getState().volume, 0.8);
 assert.ok(Math.abs(masterGain.gain.value - 0.8) < 1e-6);

 // Khi Cô Ba cất giọng (setDucking(true)): hạ 95% nhạc nền, hạ 86% tiếng bếp, khóa hẳn tiếng bước chân/múc nước
 audio.setDucking(true);
 assert.ok(Math.abs(musicGain.gain.value - 0.65 * 0.05) < 1e-6);
 assert.ok(Math.abs(masterGain.gain.value - 0.8 * 0.14) < 1e-6);
 ctx.currentTime = 5;
 assert.equal(audio.play('step'), false, 'step muted while Cô Ba speaks');
 assert.equal(audio.play('scoop'), false, 'scoop muted while Cô Ba speaks');
 assert.equal(audio.play('plate'), false, 'plate muted while Cô Ba speaks');

 // Cô Ba nói xong -> khôi phục lại đúng mức âm lượng người dùng chọn
 audio.setDucking(false);
 assert.ok(Math.abs(musicGain.gain.value - 0.65) < 1e-6);
 assert.ok(Math.abs(masterGain.gain.value - 0.8) < 1e-6);
 ctx.currentTime = 8;
 assert.equal(audio.play('step'), true, 'step restored after Cô Ba finishes');

 // Khuếch đại giọng Cô Ba (boostVoice) và chỉnh to/nhỏ về 0% ngay giữa câu nói
 const booster = audio.boostVoice({}, 1);
 const voiceGainNode = ctx.gains.at(-1);
 assert.ok(Math.abs(voiceGainNode.gain.value - 1.55) < 1e-6);
 booster.setVolume('0');
 assert.equal(voiceGainNode.gain.value, 0, '0% slider must mute boosted voice completely');
 booster.setVolume('0.5');
 assert.ok(Math.abs(voiceGainNode.gain.value - 0.5 * 1.55) < 1e-6);
 booster.disconnect();

 // Tắt hẳn Âm thanh quán (Master Stop)
 await audio.stop();
 assert.equal(audio.getState().enabled, false);
 assert.equal(audio.getState().musicPlaying, false);
 assert.equal(audio.play('order'), false);
});

test('2. Nút Giọng Cô Ba và thanh trượt âm lượng Giọng Cô Ba (kể cả kéo về 0% khi đang nói)', () => {
 const liveVolUpdates = [];
 let duckState = false;
 let canceledClips = 0;
 let activeClip = null;

 const voice = createSellerVoice({
  synth: {getVoices: () => [], cancel() {}},
  Utterance: class {},
  onSpeaking: v => { duckState = v; },
  onVolumeChange: v => liveVolUpdates.push(v),
  onlineSpeak: (_text, vol, _rate, _uri, {onStart, onEnd}) => {
   activeClip = {vol, onEnd};
   onStart();
   return () => { canceledClips++; };
  }
 });

 assert.equal(voice.enable(), true);
 voice.sayNow('Xin chào quý khách!');
 assert.equal(duckState, true, 'music pre-ducked immediately');
 assert.equal(activeClip.vol, 1);

 // Kéo thanh trượt Giọng Cô Ba về 0% ngay lúc đang nói -> không bị nhảy về 100%!
 voice.configure({volume: '0'});
 assert.equal(voice.getState().volume, 0);
 assert.equal(liveVolUpdates.at(-1), 0);

 // Kéo lên 45% ngay lúc đang nói
 voice.configure({volume: '0.45'});
 assert.equal(voice.getState().volume, 0.45);
 assert.equal(liveVolUpdates.at(-1), 0.45);

 // Bấm nút Tắt Giọng Cô Ba ngay lúc đang nói -> ngắt tiếng ngay lập tức & nhả ducking nhạc nền
 voice.disable();
 assert.equal(canceledClips, 1);
 assert.equal(voice.getState().enabled, false);
 assert.equal(voice.getState().speaking, false);
 assert.equal(duckState, false);
});

test('3. Đồng bộ thời gian thực Admin -> Stage qua /api/audio và SSE', async () => {
 const freePort = () => new Promise((res, rej) => {
  const s = net.createServer();
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
  s.on('error', rej);
 });
 const port = await freePort();
 const bridgePort = await freePort();
 const proc = spawn(process.execPath, ['server.mjs'], {
  cwd: new URL('.', import.meta.url),
  env: {...process.env, PORT: String(port), BRIDGE_PORT: String(bridgePort), VIENEU_DIR: 'Z:\\nonexistent'},
  stdio: 'ignore'
 });

 try {
  // Đợi server mở cổng
  for (let i = 0; i < 25; i++) {
   try {
    const r = await fetch(`http://127.0.0.1:${port}/api/audio`);
    if (r.ok) break;
   } catch {}
   await new Promise(r => setTimeout(r, 120));
  }

  // Mở kết nối SSE giả lập trang Stage (?view=stage)
  const sseAbort = new AbortController();
  const sseRes = await fetch(`http://127.0.0.1:${port}/api/events?stage=test_stage_1`, {signal: sseAbort.signal});
  const reader = sseRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const receivedAudioCfgs = [];
  const pumpSse = (async () => {
   try {
    while (true) {
     const {done, value} = await reader.read();
     if (done) break;
     buffer += decoder.decode(value, {stream: true});
     const parts = buffer.split('\n\n');
     buffer = parts.pop() || '';
     for (const block of parts) {
      if (block.startsWith('data: ')) {
       const msg = JSON.parse(block.slice(6));
       if (msg.kind === 'audioCfg') receivedAudioCfgs.push(msg.audio);
      }
     }
    }
   } catch {}
  })();

  // Bấm từ Admin: tắt nhạc nền, kéo Giọng Cô Ba về 0%, Tiếng bếp 25%
  const postRes = await fetch(`http://127.0.0.1:${port}/api/audio`, {
   method: 'POST',
   headers: {'Content-Type': 'application/json'},
   body: JSON.stringify({masterEnabled: true, musicEnabled: false, voiceEnabled: true, musicVolume: 0, sfxVolume: 0.25, voiceVolume: 0})
  }).then(r => r.json());
  assert.equal(postRes.success, true);
  assert.equal(postRes.musicEnabled, false);
  assert.equal(postRes.musicVolume, 0);
  assert.equal(postRes.voiceVolume, 0);
  assert.equal(postRes.sfxVolume, 0.25);

  // Chờ 150ms kiểm tra Stage SSE đã nhận đúng bản tin đồng bộ
  await new Promise(r => setTimeout(r, 150));
  const latest = receivedAudioCfgs.at(-1);
  assert.ok(latest, 'Stage SSE received audioCfg update');
  assert.equal(latest.musicEnabled, false);
  assert.equal(latest.musicVolume, 0);
  assert.equal(latest.voiceVolume, 0);
  assert.equal(latest.sfxVolume, 0.25);

  // Khôi phục lại mặc định sạch sẽ trong settings.json
  await fetch(`http://127.0.0.1:${port}/api/audio`, {
   method: 'POST',
   headers: {'Content-Type': 'application/json'},
   body: JSON.stringify({masterEnabled: true, musicEnabled: true, voiceEnabled: true, musicVolume: 0.12, sfxVolume: 0.35, voiceVolume: 1})
  });
  sseAbort.abort();
  await pumpSse;
 } finally {
  try { await fetch(`http://127.0.0.1:${port}/api/server/shutdown`, {method: 'POST'}); } catch {}
  try { proc.kill(); } catch {}
 }
});
