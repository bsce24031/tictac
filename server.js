const express=require('express'),http=require('http'),{Server}=require('socket.io');
const app=express(),srv=http.createServer(app);
const io=new Server(srv,{cors:{origin:process.env.CORS_ORIGIN||false}});
const rooms=new Map(),byToken=new Map();
const L=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
app.disable('x-powered-by');
app.use(express.static('public'));
app.get('/health',(q,r)=>r.json({ok:true,rooms:rooms.size}));
const result=b=>{for(const l of L){const[a,c,d]=l;if(b[a]&&b[a]===b[c]&&b[a]===b[d])return{w:b[a],line:l}}return b.every(Boolean)?{w:'draw'}:null};
const clean=s=>String(s||'').replace(/[^\p{L}\p{N} _-]/gu,'').trim().slice(0,14)||'Player';
const av=n=>Number.isInteger(n)&&n>=0&&n<8?n:0;
function newCode(name){const p=(name.replace(/[^A-Za-z]/g,'').toUpperCase()+'GAME').slice(0,4);
 for(;;){const c=p+'-'+(1000+Math.floor(Math.random()*9000));if(!rooms.has(c))return c}}
function view(r){const p=s=>r.p[s]&&{name:r.p[s].name,avatar:r.p[s].avatar,online:r.p[s].online};
 return{code:r.code,X:p('X'),O:p('O'),board:r.board,turn:r.turn,status:r.status,scores:r.scores,games:r.games,
  line:r.res&&r.res.line||null,winner:r.res&&r.res.w||null,votes:Object.keys(r.votes)}}
const push=r=>{for(const k of['X','O'])if(r.p[k]&&r.p[k].sid)io.to(r.p[k].sid).emit('state',{...view(r),you:k})};
function reset(r){r.board=Array(9).fill(null);r.res=null;r.votes={};r.status='playing';r.turn=r.starter}
function drop(r){rooms.delete(r.code);for(const s of['X','O'])r.p[s]&&byToken.delete(r.p[s].token)}
io.use((s,n)=>{const t=s.handshake.auth&&s.handshake.auth.token;
 if(typeof t!=='string'||t.length<8||t.length>64)return n(new Error('bad token'));s.data.token=t;n()});
io.on('connection',s=>{
 const tok=s.data.token;let hits=0;const tick=setInterval(()=>hits=0,1000);
 const ok=()=>++hits<=10;
 const mine=()=>{const c=byToken.get(tok);const r=c&&rooms.get(c);if(!r)return[];return[r,r.p.X&&r.p.X.token===tok?'X':'O']};
 const attach=(r,sym)=>{r.p[sym].sid=s.id;r.p[sym].online=true;r.seen=Date.now();s.join(r.code);push(r)};
 {const[r,sym]=mine();if(r)attach(r,sym)}
 s.on('create',(d,cb)=>{if(!ok())return;const[old]=mine();if(old)return cb({err:'You are already in a room.'});
  const name=clean(d&&d.name),code=newCode(name);
  const r={code,p:{X:{token:tok,name,avatar:av(d&&d.avatar)}},board:Array(9).fill(null),turn:'X',starter:'X',status:'waiting',
   scores:{X:0,O:0,draw:0},games:0,res:null,votes:{},seen:Date.now()};
  rooms.set(code,r);byToken.set(tok,code);attach(r,'X');cb({ok:true,code})});
 s.on('join',(d,cb)=>{if(!ok())return;const code=String(d&&d.code||'').toUpperCase().trim(),r=rooms.get(code);
  if(!/^[A-Z]{4}-\d{4}$/.test(code))return cb({err:'That room code looks invalid.'});
  if(!r)return cb({err:'Room not found or expired.'});
  if(r.p.O)return cb({err:r.status==='waiting'?'Room is full.':'Match already started.'});
  if(r.p.X.token===tok)return cb({err:"That's your own room!"});
  r.p.O={token:tok,name:clean(d.name),avatar:av(d.avatar)};byToken.set(tok,code);reset(r);attach(r,'O');cb({ok:true})});
 s.on('move',i=>{if(!ok())return;const[r,sym]=mine();
  if(!r||r.status!=='playing'||r.turn!==sym||!Number.isInteger(i)||i<0||i>8||r.board[i])return;
  r.board[i]=sym;r.res=result(r.board);
  if(r.res){r.status='over';r.games++;r.scores[r.res.w==='draw'?'draw':r.res.w]++}else r.turn=sym==='X'?'O':'X';
  r.seen=Date.now();push(r)});
 s.on('rematch',()=>{const[r,sym]=mine();if(!r||r.status!=='over')return;r.votes[sym]=1;
  if(r.votes.X&&r.votes.O){r.starter=r.starter==='X'?'O':'X';reset(r)}push(r)});
 s.on('leave',()=>{const[r,sym]=mine();if(!r)return;s.leave(r.code);
  const other=sym==='X'?'O':'X';byToken.delete(tok);
  if(r.p[other]){io.to(r.code).emit('opponentLeft');drop(r)}else drop(r)});
 s.on('disconnect',()=>{clearInterval(tick);const[r,sym]=mine();if(r&&r.p[sym].sid===s.id){r.p[sym].online=false;r.seen=Date.now();push(r)}});
});
setInterval(()=>{const now=Date.now();for(const r of rooms.values()){
 const off=!(r.p.X&&r.p.X.online)&&!(r.p.O&&r.p.O.online);
 if((off&&now-r.seen>10*60e3)||(r.status==='waiting'&&now-r.seen>15*60e3))drop(r)}},60e3);
const PORT=process.env.PORT||3000;srv.listen(PORT,()=>console.log('TicTac Arena on '+PORT));
process.on('unhandledRejection',e=>console.error(e));
