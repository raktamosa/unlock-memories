(function(){
  "use strict";
  const $ = id => document.getElementById(id);

  const pageLock = $("pageLock"), pageBook = $("pageBook");
  const form = $("lockForm"), input = $("dateInput"), errMsg = $("errMsg");
  const audio = $("song"), player = $("player");
  const btnPlay = $("btnPlay"), btnMute = $("btnMute"), seek = $("seek");
  const tCur = $("tCur"), tDur = $("tDur");

  const SECRET = (form.dataset.secretDate || "").replace(/\D/g,"");

  const moonText = $("moonText");
  if(!moonText.textContent.trim()) moonText.textContent = form.dataset.secretDate || "";

  audio.setAttribute("playsinline","");
  audio.setAttribute("webkit-playsinline","");
  try{ audio.volume = 0.8; }catch(e){}

  (function stars(){
    const c = $("stars"), x = c.getContext("2d");
    let w, h, list = [];
    function size(){
      const d = Math.min(window.devicePixelRatio||1, 2);
      w = c.width = innerWidth*d; h = c.height = innerHeight*d;
      list = Array.from({length:Math.round(innerWidth/9)},()=>({
        x:Math.random()*w, y:Math.random()*h,
        r:(Math.random()*1.4+.3)*d, a:Math.random()*.6+.2, s:Math.random()*.4+.1
      }));
    }
    function draw(){
      x.clearRect(0,0,w,h);
      list.forEach(s=>{
        s.a += (Math.random()-.5)*.03*s.s*3;
        s.a = Math.max(.1,Math.min(.9,s.a));
        x.beginPath(); x.arc(s.x,s.y,s.r,0,6.283);
        x.fillStyle = `rgba(236,220,184,${s.a})`; x.fill();
      });
      if(!matchMedia("(prefers-reduced-motion:reduce)").matches) requestAnimationFrame(draw);
    }
    size(); draw();
    addEventListener("resize", size);
  })();

  input.addEventListener("input", ()=>{
    input.classList.remove("error"); errMsg.textContent = "";
    const digits = input.value.replace(/\D/g,"").slice(0,4);
    input.value = digits.length>2 ? digits.slice(0,2)+"/"+digits.slice(2) : digits;
  });

  function dateOK(){
    const typed = input.value.replace(/\D/g,"");
    return typed.length>0 && typed === SECRET;
  }

  let started = false;
  let wantPlay = false;

  function fmt(t){
    if(!isFinite(t)) return "0:00";
    const m = Math.floor(t/60), s = Math.floor(t%60);
    return m+":"+String(s).padStart(2,"0");
  }
  function setPlayingUI(on){ player.classList.toggle("playing", on); }

  function safePlay(){
    const p = audio.play();
    if(p && p.catch) p.catch(()=>{});
    return p;
  }

  audio.addEventListener("play",    ()=>setPlayingUI(true));
  audio.addEventListener("playing", ()=>setPlayingUI(true));
  audio.addEventListener("pause",   ()=>setPlayingUI(false));
  audio.addEventListener("ended", ()=>{
    wantPlay = false;
    setPlayingUI(false);
    seek.value = 0;
    seek.style.setProperty("--pct","0%");
    tCur.textContent = "0:00";
  });
  audio.addEventListener("loadedmetadata", ()=>{ tDur.textContent = fmt(audio.duration); });
  audio.addEventListener("durationchange", ()=>{ tDur.textContent = fmt(audio.duration); });

  let seeking = false;
  audio.addEventListener("timeupdate", ()=>{
    if(seeking) return;
    tCur.textContent = fmt(audio.currentTime);
    if(audio.duration){
      const p = audio.currentTime/audio.duration*1000;
      seek.value = p; seek.style.setProperty("--pct",(p/10)+"%");
    }
  });
  seek.addEventListener("input", ()=>{
    seeking = true;
    seek.style.setProperty("--pct",(seek.value/10)+"%");
    if(audio.duration) tCur.textContent = fmt(seek.value/1000*audio.duration);
  });
  seek.addEventListener("change", ()=>{
    if(audio.duration) audio.currentTime = seek.value/1000*audio.duration;
    seeking = false;
  });

  btnPlay.addEventListener("click", ()=>{
    if(audio.paused){
      wantPlay = true;
      safePlay();
    }else{
      wantPlay = false;
      audio.pause();
    }
  });
  btnMute.addEventListener("click", ()=>{
    audio.muted = !audio.muted;
    player.classList.toggle("muted", audio.muted);
  });

  function openBook(){
    if(!started){
      started = true;
      wantPlay = true;
      if(audio.currentTime > 0){ try{ audio.currentTime = 0; }catch(e){} }
      const p = audio.play();
      if(p && p.catch) p.catch(()=>{ started = false; wantPlay = false; });
    }
    pageLock.classList.add("hidden"); pageLock.setAttribute("aria-hidden","true");
    pageBook.classList.remove("hidden"); pageBook.setAttribute("aria-hidden","false");
  }

  form.addEventListener("submit", e=>{
    e.preventDefault();
    if(dateOK()){
      input.blur();
      openBook();
    }else{
      input.classList.remove("error"); void input.offsetWidth; input.classList.add("error");
      errMsg.textContent = "Tanggalnya belum tepat, coba lagi ya.";
    }
  });

  $("btnClose").addEventListener("click", ()=>{
    wantPlay = false;
    audio.pause();
    started = false;
    pageBook.classList.add("hidden"); pageBook.setAttribute("aria-hidden","true");
    pageLock.classList.remove("hidden"); pageLock.setAttribute("aria-hidden","false");
    input.value = "";
  });

  function resumeIfNeeded(){
    if(started && wantPlay && audio.paused && !audio.ended) safePlay();
  }
  document.addEventListener("visibilitychange", ()=>{
    if(!document.hidden) resumeIfNeeded();
  });
  addEventListener("pageshow", resumeIfNeeded);
  addEventListener("focus", resumeIfNeeded);

  if("mediaSession" in navigator){
    try{
      navigator.mediaSession.metadata = new MediaMetadata({ title:"Bergema Sampai Selama-nya", artist:"Our Journey" });
      navigator.mediaSession.setActionHandler("play",  ()=>{ wantPlay = true; safePlay(); });
      navigator.mediaSession.setActionHandler("pause", ()=>{ wantPlay = false; audio.pause(); });
    }catch(e){}
  }
})();