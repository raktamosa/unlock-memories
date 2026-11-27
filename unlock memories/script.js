(function(){
  "use strict";
  const $ = id => document.getElementById(id);

  const pageSolar = $("pageSolar"), pageLock = $("pageLock"), pageBook = $("pageBook");
  const form = $("lockForm"), input = $("dateInput");
  const audio = $("song"), player = $("player");
  const btnPlay = $("btnPlay"), btnMute = $("btnMute"), seek = $("seek");
  const tCur = $("tCur"), tDur = $("tDur");

  audio.setAttribute("playsinline","");
  audio.setAttribute("webkit-playsinline","");
  try{ audio.volume = 0.8; }catch(e){}

  ["stars","stars2"].forEach(function(id){
    const c = $(id), x = c.getContext("2d");
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
        x.fillStyle = `rgba(190,212,255,${s.a})`; x.fill();
      });
      if(!matchMedia("(prefers-reduced-motion:reduce)").matches) requestAnimationFrame(draw);
    }
    size(); draw();
    addEventListener("resize", size);
  });

  (function solar(){
    const c = $("solar"), x = c.getContext("2d");
    const TAU = Math.PI*2;
    let w = 0, h = 0, d = 1, base = 1, Z = 1;
    let yaw = 0, tilt = 1, zoom = 1, tx = 0, tz = 0;
    let time = 0, last = 0, state = 0, zt0 = 0, zp = 0, hover = -1, raf = 0;
    const hits = [];
    let seed = 11;
    const rnd = ()=>{ seed = (seed*16807)%2147483647; return (seed-1)/2147483646; };
    const mk = (a,b)=>{ const e = document.createElement("canvas"); e.width = a; e.height = b; return e; };
    const ease = t=>t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;

    function wrap(g,cx,cy,rx,ry,col){
      g.fillStyle = col;
      for(const o of [-512,0,512]){ g.beginPath(); g.ellipse(cx+o,cy,rx,ry,0,0,TAU); g.fill(); }
    }
    function finishTex(t){
      const o = mk(1024,256), g = o.getContext("2d");
      g.drawImage(t,0,0); g.drawImage(t,512,0);
      return o;
    }
    function rock(base0,dark,light,cap){
      const t = mk(512,256), g = t.getContext("2d");
      g.fillStyle = base0; g.fillRect(0,0,512,256);
      for(let i=0;i<190;i++){
        const r = 1+rnd()*8;
        g.globalAlpha = .3+rnd()*.4;
        wrap(g,rnd()*512,rnd()*256,r,r*(.6+rnd()*.5),rnd()>.5 ? dark : light);
      }
      g.globalAlpha = 1;
      if(cap){ g.fillStyle = "rgba(255,255,255,.85)"; g.fillRect(0,0,512,10); g.fillRect(0,246,512,10); }
      return finishTex(t);
    }
    function gas(cols,spot,n){
      const t = mk(512,256), g = t.getContext("2d");
      g.fillStyle = cols[0]; g.fillRect(0,0,512,256);
      for(let i=0;i<n;i++){
        g.globalAlpha = .55+rnd()*.4;
        g.fillStyle = cols[Math.floor(rnd()*cols.length)];
        g.fillRect(0,i*256/n,512,256/n+1);
      }
      g.globalAlpha = .3;
      for(let i=0;i<90;i++) wrap(g,rnd()*512,rnd()*256,18+rnd()*50,.8+rnd()*2.4,cols[Math.floor(rnd()*cols.length)]);
      g.globalAlpha = 1;
      if(spot===1){ wrap(g,210,168,24,13,"rgba(176,66,38,.85)"); wrap(g,210,168,13,6,"rgba(214,120,80,.7)"); }
      if(spot===2){ wrap(g,230,150,20,10,"rgba(10,24,88,.75)"); }
      return finishTex(t);
    }
    const EW = 768, EH = 384;
    let earthLand = null, earthCloud = null;
    function hsh(ix,iy,s){
      let h = Math.imul(ix,374761393)+Math.imul(iy,668265263)+Math.imul(s,1442695041);
      h = Math.imul(h^(h>>>13),1274126177);
      h ^= h>>>16;
      return (h>>>0)/4294967295;
    }
    function vn(x,y,px,s){
      const x0 = Math.floor(x), y0 = Math.floor(y);
      let fx = x-x0, fy = y-y0;
      fx = fx*fx*(3-2*fx); fy = fy*fy*(3-2*fy);
      const a = ((x0%px)+px)%px, b = (a+1)%px;
      const v00 = hsh(a,y0,s), v10 = hsh(b,y0,s), v01 = hsh(a,y0+1,s), v11 = hsh(b,y0+1,s);
      return (v00*(1-fx)+v10*fx)*(1-fy)+(v01*(1-fx)+v11*fx)*fy;
    }
    function fbm(u,v,px,py,oct,s){
      let a = .5, sum = 0, nrm = 0, f = 1;
      for(let o=0;o<oct;o++){
        sum += a*vn(u*px*f,v*py*f,px*f,s+o*17);
        nrm += a; a *= .5; f *= 2;
      }
      return sum/nrm;
    }
    const sm = (a,b,t)=>{ t = Math.max(0,Math.min(1,(t-a)/(b-a))); return t*t*(3-2*t); };
    const mix = (c1,c2,t)=>[c1[0]+(c2[0]-c1[0])*t,c1[1]+(c2[1]-c1[1])*t,c1[2]+(c2[2]-c1[2])*t];
    function buildEarth(){
      earthLand = new Uint8ClampedArray(EW*EH*4);
      earthCloud = new Uint8ClampedArray(EW*EH);
      const SEA = .56;
      for(let j=0;j<EH;j++){
        const v = j/EH, lat = Math.abs(v-.5)*2;
        for(let i=0;i<EW;i++){
          const u = i/EW;
          let e = fbm(u,v,4,2,5,3);
          e = (e-.5)*1.9+.5;
          e += (fbm(u,v,2,1,2,41)-.5)*.35;
          const m = fbm(u,v,5,3,4,91);
          const ruff = fbm(u,v,24,12,3,7);
          let col;
          if(e<SEA){
            const dpt = (SEA-e)/SEA;
            col = mix([30,118,170],[5,26,72],sm(0,.42,dpt));
            col = mix(col,[96,190,196],(1-sm(0,.05,dpt))*.55);
            if(lat>.9+(ruff-.5)*.1) col = mix(col,[232,240,248],sm(.9,.95,lat));
          }else{
            const h = e-SEA;
            const dry = sm(.38,.62,1-m)*(1-sm(.42,.78,lat));
            let g = mix([62,122,52],[26,76,42],sm(.4,.7,m));
            col = mix(g,[204,174,112],dry);
            col = mix(col,[112,118,92],sm(.55,.72,lat));
            col = mix(col,[132,112,92],sm(.1,.22,h+ (ruff-.5)*.08));
            col = mix(col,[176,170,162],sm(.2,.3,h+(ruff-.5)*.1));
            col = mix(col,[244,246,250],sm(.27,.35,h+(ruff-.5)*.08));
            col = mix(col,[204,190,150],1-sm(0,.012,h));
            col = mix(col,[240,244,250],sm(.8,.88,lat+(ruff-.5)*.1));
            const sh = .88+ruff*.24;
            col = [col[0]*sh,col[1]*sh,col[2]*sh];
          }
          const k = (j*EW+i)*4;
          earthLand[k] = col[0]; earthLand[k+1] = col[1]; earthLand[k+2] = col[2];
          earthLand[k+3] = e<SEA ? 1 : 0;
          let c = fbm(u,v,6,3,5,133);
          c = sm(.56,.8,c+(fbm(u,v,3,6,2,57)-.5)*.2);
          earthCloud[j*EW+i] = c*215;
        }
      }
    }
    let eCan = null, eCtx = null, eImg = null, eKey = 0, eG = null;
    function earthGeom(Rd){
      const S = Rd*2, N = S*S;
      const g = {S:S,nx:new Float32Array(N),ny:new Float32Array(N),nz:new Float32Array(N),
        u0:new Float32Array(N),vj:new Int16Array(N),limb:new Float32Array(N),edge:new Float32Array(N),ins:new Uint8Array(N)};
      const tl = .41, ct = Math.cos(tl), st = Math.sin(tl);
      for(let py=0;py<S;py++){
        const ny0 = -((py+.5)-Rd)/Rd;
        for(let px=0;px<S;px++){
          const nx0 = ((px+.5)-Rd)/Rd;
          const r2 = nx0*nx0+ny0*ny0, p = py*S+px;
          if(r2>=1) continue;
          const nz0 = Math.sqrt(1-r2);
          g.ins[p] = 1;
          g.nx[p] = nx0; g.ny[p] = ny0; g.nz[p] = nz0;
          g.edge[p] = Math.min(1,(1-Math.sqrt(r2))*Rd);
          const bx = nx0*ct-ny0*st, by = nx0*st+ny0*ct;
          g.u0[p] = Math.atan2(bx,nz0)/TAU+.5;
          const vv = .5-Math.asin(by)/Math.PI;
          g.vj[p] = Math.min(EH-1,Math.max(0,(vv*EH)|0));
          g.limb[p] = Math.pow(1-nz0,2.6);
        }
      }
      return g;
    }
    function earthDraw(X,Y,R,lx,ly,al){
      const Rd = Math.max(6,Math.min(Math.round(R*d),200));
      const key = Rd<=48 ? Rd : Math.min(200,Math.ceil(Rd/8)*8);
      if(!eG || eKey!==key){
        eG = earthGeom(key); eKey = key;
        eCan = mk(eG.S,eG.S); eCtx = eCan.getContext("2d"); eImg = eCtx.createImageData(eG.S,eG.S);
      }
      const G = eG, N = G.S*G.S, out = eImg.data;
      let Lx = lx*.92, Ly = -ly*.92, Lz = .85;
      const Ln = Math.hypot(Lx,Ly,Lz); Lx /= Ln; Ly /= Ln; Lz /= Ln;
      const hx = Lx, hy = Ly, hz = Lz+1, hn = Math.hypot(hx,hy,hz);
      const ou = time*.32/TAU, oc = time*.4/TAU;
      const nxA = G.nx, nyA = G.ny, nzA = G.nz, u0 = G.u0, vj = G.vj, limbA = G.limb, edgeA = G.edge, ins = G.ins;
      for(let p=0;p<N;p++){
        const o = p*4;
        if(ins[p]===0){ out[o+3] = 0; continue; }
        const nx0 = nxA[p], ny0 = nyA[p], nz0 = nzA[p];
        let uu = u0[p]+ou; uu -= Math.floor(uu);
        let ti = (uu*EW)|0; if(ti>=EW) ti = EW-1;
        let cu = u0[p]+oc; cu -= Math.floor(cu);
        let ci = (cu*EW)|0; if(ci>=EW) ci = EW-1;
        const tj = vj[p];
        const k = (tj*EW+ti)*4;
        let r = earthLand[k], g = earthLand[k+1], b = earthLand[k+2];
        const cl = earthCloud[tj*EW+ci]/255;
        const raw = nx0*Lx+ny0*Ly+nz0*Lz;
        let sh = (raw+.3)/1.3; if(sh<0) sh = 0;
        let spec = 0;
        if(earthLand[k+3]===1 && raw>0){
          const nh = (nx0*hx+ny0*hy+nz0*hz)/hn;
          if(nh>.93){
            let tt = raw/.16; if(tt>1) tt = 1;
            spec = Math.pow(nh,90)*.7*(tt*tt*(3-2*tt))*(1-cl*.8);
          }
        }
        const sc = .95*sh+.1;
        r *= sc; g *= sc; b *= sc;
        let cs = .12+sh; if(cs>1) cs = 1;
        r = r*(1-cl)+(244*cs)*cl; g = g*(1-cl)+(246*cs)*cl; b = b*(1-cl)+(252*cs)*cl;
        const at = limbA[p]*(.25+.9*sh);
        out[o] = r+70*at+255*spec; out[o+1] = g+130*at+250*spec; out[o+2] = b+255*at+235*spec;
        out[o+3] = 255*edgeA[p];
      }
      eCtx.putImageData(eImg,0,0);
      x.save();
      x.globalAlpha = al;
      x.drawImage(eCan,X-R,Y-R,R*2,R*2);
      x.restore();
    }

    const P = [
      {o:62,  r:4.6, s:1.25, spin:.03,  tex:()=>rock("#8f8b85","#5f5c58","#b9b4aa")},
      {o:96,  r:8.2, s:.95,  spin:-.01, tex:()=>gas(["#e8c98a","#d9b26a","#f1dba8","#c99d58"],0,10)},
      {o:138, r:8.6, s:.78,  spin:.06,  atm:true, tex:()=>null},
      {o:182, r:6.2, s:.62,  spin:.05,  tex:()=>rock("#b4532d","#7d3419","#d2784a",true)},
      {o:262, r:19,  s:.4,   spin:.12,  tex:()=>gas(["#d8b48a","#b98b5e","#efe0c4","#9c6b45","#cda27a"],1,14)},
      {o:338, r:16,  s:.31,  spin:.1,   ring:true, tex:()=>gas(["#e6d3a0","#cdb67e","#f2e6c4","#b79e66"],0,12)},
      {o:402, r:11.5,s:.23,  spin:-.07, tex:()=>gas(["#9fe0e6","#86cdd6","#b4eef2"],0,6)},
      {o:458, r:11,  s:.18,  spin:.08,  tex:()=>gas(["#2f55c7","#2543a8","#4a73e0","#203a95"],2,8)}
    ];
    P.forEach(p=>{ p.t = p.tex(); p.ph = rnd()*TAU; });
    const sunTex = rock("#ff9a1f","#e0560a","#ffe08a");

    const belt = Array.from({length:560},()=>({
      a:rnd()*TAU, o:206+rnd()*32, y:(rnd()-.5)*7, s:.46+rnd()*.12, r:.7+rnd()*.9, al:.25+rnd()*.5
    }));
    const field = Array.from({length:300},()=>({
      x:rnd(), y:rnd(), z:.2+rnd()*.8, r:.4+rnd()*1.3, a:.25+rnd()*.7, f:.6+rnd()*2, ph:rnd()*TAU
    }));

    function resize(){
      d = Math.min(window.devicePixelRatio||1,2);
      w = innerWidth; h = innerHeight;
      c.width = Math.round(w*d); c.height = Math.round(h*d);
      base = Math.min(w,h*1.25)*.45/470;
      Z = .55*Math.min(w,h)/(P[2].r*base);
    }

    function proj(px,py,pz){
      const ax = px-tx, az = pz-tz;
      const cy = Math.cos(yaw), sy = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
      const x1 = ax*cy+az*sy, z1 = -ax*sy+az*cy;
      const y2 = py*ct-z1*st, z2 = py*st+z1*ct;
      const s = 1400/(1400-z2)*base*zoom;
      return {x:w/2+x1*s, y:h/2-y2*s, z:z2, s:s};
    }
    function pos(i,sp){
      const a = P[i].ph+time*P[i].s*.5;
      return {x:P[i].o*sp*Math.cos(a), z:P[i].o*sp*Math.sin(a)};
    }

    function sphere(X,Y,R,tex,rot,lx,ly,col,al){
      x.save();
      x.globalAlpha = al;
      x.beginPath(); x.arc(X,Y,R,0,TAU); x.clip();
      if(tex){
        const sx = ((rot%512)+512)%512;
        x.drawImage(tex,sx,0,256,256,X-R,Y-R,R*2,R*2);
      }else{
        x.fillStyle = col; x.fill();
      }
      const g = x.createRadialGradient(X+lx*R*.4,Y+ly*R*.4,R*.05,X+lx*R*.3,Y+ly*R*.3,R*1.35);
      g.addColorStop(0,"rgba(255,255,255,.16)");
      g.addColorStop(.45,"rgba(0,0,0,0)");
      g.addColorStop(.8,"rgba(0,0,10,.5)");
      g.addColorStop(1,"rgba(0,0,12,.9)");
      x.fillStyle = g; x.fillRect(X-R,Y-R,R*2,R*2);
      x.restore();
    }

    function ring(X,Y,R,front,al){
      const ry = Math.max(.1,Math.sin(tilt));
      const cols = ["rgba(214,196,150,.55)","rgba(170,150,110,.4)","rgba(226,210,168,.6)","rgba(150,130,95,.35)"];
      x.save();
      x.globalAlpha = al;
      x.translate(X,Y); x.rotate(-.32);
      for(let j=0;j<4;j++){
        const rr = R*(1.55+j*.26);
        x.beginPath();
        x.ellipse(0,0,rr,rr*ry,0,front ? 0 : Math.PI,front ? Math.PI : TAU);
        x.strokeStyle = cols[j]; x.lineWidth = Math.max(1,R*.24); x.stroke();
      }
      x.restore();
    }

    function sun(X,Y,R,al){
      const pulse = 1+Math.sin(time*1.4)*.04;
      x.save();
      x.globalAlpha = al; x.globalCompositeOperation = "lighter";
      let g = x.createRadialGradient(X,Y,R*.5,X,Y,R*6*pulse);
      g.addColorStop(0,"rgba(255,176,64,.6)");
      g.addColorStop(.25,"rgba(255,122,32,.2)");
      g.addColorStop(1,"rgba(255,80,0,0)");
      x.fillStyle = g; x.beginPath(); x.arc(X,Y,R*6*pulse,0,TAU); x.fill();
      x.restore();
      x.save();
      x.globalAlpha = al;
      x.beginPath(); x.arc(X,Y,R,0,TAU); x.clip();
      const sx = ((time*10)%512+512)%512;
      x.drawImage(sunTex,sx,0,256,256,X-R,Y-R,R*2,R*2);
      g = x.createRadialGradient(X,Y,R*.2,X,Y,R);
      g.addColorStop(0,"rgba(255,244,200,.5)");
      g.addColorStop(.7,"rgba(255,170,50,0)");
      g.addColorStop(1,"rgba(160,40,0,.6)");
      x.fillStyle = g; x.fillRect(X-R,Y-R,R*2,R*2);
      x.restore();
    }

    function planet(i,X,Y,R,s0,al){
      const p = P[i];
      let lx = s0.x-X, ly = s0.y-Y;
      const L = Math.hypot(lx,ly)||1;
      lx /= L; ly /= L;
      if(p.ring) ring(X,Y,R,false,al);
      if(p.atm){
        const g = x.createRadialGradient(X,Y,R*.92,X,Y,R*1.32);
        g.addColorStop(0,"rgba(120,175,255,.55)");
        g.addColorStop(1,"rgba(120,175,255,0)");
        x.save(); x.globalAlpha = al; x.fillStyle = g;
        x.beginPath(); x.arc(X,Y,R*1.32,0,TAU); x.fill();
        x.restore();
      }
      if(i===2) earthDraw(X,Y,R,lx,ly,al); else sphere(X,Y,R,p.t,time*p.spin*300,lx,ly,null,al);
      if(p.ring) ring(X,Y,R,true,al);
      if(hover===i && state===0){
        x.save();
        x.globalAlpha = al;
        x.beginPath(); x.arc(X,Y,R+5,0,TAU);
        x.strokeStyle = "rgba(255,255,255,.55)"; x.lineWidth = 1.5; x.stroke();
        x.restore();
      }
    }

    function pick(px,py){
      let best = -1, bs = 1e9;
      for(const q of hits){
        const r = Math.max(q.R*1.2,20), dd = Math.hypot(px-q.x,py-q.y);
        if(dd<=r && dd/r<bs){ best = q.i; bs = dd/r; }
      }
      return best;
    }

    function finish(){
      state = 2;
      cancelAnimationFrame(raf);
      pageSolar.classList.add("hidden"); pageSolar.setAttribute("aria-hidden","true");
      pageLock.classList.remove("hidden"); pageLock.setAttribute("aria-hidden","false");
    }

    function frame(now){
      if(!last) last = now;
      const dt = Math.min(.05,(now-last)/1000);
      last = now;
      let e = 0, ef = 0;
      if(state===1){
        zp = Math.min(1,(now-zt0)/3000);
        e = ease(zp); ef = ease(Math.min(1,zp*1.6));
      }
      time += dt*(1-.75*e);
      const intro = Math.min(1,time/2.6);
      const sp = 1-Math.pow(1-intro,3);
      const fade = Math.min(1,intro*1.8);
      yaw = .5+time*.05;
      tilt = (1.02+Math.sin(time*.25)*.05)*(1-e)+.5*e;
      const ep = pos(2,sp);
      tx = ep.x*ef; tz = ep.z*ef;
      zoom = Math.exp(Math.log(Z)*e);

      x.setTransform(d,0,0,d,0,0);
      x.clearRect(0,0,w,h);

      for(const s of field){
        let px = (((s.x*w+yaw*s.z*60)%w)+w)%w, py = s.y*h;
        px = w/2+(px-w/2)*(1+e*1.2*s.z);
        py = h/2+(py-h/2)*(1+e*1.2*s.z);
        x.globalAlpha = s.a*(.6+.4*Math.sin(time*s.f+s.ph))*fade;
        x.fillStyle = "#ecf0ff";
        x.fillRect(px,py,s.r,s.r);
      }
      x.globalAlpha = 1;

      x.lineWidth = 1;
      x.strokeStyle = "rgba(170,190,255,"+(.15*fade*(1-.6*e))+")";
      for(let i=0;i<8;i++){
        x.beginPath();
        for(let k=0;k<=96;k++){
          const a = k/96*TAU;
          const q = proj(P[i].o*sp*Math.cos(a),0,P[i].o*sp*Math.sin(a));
          if(k===0) x.moveTo(q.x,q.y); else x.lineTo(q.x,q.y);
        }
        x.stroke();
      }

      x.fillStyle = "#cfc6b8";
      for(const b of belt){
        const a = b.a+time*b.s;
        const q = proj(b.o*sp*Math.cos(a),b.y,b.o*sp*Math.sin(a));
        const sz = b.r*Math.max(1,Math.sqrt(zoom));
        x.globalAlpha = b.al*fade;
        x.fillRect(q.x,q.y,sz,sz);
      }
      x.globalAlpha = 1;

      const s0 = proj(0,0,0);
      const list = [{z:s0.z,f:()=>sun(s0.x,s0.y,26*s0.s,fade)}];
      hits.length = 0;
      for(let i=0;i<8;i++){
        const q = pos(i,sp), pr = proj(q.x,0,q.z), R = Math.max(P[i].r*pr.s,2.4);
        list.push({z:pr.z,f:()=>planet(i,pr.x,pr.y,R,s0,fade)});
        hits.push({i:i,x:pr.x,y:pr.y,R:R,z:pr.z});
        if(i===2){
          const m = time*2.6;
          const mp = proj(q.x+17*Math.cos(m),Math.sin(m)*3,q.z+17*Math.sin(m));
          const mR = Math.max(2.4*mp.s,1.6);
          list.push({z:mp.z,f:()=>{
            let lx = s0.x-mp.x, ly = s0.y-mp.y;
            const L = Math.hypot(lx,ly)||1;
            sphere(mp.x,mp.y,mR,null,0,lx/L,ly/L,"#bdb8b0",fade);
          }});
        }
      }
      list.sort((a,b)=>a.z-b.z);
      list.forEach(o=>o.f());

      if(zp>.78){
        x.fillStyle = "rgba(5,6,13,"+Math.min(1,(zp-.78)/.22)+")";
        x.fillRect(0,0,w,h);
      }
      if(state===1 && zp>=1){ finish(); return; }
      raf = requestAnimationFrame(frame);
    }

    c.addEventListener("pointermove",ev=>{
      if(state!==0) return;
      hover = pick(ev.clientX,ev.clientY);
      c.style.cursor = hover>=0 ? "pointer" : "default";
    });
    c.addEventListener("pointerdown",ev=>{
      if(state!==0) return;
      const i = pick(ev.clientX,ev.clientY);
      hover = i;
      if(i===2){ state = 1; zt0 = performance.now(); c.style.cursor = "default"; $("solarHint").classList.add("off"); }
    });

    const unlock = ()=>{ if(state>=1) startSong(); };
    c.addEventListener("click",unlock);
    c.addEventListener("pointerup",unlock);
    c.addEventListener("touchend",unlock,{passive:true});

    buildEarth();
    resize();
    addEventListener("resize",resize);
    raf = requestAnimationFrame(frame);
  })();

  input.addEventListener("input", ()=>{ input.classList.remove("error"); });

  function dateOK(){
    return input.value.trim().toLowerCase() === "bara";
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

    const letter = $("letter");
  const flipSheets = document.querySelectorAll(".sheet.s1, .sheet.s2");
  const rollSize = ()=>parseFloat(getComputedStyle(letter).lineHeight)||34;
  const reduceMotion = matchMedia("(prefers-reduced-motion:reduce)").matches;
  const rolls = new Map();

  flipSheets.forEach(sheet=>{
    const r = document.createElement("div");
    r.className = "roll";
    r.setAttribute("aria-hidden","true");
    letter.appendChild(r);
    rolls.set(sheet, r);
  });

  function ease(t){ return t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2; }

  function setRoll(sheet, e){
    const H = sheet.offsetHeight, R = rollSize(), off = sheet.classList.contains("s2") ? R : 0;
    const keep = off + (H-off)*(1-e);
    const th = R*Math.sqrt(e);
    sheet.style.setProperty("--keep", keep+"px");
    const r = rolls.get(sheet);
    r.style.top = keep+"px";
    r.style.height = th+"px";
    r.style.opacity = e>0 ? "1" : "0";
  }

  function flip(sheet){
    if(sheet.classList.contains("flipped")) return;
    sheet.classList.add("flipped");
    sheet.setAttribute("aria-hidden","true");
    const wrap = document.querySelector(".book-wrap");
    if(wrap) wrap.scrollTo({top:0,behavior:reduceMotion?"auto":"smooth"});
    const done = ()=>{ setRoll(sheet,1); sheet.classList.add("gone"); };
    if(reduceMotion){ done(); return; }
    const dur = 1000, t0 = performance.now();
    (function step(now){
      const t = Math.min(1,(now-t0)/dur);
      setRoll(sheet, ease(t));
      if(t<1) requestAnimationFrame(step); else done();
    })(t0);
  }

  flipSheets.forEach(sheet=>{
    sheet.addEventListener("click", ()=>flip(sheet));
    sheet.addEventListener("keydown", e=>{
      if(e.key==="Enter" || e.key===" "){ e.preventDefault(); flip(sheet); }
    });
  });

  function resetSheets(){
    document.querySelectorAll(".sheet").forEach(s=>{
      s.classList.remove("flipped","gone");
      s.style.removeProperty("--keep");
      s.removeAttribute("aria-hidden");
    });
    rolls.forEach(r=>{ r.style.opacity="0"; r.style.height="0"; r.style.top="0"; });
  }

  function startSong(){
    if(started) return;
    started = true;
    wantPlay = true;
    if(audio.currentTime > 0){ try{ audio.currentTime = 0; }catch(e){} }
    const p = audio.play();
    if(p && p.catch) p.catch(()=>{ started = false; wantPlay = false; });
  }

  function openBook(){
    startSong();
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
    }
  });

  $("btnClose").addEventListener("click", ()=>{
    pageBook.classList.add("hidden"); pageBook.setAttribute("aria-hidden","true");
    pageLock.classList.remove("hidden"); pageLock.setAttribute("aria-hidden","false");
    input.value = "";
    resetSheets();
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