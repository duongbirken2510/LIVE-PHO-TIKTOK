import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('./game.js',import.meta.url),'utf8');
const code=source.split('// SELLER VOICE START')[1].split('// SELLER VOICE END')[0];
const {createSellerVoice}=await import('data:text/javascript,'+encodeURIComponent(code));

test('seller thanks the named customer in Vietnamese, queues speech, ducks music and cancels safely',()=>{
 const utterances=[],duck=[],timers=new Map();let n=0,cancels=0;
 const synth={getVoices:()=>[{lang:'vi-VN',name:'Microsoft HoaiMy Online (Natural)',voiceURI:'vi-hoaimy'}],speak:u=>{utterances.push(u);u.onstart();},cancel:()=>cancels++};
 const voice=createSellerVoice({synth,Utterance:class{constructor(text){this.text=text;}},onSpeaking:value=>duck.push(value),setTimer:cb=>{timers.set(++n,cb);return n;},clearTimer:id=>timers.delete(id)});
 voice.thank({name:'Trước khi bật'},'Phở Bò Tái');assert.equal(utterances.length,0);assert.equal(voice.enable(),true);
 voice.thank({name:'Anh Minh'},'Phở Bò Tái');voice.thank({name:'Chị Thảo'},'Phở Đặc Biệt');
 assert.equal(utterances.length,1);
 assert.match(utterances[0].text,/bạn Anh Minh/);
 assert.match(utterances[0].text,/ngon miệng/);
 assert.equal(utterances[0].voice.voiceURI,'vi-hoaimy');
 assert.equal(duck.at(-1),true);
 utterances[0].onend();assert.equal(utterances.length,2);assert.match(utterances[1].text,/Chị Thảo/);
 for(let i=0;i<20;i++)voice.thank({name:'Khách '+i});assert.equal(voice.getState().queued,5);
 const stale=utterances[1];voice.disable();stale.onend();
 assert.equal(voice.getState().enabled,false);assert.equal(voice.getState().speaking,false);assert.equal(voice.getState().queued,0);assert.equal(duck.at(-1),false);assert.equal(timers.size,0);assert.equal(cancels,1);
});

test('order cooking script, join greeting with anti-spam cooldown, custom shopName, sayNow, and idle callout work',()=>{
 let fakeNow=100000;
 const spoken=[];
 const voice=createSellerVoice({
  synth:{getVoices:()=>[],cancel(){}},
  Utterance:class{},
  clock:()=>fakeNow,
  onlineSpeak:(text,_vol,_rate,_uri,{onStart,onEnd})=>{const item={text,onEnd};spoken.push(item);onStart();return ()=>{};}
 });
 assert.equal(voice.enable(),true);
 voice.configure({shopName:'Phở Gia Truyền Hà Nội',rate:1.15});
 assert.equal(voice.social({social:'join',name:'Tuấn'}),true);
 assert.match(spoken.at(-1).text,/bạn Tuấn/);
 assert.match(spoken.at(-1).text,/Phở Gia Truyền Hà Nội/);
 assert.equal(voice.social({social:'join',name:'Người Lạ'}),false);
 spoken.at(-1).onEnd();
 fakeNow+=5000;
 assert.equal(voice.social({social:'like',name:'Bé Mèo'}),false);
 fakeNow+=10000;
 assert.equal(voice.social({social:'like',name:'Bé Mèo'}),true);
 assert.match(spoken.at(-1).text,/bạn Bé Mèo/);
 spoken.at(-1).onEnd();
 assert.equal(voice.ackOrder({name:'Hoàng'},'Phở Bò Tái Mềm','Rose'),true);
 assert.match(spoken.at(-1).text,/Rose/);
 spoken.at(-1).onEnd();
 assert.equal(voice.sayNow('Chào mừng cả nhà đến quán phở đêm!'),true);
 assert.match(spoken.at(-1).text,/Chào mừng cả nhà/);
 spoken.at(-1).onEnd();
 fakeNow+=20000;
 assert.equal(voice.idleCallout(),true);
 assert.match(spoken.at(-1).text,/nước lèo hầm xương|bông hồng/);
});

test('missing Vietnamese voice without online fallback does not pretend speech is enabled',()=>{
 const voice=createSellerVoice({synth:{getVoices:()=>[]},Utterance:class{}});
 assert.equal(voice.enable(),false);assert.equal(voice.getState().enabled,false);
});
