const toast = document.getElementById("toast");
const toastTitle = document.getElementById("toastTitle");
const toastText = document.getElementById("toastText");
let toastTimer;
const gameDialog = document.getElementById("gameDialog");
const gameFrame = document.getElementById("gameFrame");

function showToast(title, text) {
  toastTitle.textContent = title;
  toastText.textContent = text;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 3200);
}

const gameDocument = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nexus Rift Arcade</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#080b0f;color:#f5f7f8;font-family:Arial,sans-serif}
.wrap{width:min(100%,800px);padding:10px 12px}.toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:0 2px 10px}
.title{color:#aab3b8;font-size:12px;text-transform:uppercase;letter-spacing:1px}.stats{color:#aab3b8;font-size:11px;text-align:right}.stats strong{color:#b8ff35;font-size:17px}
.controls{display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap}
select{min-width:0;max-width:52%;padding:9px 28px 9px 10px;border:1px solid #374148;background:#11181c;color:#b8ff35;font-weight:700}
.controls button{padding:9px 10px;border:1px solid #374148;background:#11181c;color:#b8ff35;font-size:10px;white-space:nowrap}
.controls button[aria-pressed="false"]{color:#aab3b8}
canvas{display:block;width:auto;height:min(480px,60vw,calc(100vh - 120px));max-width:100%;aspect-ratio:5/3;margin:0 auto;border:1px solid #273138;background:#0b1115;touch-action:none}
.stage{position:relative}.overlay{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:12px;padding:20px;text-align:center;background:rgba(5,9,12,.84)}
.overlay[hidden]{display:none}.overlay h1{margin:0;color:#b8ff35;font-size:clamp(28px,6vw,48px);letter-spacing:3px}.overlay p{max-width:360px;margin:0;color:#c0c8cc;font-size:13px;line-height:1.6}
button{padding:12px 22px;border:0;background:#b8ff35;color:#111;font-weight:800;text-transform:uppercase;letter-spacing:1px;cursor:pointer}
</style>
</head>
<body>
<main class="wrap" id="arcade" data-default-mode="dodge">
  <div class="toolbar">
    <div class="controls">
    <select id="gameMode" aria-label="Choose a game">
      <option value="dodge">Neon Dodge</option>
      <option value="collector">Gem Rush</option>
      <option value="breaker">Block Breaker</option>
    </select>
    <button id="soundToggle" type="button" aria-pressed="true">SFX on</button>
    <button id="nextMode" type="button">Next</button>
    </div>
    <div class="stats"><span id="status">Ready</span><br>Score <strong id="score">0</strong></div>
  </div>
  <div class="stage">
    <canvas id="board" width="800" height="480" tabindex="0" aria-label="Nexus Rift arcade game area"></canvas>
    <div class="overlay" id="overlay"><h1 id="message">NEON DODGE</h1><p id="hint">Move with WASD, arrow keys, or touch. You have 5 lives.</p><button id="start">Start game</button></div>
  </div>
</main>
<script>
const canvas=document.getElementById("board"),ctx=canvas.getContext("2d"),scoreOut=document.getElementById("score"),statusOut=document.getElementById("status");
const overlay=document.getElementById("overlay"),message=document.getElementById("message"),hint=document.getElementById("hint"),start=document.getElementById("start"),selector=document.getElementById("gameMode"),soundToggle=document.getElementById("soundToggle"),nextModeButton=document.getElementById("nextMode");
const shell=document.getElementById("arcade"),keys=new Set();
const player={x:386,y:400,w:28,h:28,speed:340},paddle={x:325,y:448,w:150,h:14,speed:500};
let mode="dodge",active=false,last=0,elapsed=0,score=0,spawn=0,pointerDown=false,blocks=[],bricks=[],lives=5,runId=0,shield=0;
let ball={x:400,y:400,r:9,vx:150,vy:-180};
const AudioContextClass=window.AudioContext||window.webkitAudioContext;
let audioContext=null,soundEnabled=true;
const descriptions={dodge:"Move with WASD, arrow keys, or touch. You have 5 lives.",collector:"Collect gems and avoid red hazards. You have 5 lives and a recovery shield after a hit.",breaker:"Move the paddle with left/right arrows or touch. You have 5 lives to clear the wall."};
const titles={dodge:"NEON DODGE",collector:"GEM RUSH",breaker:"BLOCK BREAKER"};
function startAudio(){
  if(!soundEnabled||!AudioContextClass)return;
  if(!audioContext)audioContext=new AudioContextClass();
  if(audioContext.state==="suspended")audioContext.resume().catch(error=>console.error("Could not start arcade audio.",error));
}
function playTone(frequency,duration=0.1,type="sine"){
  if(!soundEnabled||!audioContext)return;
  const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),now=audioContext.currentTime;
  oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,now);
  gain.gain.setValueAtTime(0.045,now);gain.gain.exponentialRampToValueAtTime(0.001,now+duration);
  oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start(now);oscillator.stop(now+duration);
}
function draw(){
  ctx.fillStyle="#0b1115";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle="rgba(184,255,53,.06)";ctx.lineWidth=1;
  for(let x=0;x<canvas.width;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,canvas.height);ctx.stroke()}
  for(let y=0;y<canvas.height;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(canvas.width,y);ctx.stroke()}
  if(mode==="breaker"){
    for(const brick of bricks){if(!brick.alive)continue;ctx.fillStyle=brick.color;ctx.shadowColor=brick.color;ctx.shadowBlur=10;ctx.fillRect(brick.x,brick.y,brick.w,brick.h)}
    ctx.shadowBlur=0;ctx.fillStyle="#b8ff35";ctx.fillRect(paddle.x,paddle.y,paddle.w,paddle.h);
    ctx.beginPath();ctx.arc(ball.x,ball.y,ball.r,0,Math.PI*2);ctx.fillStyle="#f5f7f8";ctx.shadowColor="#b8ff35";ctx.shadowBlur=12;ctx.fill();ctx.shadowBlur=0;return;
  }
  ctx.fillStyle=mode==="collector"?"#72dcff":"#b8ff35";ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=18;ctx.fillRect(player.x,player.y,player.w,player.h);ctx.shadowBlur=0;
  if(shield>0){ctx.strokeStyle="#f5f7f8";ctx.lineWidth=2;ctx.strokeRect(player.x-4,player.y-4,player.w+8,player.h+8)}
  for(const item of blocks){
    if(item.kind==="gem"){ctx.beginPath();ctx.arc(item.x+item.w/2,item.y+item.h/2,item.w/2,0,Math.PI*2);ctx.fillStyle="#ffd45c";ctx.shadowColor="#ffd45c";ctx.shadowBlur=14;ctx.fill()}
    else{ctx.fillStyle="#ff4f79";ctx.shadowColor="#ff4f79";ctx.shadowBlur=10;ctx.fillRect(item.x,item.y,item.w,item.h)}
  }
  ctx.shadowBlur=0;
}
function setMode(){
  active=false;runId++;mode=selector.value;keys.clear();blocks=[];bricks=[];score=0;lives=5;shield=0;
  player.x=canvas.width/2-player.w/2;player.y=canvas.height-62;paddle.x=(canvas.width-paddle.w)/2;resetBall();
  scoreOut.textContent="0";message.textContent=titles[mode];hint.textContent=descriptions[mode];start.textContent="Start game";overlay.hidden=false;
  statusOut.textContent="Lives: 5";draw();
}
function finish(won=false){
  active=false;runId++;message.textContent=won?"YOU WIN":"GAME OVER";
  hint.textContent=won?"You cleared the wall with "+score+" points. Play again?":"Final score: "+score+". Pick a game or play again.";
  start.textContent="Play again";overlay.hidden=false;statusOut.textContent=won?"Complete":"Finished";
  playTone(won?880:120,0.24,won?"triangle":"sawtooth");
}
function movePlayer(dt){
  if(mode==="breaker"){
    if(keys.has("ArrowLeft")||keys.has("a"))paddle.x-=paddle.speed*dt;
    if(keys.has("ArrowRight")||keys.has("d"))paddle.x+=paddle.speed*dt;
    paddle.x=Math.max(0,Math.min(canvas.width-paddle.w,paddle.x));return;
  }
  if(keys.has("ArrowLeft")||keys.has("a"))player.x-=player.speed*dt;
  if(keys.has("ArrowRight")||keys.has("d"))player.x+=player.speed*dt;
  if(keys.has("ArrowUp")||keys.has("w"))player.y-=player.speed*dt;
  if(keys.has("ArrowDown")||keys.has("s"))player.y+=player.speed*dt;
  player.x=Math.max(0,Math.min(canvas.width-player.w,player.x));player.y=Math.max(0,Math.min(canvas.height-player.h,player.y));
}
function overlaps(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
function loseLife(){
  lives--;statusOut.textContent="Lives: "+lives;
  playTone(150,0.2,"sawtooth");
  if(lives<=0){finish();return false}
  shield=1.2;player.x=canvas.width/2-player.w/2;player.y=canvas.height-62;return true;
}
function updateDodge(dt){
  spawn+=dt;if(spawn>.8){spawn=0;const w=28+Math.random()*48;blocks.push({x:Math.random()*(canvas.width-w),y:-40,w:w,h:18+Math.random()*25,speed:160+Math.min(elapsed*8,220)+Math.random()*50,kind:"hazard"})}
  for(let i=blocks.length-1;i>=0;i--){const b=blocks[i];b.y+=b.speed*dt;if(b.y>canvas.height){blocks.splice(i,1);continue}if(shield<=0&&overlaps(player,b)){blocks.splice(i,1);if(!loseLife())return;break}}
  score=Math.floor(elapsed*10);
}
function updateCollector(dt){
  spawn+=dt;if(spawn>.7){spawn=0;const isHazard=Math.random()<.28,w=isHazard?30:18;blocks.push({x:Math.random()*(canvas.width-w),y:-30,w:w,h:w,speed:120+Math.random()*80+Math.min(elapsed*3,80),kind:isHazard?"hazard":"gem"})}
  for(let i=blocks.length-1;i>=0;i--){const item=blocks[i];item.y+=item.speed*dt;if(item.y>canvas.height+20){blocks.splice(i,1);continue}if(overlaps(player,item)){if(item.kind==="hazard"){blocks.splice(i,1);if(shield<=0&&!loseLife())return  }else{score+=10;playTone(720,0.08);blocks.splice(i,1)}}}
}
function resetBall(){ball.x=canvas.width/2;ball.y=paddle.y-20;ball.vx=(Math.random()>.5?1:-1)*150;ball.vy=-180}
function updateBreaker(dt){
  ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;
  if(ball.x<ball.r){ball.x=ball.r;ball.vx=Math.abs(ball.vx);playTone(260,0.04,"triangle")}
  else if(ball.x>canvas.width-ball.r){ball.x=canvas.width-ball.r;ball.vx=-Math.abs(ball.vx);playTone(260,0.04,"triangle")}
  if(ball.y<ball.r){ball.y=ball.r;ball.vy=Math.abs(ball.vy)}
  if(ball.vy>0&&ball.y+ball.r>=paddle.y&&ball.y-ball.r<=paddle.y+paddle.h&&ball.x+ball.r>=paddle.x&&ball.x-ball.r<=paddle.x+paddle.w){
    ball.y=paddle.y-ball.r;ball.vy=-Math.abs(ball.vy);ball.vx=Math.max(-220,Math.min(220,((ball.x-(paddle.x+paddle.w/2))/(paddle.w/2))*220));playTone(340,0.06,"triangle");
  }
  for(const brick of bricks){if(!brick.alive)continue;const box={x:brick.x,y:brick.y,w:brick.w,h:brick.h};if(ball.x+ball.r>box.x&&ball.x-ball.r<box.x+box.w&&ball.y+ball.r>box.y&&ball.y-ball.r<box.y+box.h){brick.alive=false;ball.vy=-ball.vy;score+=10;playTone(520,0.06,"square");break}}
  if(ball.y>canvas.height+ball.r){lives--;statusOut.textContent="Lives: "+lives;playTone(150,0.2,"sawtooth");if(lives<=0){finish();return}resetBall()}
  if(bricks.every(brick=>!brick.alive))finish(true);
}
function tick(now,run){
  if(!active||run!==runId)return;const dt=Math.min((now-last)/1000,.04);last=now;elapsed+=dt;shield=Math.max(0,shield-dt);movePlayer(dt);
  if(mode==="dodge")updateDodge(dt);else if(mode==="collector")updateCollector(dt);else updateBreaker(dt);
  scoreOut.textContent=score;draw();if(active)requestAnimationFrame(time=>tick(time,run));
}
function begin(){
  startAudio();
  playTone(440,0.08);
  const run=++runId;mode=selector.value;active=true;elapsed=0;spawn=0;score=0;lives=5;shield=0;blocks=[];keys.clear();
  player.x=canvas.width/2-player.w/2;player.y=canvas.height-62;paddle.x=(canvas.width-paddle.w)/2;
  bricks=[];
  if(mode==="breaker"){for(let row=0;row<5;row++)for(let col=0;col<10;col++)bricks.push({x:35+col*73,y:45+row*32,w:63,h:20,alive:true,color:["#b8ff35","#72dcff","#b06cff","#ff9d42","#ff4f79"][row]});resetBall();statusOut.textContent="Lives: 5"}
  else statusOut.textContent="Lives: 5";
  scoreOut.textContent="0";message.textContent=titles[mode];overlay.hidden=true;canvas.focus();draw();last=performance.now();requestAnimationFrame(time=>tick(time,run));
}
selector.addEventListener("change",setMode);start.addEventListener("click",begin);
soundToggle.addEventListener("click",()=>{
  soundEnabled=!soundEnabled;soundToggle.textContent=soundEnabled?"SFX on":"SFX off";
  soundToggle.setAttribute("aria-pressed",String(soundEnabled));
  if(soundEnabled){startAudio();playTone(660,0.08)}
});
nextModeButton.addEventListener("click",()=>{
  selector.selectedIndex=(selector.selectedIndex+1)%selector.options.length;setMode();begin();
});
window.addEventListener("keydown",event=>{const key=event.key.length===1?event.key.toLowerCase():event.key;if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"," "].includes(key))event.preventDefault();keys.add(key)});
window.addEventListener("keyup",event=>keys.delete(event.key.length===1?event.key.toLowerCase():event.key));
window.addEventListener("blur",()=>keys.clear());
canvas.addEventListener("pointerdown",event=>{pointerDown=true;canvas.setPointerCapture(event.pointerId);movePointer(event)});
canvas.addEventListener("pointermove",event=>{if(pointerDown)movePointer(event)});
canvas.addEventListener("pointerup",()=>pointerDown=false);canvas.addEventListener("pointercancel",()=>pointerDown=false);
function movePointer(event){
  const r=canvas.getBoundingClientRect(),x=((event.clientX-r.left)/r.width)*canvas.width;
  if(mode==="breaker")paddle.x=Math.max(0,Math.min(canvas.width-paddle.w,x-paddle.w/2));
  else{player.x=x-player.w/2;player.y=((event.clientY-r.top)/r.height)*canvas.height-player.h/2;player.x=Math.max(0,Math.min(canvas.width-player.w,player.x));player.y=Math.max(0,Math.min(canvas.height-player.h,player.y))}
  draw();
}
selector.value=shell.dataset.defaultMode;setMode();
<\/script>
</body>
</html>`;

function openGame(mode = "dodge") {
  const gameMode = ["dodge", "collector", "breaker"].includes(mode) ? mode : "dodge";
  gameFrame.srcdoc = gameDocument.replace('data-default-mode="dodge"', 'data-default-mode="' + gameMode + '"');
  gameDialog.showModal();
}

document.getElementById("playButton").addEventListener("click", openGame);
document.getElementById("closeGame").addEventListener("click", () => gameDialog.close());
gameDialog.addEventListener("click", (event) => {
  if (event.target === gameDialog) gameDialog.close();
});
gameDialog.addEventListener("close", () => { gameFrame.srcdoc = ""; });
document.getElementById("downloadGame").addEventListener("click", () => {
  const file = new Blob([gameDocument], { type: "text/html" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = "nexus-rift-arcade.html";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Arcade downloaded", "Open nexus-rift-arcade.html to play all 3 games offline.");
});

document.querySelectorAll(".card-button").forEach((button) => {
  button.addEventListener("click", () => {
    const gameCard = button.closest(".game-card");
    if (gameCard.dataset.game) {
      openGame(gameCard.dataset.game);
      return;
    }
    showToast(gameCard.dataset.title, "This game is a concept preview.");
  });
});

const gameGrid = document.getElementById("gameGrid");
document.getElementById("nextGame").addEventListener("click", () => {
  gameGrid.scrollBy({ left: 320, behavior: "smooth" });
});
document.getElementById("prevGame").addEventListener("click", () => {
  gameGrid.scrollBy({ left: -320, behavior: "smooth" });
});

document.querySelectorAll(".nav-links a").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelector(".nav-links a.active")?.classList.remove("active");
    link.classList.add("active");
  });
});

function createPlayerId() {
  const values = new Uint16Array(3);
  window.crypto.getRandomValues(values);
  return "RIFT-" + Array.from(values, (value) => value.toString(16).padStart(4, "0")).join("").toUpperCase();
}

const playerNameInput = document.getElementById("playerName");
const playerRankSelect = document.getElementById("playerRank");
const playerDisplayName = document.getElementById("playerDisplayName");
const playerIdElement = document.getElementById("playerId");
const playerRanks = ["Rookie", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Master", "Legend"];
const sharedProfile = new URLSearchParams(window.location.hash.slice(1));
const sharedPlayerId = sharedProfile.get("player");
const isSharedProfile = /^RIFT-[A-F0-9]{12}$/.test(sharedPlayerId || "");
let playerId = isSharedProfile ? sharedPlayerId : "";
if (isSharedProfile) {
  playerNameInput.value = (sharedProfile.get("name") || "Neon Player").slice(0, 20);
  const sharedRank = sharedProfile.get("rank");
  if (playerRanks.includes(sharedRank)) playerRankSelect.value = sharedRank;
  playerNameInput.disabled = true;
  playerRankSelect.disabled = true;
  document.getElementById("savePlayer").disabled = true;
  document.getElementById("savePlayer").textContent = "Viewing";
  document.getElementById("playerModeLabel").textContent = "SHARED RIFT PLAYER";
} else {
  try {
    playerId = localStorage.getItem("nexus-rift-player-id") || createPlayerId();
    localStorage.setItem("nexus-rift-player-id", playerId);
    playerNameInput.value = localStorage.getItem("nexus-rift-player-name") || playerNameInput.value;
    const savedRank = localStorage.getItem("nexus-rift-player-rank");
    if (playerRanks.includes(savedRank)) playerRankSelect.value = savedRank;
  } catch (error) {
    playerId = createPlayerId();
    console.error("Could not load the saved player profile.", error);
    showToast("Profile storage unavailable", "Your player ID will last for this visit only.");
  }
}

function profileUrl() {
  const url = new URL(window.location.href);
  url.hash = new URLSearchParams({
    player: playerId,
    name: playerNameInput.value.trim() || "Neon Player",
    rank: playerRankSelect.value
  }).toString();
  return url.href;
}

function renderPlayerProfile() {
  playerIdElement.textContent = playerId;
  const savedName = playerNameInput.value.trim();
  playerDisplayName.textContent = savedName || "Neon Player";
  const qrContainer = document.getElementById("playerQr");
  qrContainer.replaceChildren();
  if (typeof QRCode === "undefined") {
    qrContainer.textContent = "QR unavailable";
    document.getElementById("qrNote").textContent = "QR generation needs an internet connection. Your player ID is still available to share.";
    return;
  }
  new QRCode(qrContainer, {
    text: profileUrl(),
    width: 102,
    height: 102,
    colorDark: "#101519",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });
  document.getElementById("qrNote").textContent = window.location.protocol === "file:"
    ? "Publish this site to let friends open your QR code on other devices."
    : "Your QR links to this page with your unique player ID.";
}

document.getElementById("savePlayer").addEventListener("click", () => {
  if (isSharedProfile) return;
  const name = playerNameInput.value.trim().slice(0, 20) || "Neon Player";
  playerNameInput.value = name;
  try {
    localStorage.setItem("nexus-rift-player-name", name);
  } catch (error) {
    console.error("Could not save the player name.", error);
    showToast("Name not saved", "Browser storage is unavailable on this device.");
  }
  renderPlayerProfile();
  showToast("Player profile updated", "Your RIFT ID is ready to share.");
});

playerRankSelect.addEventListener("change", () => {
  if (isSharedProfile) return;
  try {
    localStorage.setItem("nexus-rift-player-rank", playerRankSelect.value);
  } catch (error) {
    console.error("Could not save the player rank.", error);
    showToast("Rank not saved", "Browser storage is unavailable on this device.");
  }
  renderPlayerProfile();
  showToast("Rank updated", "Your selected rank is on your player card.");
});

document.getElementById("copyPlayerLink").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(profileUrl());
    showToast("Profile link copied", "Share it with your friends.");
  } catch (error) {
    console.error("Could not copy the player profile link.", error);
    showToast("Copy unavailable", "You can share your RIFT player ID: " + playerId);
  }
});

renderPlayerProfile();