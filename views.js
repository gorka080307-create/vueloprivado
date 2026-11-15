/* ============================================================
   VUELO PRIVADO · Vista inmersiva: ventanilla del pasajero con tablet
   Todo se dibuja en <canvas>; depende del estado global de app.js
   ============================================================ */
(function(){
'use strict';

const V = {
  mode: 'map', raf: null, cv: null, ctx: null, w: 0, h: 0, dpr: 1,
  last: 0, travel: 0, clouds: null, fwdClouds: null, stars: null, puff: null,
  tabMap: null, tabMarker: null, tabFlown: null, tabA: null, tabB: null, tabPage: 'flight', lastTab: 0,
};
const D2R = Math.PI/180;
const clamp = (x,a,b) => Math.max(a, Math.min(b, x));
const lerp = (a,b,t) => a + (b-a)*t;
function hex2rgb(h){ const n=parseInt(h.slice(1),16); return [n>>16&255, n>>8&255, n&255]; }
function mix(c1,c2,t){ const a=hex2rgb(c1), b=hex2rgb(c2); t=clamp(t,0,1); return `rgb(${Math.round(lerp(a[0],b[0],t))},${Math.round(lerp(a[1],b[1],t))},${Math.round(lerp(a[2],b[2],t))})`; }
function mixHex(c1,c2,t){ const a=hex2rgb(c1), b=hex2rgb(c2); t=clamp(t,0,1); return '#'+[0,1,2].map(i=>Math.round(lerp(a[i],b[i],t)).toString(16).padStart(2,'0')).join(''); }
function h2(i,j){ let x = Math.imul(i|0, 374761393) + Math.imul(j|0, 668265263); x = Math.imul(x ^ (x>>>13), 1274126177); return ((x ^ (x>>>16))>>>0)/4294967296; }

/* ---------------- estado de la escena ---------------- */
function sunElevation(lat, lon, ts){
  const { alpha, delta, gmst } = solarPos(ts);
  const ha = (gmst*15 + lon - alpha) * D2R;
  return Math.asin(Math.sin(lat*D2R)*Math.sin(delta*D2R) + Math.cos(lat*D2R)*Math.cos(delta*D2R)*Math.cos(ha)) / D2R;
}
function bearing(a,b){
  const y=Math.sin((b.lon-a.lon)*D2R)*Math.cos(b.lat*D2R);
  const x=Math.cos(a.lat*D2R)*Math.sin(b.lat*D2R)-Math.sin(a.lat*D2R)*Math.cos(b.lat*D2R)*Math.cos((b.lon-a.lon)*D2R);
  return (Math.atan2(y,x)/D2R+360)%360;
}
function state(){
  const f = flight, ac = acOf(f), heli = ac.kind==='heli';
  const el = elapsedMs(f), p = clamp(el/f.durMs, 0, 1), rem = f.durMs - el;
  const pr = profile(p);
  const dp = Math.min(1, p + 60000/f.durMs);
  const vs = (profile(dp).alt - pr.alt) * (60000/Math.max(1,(dp-p)*f.durMs));
  const PH = phasesOf(f), pi = phaseIdx(p,f), ph = PH[pi] || PH[PH.length-1];
  const o = AP[f.from], d = AP[f.to];
  let dl = d.lon - o.lon; if(dl>180) dl-=360; if(dl<-180) dl+=360;
  const lat = o.lat + (d.lat-o.lat)*p, lon = o.lon + dl*p;
  const t = performance.now()/1000;
  let pitch, bank = Math.sin(t/9)*2.2 + Math.sin(t/3.7)*0.6;
  const onGround = pr.alt < 15;
  if(heli){
    pitch = onGround ? 0 : clamp(-2.5 - (pr.spd/ac.speed)*3 + vs/1500, -7, 6);
    if(p > .985) pitch = 4;
    bank = onGround ? 0 : bank*0.8 + Math.sin(t*23)*0.15;
  } else {
    pitch = onGround ? (p<.08 && pr.spd>230 ? (pr.spd-230)/120*9 : 0) : clamp(2.5 + vs/700, -4, 12);
    if(p > .996) pitch = 4;
    if(onGround) bank = 0;
  }
  return {
    f, ac, heli, mil: !!ac.mil, o, d, p, rem, el, alt: pr.alt, spd: pr.spd, vs, pi, ph, lat, lon,
    sun: sunElevation(lat, lon, Date.now()), hdg: bearing(o,d), pitch, bank, t, onGround,
    paused: !!f.pausedAt, distLeft: f.dist*(1-p),
  };
}

/* ---------------- paleta de cielo según el sol ---------------- */
function sky(e, altFt){
  // paradas por elevación solar
  const stops = [
    [-90, '#02040b', '#0a1226'], [-12, '#040817', '#121a38'], [-6, '#0d1636', '#3b2f5c'],
    [-2, '#1b2b5a', '#d6704a'], [2, '#2a4f8f', '#f0a868'], [8, '#2f66b0', '#cfe0ef'], [30, '#1f5fb5', '#a8d1f2'], [90, '#1a59b3', '#9fcbf0'],
  ];
  let i=0; while(i<stops.length-2 && e>stops[i+1][0]) i++;
  const a=stops[i], b=stops[i+1], t=clamp((e-a[0])/(b[0]-a[0]),0,1);
  let top = mixHex(a[1],b[1],t), hor = mixHex(a[2],b[2],t);
  const hi = clamp((altFt-20000)/25000, 0, 1);
  top = mixHex(top, e>0 ? '#0b2f74' : '#01030a', hi*0.7);
  const light = clamp((e+7)/15, 0, 1);
  return { top, hor, light };
}
function groundBase(light){ return { far: mixHex('#0a0d12','#7f8d86',light), near: mixHex('#05070a','#4c5d33',light) }; }

/* ---------------- sprites ---------------- */
function makePuff(){
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64,64,4,64,64,64);
  gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(.45,'rgba(255,255,255,.75)'); gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0,0,128,128); return c;
}
function initWorld(){
  V.puff = V.puff || makePuff();
  const r = mulberry32(hashStr(flight.id));
  V.clouds = Array.from({length:46}, () => ({ x: r()*60000, D: 2000 + r()*45000, s: 500 + r()*1600, a: .55 + r()*.4, n: 3+Math.floor(r()*4), dy: (r()-.5)*400 }));
  V.fwdClouds = Array.from({length:26}, () => ({ D: r()*30000, x: (r()-.5)*24000, dy: (r()-.5)*500, s: 600 + r()*1500, a: .5 + r()*.4, n: 3+Math.floor(r()*3) }));
  V.stars = Array.from({length:160}, () => ({ x: r(), y: r(), m: .3 + r()*.9 }));
  V.cloudAlt = 1500 + r()*1800;          // base de la capa de nubes (m)
  V.cloudCover = .35 + r()*.55;
  V.city = r();
}
function drawPuffCluster(ctx, x, y, size, alpha, n, seed, shade){
  ctx.globalAlpha = alpha;
  for(let k=0;k<n;k++){
    const ox = (h2(seed,k)-.5)*size*1.3, oy = (h2(seed,k+9)-.5)*size*.35, s = size*(.55+h2(seed,k+20)*.6);
    ctx.drawImage(V.puff, x+ox-s/2, y+oy-s/2*.7, s, s*.7);
  }
  if(shade){ ctx.globalAlpha = alpha*shade; ctx.globalCompositeOperation='source-atop'; ctx.globalCompositeOperation='source-over'; }
  ctx.globalAlpha = 1;
}

/* =================================================================
   ESCENA LATERAL (ventanilla)
   ================================================================= */
function drawSideScene(ctx, x0, y0, w, h, s){
  const f = Math.max(w,h)*0.9;                // focal
  const A = Math.max(2.5, s.alt*0.3048);      // altura en metros (ojo a ~2,5 m en tierra)
  const sk = sky(s.sun, s.alt), gb = groundBase(sk.light);
  const cx = x0 + w/2, cy = y0 + h/2;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(-s.bank*D2R*0.6); ctx.translate(-cx, -cy);
  const dip = Math.sqrt(2*A/6371000)/D2R;           // depresión del horizonte
  const horizonY = cy + (dip + (s.heli?3:1.5))*f*D2R*0.9 - (s.pitch*0.15)*f*D2R;
  // cielo
  let g = ctx.createLinearGradient(0, horizonY - h*1.2, 0, horizonY);
  g.addColorStop(0, sk.top); g.addColorStop(1, sk.hor);
  ctx.fillStyle = g; ctx.fillRect(x0-w, y0-h, w*3, horizonY-(y0-h));
  // estrellas
  if(sk.light < .45){
    ctx.fillStyle = '#fff';
    V.stars.forEach(st => { const yy = y0 + st.y*(horizonY-y0)*.95; ctx.globalAlpha = (1-sk.light/.45)*st.m*(.6+.4*Math.sin(s.t*2+st.x*40)); ctx.fillRect(x0 + st.x*w, yy, 1.3, 1.3); });
    ctx.globalAlpha = 1;
  }
  // brillo del sol en el horizonte (amanecer/atardecer)
  if(s.sun > -8 && s.sun < 12){
    const gl = ctx.createRadialGradient(cx + w*.25, horizonY, 0, cx + w*.25, horizonY, w*.7);
    gl.addColorStop(0, `rgba(255,170,90,${.35*(1-Math.abs(s.sun-1)/11)})`); gl.addColorStop(1,'rgba(255,170,90,0)');
    ctx.fillStyle = gl; ctx.fillRect(x0-w, y0-h, w*3, h*3);
  }
  // suelo
  g = ctx.createLinearGradient(0, horizonY, 0, y0+h);
  g.addColorStop(0, mixHex(gb.far, sk.hor, .45)); g.addColorStop(.06, gb.far); g.addColorStop(1, gb.near);
  ctx.fillStyle = g; ctx.fillRect(x0-w, horizonY, w*3, y0+h*2-horizonY);
  // parcelas con paralaje
  const rows = 64, Dmin = Math.max(6, A*0.25), Dmax = Math.max(9000, A*120);
  for(let i=rows-1;i>=0;i--){
    const D = Dmin * Math.pow(Dmax/Dmin, i/(rows-1));
    const yTop = horizonY + f*A/(D*1.12), yBot = horizonY + f*A/D;
    if(yTop > y0+h || yBot < horizonY) continue;
    const tileM = clamp(D*0.12, 4, 1800), tileW = tileM*f/D;
    if(tileW < 1.5) continue;
    const shift = (V.travel % 1e9) * f / D;
    const first = Math.floor((shift + x0 - w) / tileW);
    const haze = clamp(Math.pow(D/Dmax,.6)*.9, 0, .8);
    for(let k=first; k*tileW - shift < x0+w*2; k++){
      const r = h2(k, i*31+7), sx = k*tileW - shift;
      let col;
      if(s.onGround || A < 40){
        // aeropuerto: asfalto cerca, hierba lejos
        col = i < 8 ? (r<.15 ? '#5a5d60' : '#3d4043') : (r<.5 ? '#4f6a34' : '#5d7a3c');
      } else {
        col = r<.18 ? '#6b7f3f' : r<.36 ? '#8b8a55' : r<.52 ? '#4f6a34' : r<.62 ? '#9a8a63' : r<.7 ? '#3e5a35' : '#76824a';
      }
      col = mixHex(mixHex(col,'#06080c',1-sk.light), sk.hor, haze*sk.light*0.8);
      ctx.fillStyle = col; ctx.fillRect(sx, yTop, tileW*.98, Math.max(1, yBot-yTop));
      // luces de ciudad por la noche
      if(sk.light < .5 && h2(k,i*13+1) < 0.22 + V.city*0.3){
        ctx.fillStyle = `rgba(255,${190+Math.floor(r*50)},120,${(1-sk.light*2)*(.5+.5*h2(k,i))})`;
        const nL = 1 + Math.floor(h2(k,i+3)*4);
        for(let q=0;q<nL;q++) ctx.fillRect(sx + h2(k,q+i)*tileW, yTop + h2(q,k)*(yBot-yTop), Math.max(1,tileW*.04), Math.max(1,(yBot-yTop)*.15));
      }
    }
  }
  // edificios/terminal cuando estamos bajos
  if(A < 900){
    const fade = clamp(1 - A/900, 0, 1);
    for(let k=0;k<26;k++){
      const D = 600 + h2(k,77)*3500, bx = ((h2(k,5)*9000 - V.travel*0.9) % 9000 + 9000) % 9000 - 1500;
      const sx = x0 + w/2 + (bx)*f/D, bw = (30+h2(k,3)*120)*f/D, bh = (10+h2(k,4)*40)*f/D;
      const by = horizonY + f*A/D;
      if(sx+bw < x0-20 || sx > x0+w+20) continue;
      ctx.globalAlpha = fade; ctx.fillStyle = mixHex('#2a2f36','#9aa3ad',sk.light*.8); ctx.fillRect(sx, by-bh, bw, bh);
      if(sk.light < .5){ ctx.fillStyle='rgba(255,220,150,.8)'; for(let q=0;q<6;q++) ctx.fillRect(sx+bw*h2(k,q+30), by-bh*h2(q,k+40), 2, 2); }
      ctx.globalAlpha = 1;
    }
    // luces de pista en tierra / final
    if(s.onGround || s.p > .97){
      for(let k=-40;k<40;k++){
        const D = 30 + Math.abs(k)*0 + 40; const xm = k*60 - (V.travel % 60);
        const sx = x0 + w/2 + xm*f/D, sy = horizonY + f*A/D;
        if(sx<x0-10||sx>x0+w+10) continue;
        ctx.fillStyle = sk.light<.6 ? 'rgba(255,240,200,.95)' : 'rgba(255,255,255,.55)';
        ctx.beginPath(); ctx.arc(sx, sy, Math.max(1.2, 3*f/D/40), 0, 7); ctx.fill();
      }
    }
  }
  // nubes
  const cA = V.cloudAlt, above = A > cA;
  V.clouds.forEach((c,idx) => {
    if(idx/V.clouds.length > V.cloudCover) return;
    let rel = (c.x - V.travel) % 60000; if(rel < -30000) rel += 60000; if(rel > 30000) rel -= 60000;
    const sx = x0 + w/2 + rel*f/c.D;
    const dy = (cA + c.dy) - A;
    const sy = horizonY - f*dy/c.D;
    const size = c.s*f/c.D;
    if(sx+size < x0-50 || sx-size > x0+w+50 || size < 4) return;
    const shade = above ? 1 : .75;
    ctx.save(); ctx.filter = `brightness(${Math.round((.35 + sk.light*.65)*shade*100)}%)`;
    drawPuffCluster(ctx, sx, sy, size, c.a*(above?1:.85)*(1-clamp(c.D/50000,0,.6)), c.n, idx);
    ctx.restore();
  });
  ctx.restore();
  // dentro de la nube
  const inCloud = 1 - clamp(Math.abs(A - V.cloudAlt)/250, 0, 1);
  if(inCloud > 0 && V.cloudCover > .5){ ctx.fillStyle = `rgba(${Math.round(200*sk.light+30)},${Math.round(205*sk.light+30)},${Math.round(215*sk.light+35)},${inCloud*.85})`; ctx.fillRect(x0,y0,w,h); }
  return { horizonY, sk };
}

/* =================================================================
   VISTA VENTANILLA
   ================================================================= */
function roundRect(ctx,x,y,w,h,r){ ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function drawWindow(ctx, W, H, s){
  const small = W < 820;
  const heli = s.heli, mil = s.mil;
  // geometría de la ventana
  let wx, wy, ww, wh, rad;
  const tabletOpen = !document.body.classList.contains('tablet-min');
  const areaW = small || !tabletOpen ? W : W - 470, ccx = areaW/2;
  if(heli){ ww = Math.min(areaW*(small?.88:.82), W*.66); wh = H*(small?.42:.6); wy = H*(small?.1:.12); rad = Math.min(ww,wh)*.12; }
  else if(mil && s.ac.id==='a400'){ ww = Math.min(areaW*.5, H*.48); wh = ww; wy = H*(small?.12:.16); rad = ww/2; }
  else { ww = Math.min(areaW*(small?.62:.42), H*.52); wh = ww*1.38; wy = H*(small?.06:.08); rad = ww*.45; }
  wx = ccx - ww/2;
  // vibración del helicóptero
  const vib = heli && !s.onGround ? Math.sin(s.t*47)*0.8 : heli ? Math.sin(s.t*47)*0.4 : 0;
  ctx.save(); ctx.translate(0, vib);
  // exterior
  ctx.save(); ctx.beginPath(); roundRect(ctx, wx, wy, ww, wh, rad); ctx.clip();
  const sc = drawSideScene(ctx, wx-ww*.3, wy-wh*.2, ww*1.6, wh*1.4, s);
  // ala (jets)
  if(!heli){
    const lt = sc.sk.light;
    const wingCol = mil ? mixHex('#2c3036','#8d939b',lt) : mixHex('#30343a','#e8ebee',lt);
    const bx = wx + ww*1.05, by = wy + wh*.86;
    ctx.fillStyle = wingCol;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(wx - ww*.25, wy + wh*.70); ctx.lineTo(wx - ww*.25, wy + wh*.74); ctx.lineTo(bx, wy + wh*1.08); ctx.closePath(); ctx.fill();
    ctx.fillStyle = mixHex('#15181c','#b8bec5',lt); ctx.beginPath(); ctx.moveTo(bx, wy+wh*.98); ctx.lineTo(wx-ww*.25, wy+wh*.735); ctx.lineTo(wx-ww*.25, wy+wh*.745); ctx.lineTo(bx, wy+wh*1.08); ctx.fill();
    // winglet + luces
    const tx = wx + ww*.02, ty = wy + wh*.72;
    ctx.fillStyle = wingCol; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx-ww*.06, ty-wh*.14); ctx.lineTo(tx-ww*.02, ty-wh*.14); ctx.lineTo(tx+ww*.05, ty); ctx.fill();
    const blink = (s.t % 1.2) < .08;
    ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.arc(tx-ww*.03, ty-wh*.02, 3, 0, 7); ctx.fill();
    if(blink){ const fl = ctx.createRadialGradient(tx-ww*.03,ty-wh*.02,0,tx-ww*.03,ty-wh*.02,ww*.25); fl.addColorStop(0,'rgba(255,255,255,.9)'); fl.addColorStop(1,'rgba(255,255,255,0)'); ctx.fillStyle=fl; ctx.fillRect(wx,wy,ww,wh); }
    // reflejo del sol en el ala
    if(lt > .6){ ctx.fillStyle='rgba(255,255,255,.12)'; ctx.beginPath(); ctx.moveTo(bx, by+wh*.02); ctx.lineTo(wx, wy+wh*.72); ctx.lineTo(wx, wy+wh*.725); ctx.lineTo(bx, by+wh*.05); ctx.fill(); }
  } else {
    // patín / tren del helicóptero y sombra de las palas
    ctx.fillStyle = mil ? '#3b4030' : '#1d1f23';
    ctx.fillRect(wx - 10, wy + wh*.9, ww + 20, wh*.025);
    ctx.fillRect(wx + ww*.25, wy + wh*.82, ww*.02, wh*.1); ctx.fillRect(wx + ww*.72, wy + wh*.82, ww*.02, wh*.1);
    const ph = (s.t*5.6) % 1;
    if(!s.paused || true){ ctx.fillStyle = `rgba(0,0,0,${.10 + .06*sc.sk.light})`; ctx.save(); ctx.translate(wx+ww/2, wy-wh*.6); ctx.rotate(ph*Math.PI*2); ctx.fillRect(-ww*1.5, -14, ww*3, 28); ctx.restore(); }
  }
  // reflejo del cristal
  const rg = ctx.createLinearGradient(wx, wy, wx+ww, wy+wh); rg.addColorStop(0,'rgba(255,255,255,.07)'); rg.addColorStop(.5,'rgba(255,255,255,0)'); rg.addColorStop(1,'rgba(255,255,255,.04)');
  ctx.fillStyle = rg; ctx.fillRect(wx,wy,ww,wh);
  ctx.restore();
  // pared de la cabina con hueco
  const wall = heli ? (mil ? ['#3d4330','#5a6147'] : ['#1b1c20','#33353b']) : (mil ? ['#4d5148','#6e7268'] : ['#d9d1c3','#efe9df']);
  const lt2 = .55 + sc.sk.light*.45;
  const wg = ctx.createLinearGradient(0,0,W,0); wg.addColorStop(0, mixHex(wall[0],'#000',1-lt2)); wg.addColorStop(.5, mixHex(wall[1],'#000',1-lt2)); wg.addColorStop(1, mixHex(wall[0],'#000',1-lt2));
  ctx.fillStyle = wg; ctx.beginPath(); ctx.rect(-10,-10,W+20,H+20); roundRect(ctx, wx, wy, ww, wh, rad); ctx.fill('evenodd');
  // marco de la ventana
  ctx.lineWidth = Math.max(10, ww*.05); ctx.strokeStyle = heli ? (mil?'#2a2e22':'#0f1013') : (mil?'#3a3d36':'#cfc6b6');
  ctx.beginPath(); roundRect(ctx, wx-ctx.lineWidth/2, wy-ctx.lineWidth/2, ww+ctx.lineWidth, wh+ctx.lineWidth, rad+ctx.lineWidth/2); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); roundRect(ctx, wx, wy, ww, wh, rad); ctx.stroke();
  // persiana (jets civiles)
  if(!heli && !mil){
    const shade = .14; ctx.save(); ctx.beginPath(); roundRect(ctx, wx, wy, ww, wh, rad); ctx.clip();
    ctx.fillStyle = mixHex('#8d8577','#e6e0d4',lt2); ctx.fillRect(wx, wy, ww, wh*shade);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(wx, wy+wh*shade-3, ww, 3); ctx.restore();
  }
  // detalles del interior
  if(!heli && !mil){
    ctx.fillStyle = mixHex('#5a4a36','#8a6e4c',lt2); ctx.fillRect(0, H*.78, W, H*.22);              // reposabrazos de madera
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, H*.78, W, 4);
  } else if(mil && !heli){
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 3;
    for(let i=0;i<8;i++){ ctx.beginPath(); ctx.moveTo(W*i/7, 0); ctx.lineTo(W*i/7, H); ctx.stroke(); }    // cuadernas
  } else {
    ctx.fillStyle = mil ? '#2a2e22' : '#121316'; ctx.fillRect(0, H*.82, W, H*.18);
  }
  ctx.restore();
}

/* =================================================================
   TABLET DEL PASAJERO
   ================================================================= */
function tabletHTML(){
  return `<div class="tab-frame"><div class="tab-screen">
    <div class="tab-top"><span id="tbTitle">VUELO PRIVADO</span><span id="tbClock">--:--</span></div>
    <div class="tab-body">
      <div class="tab-page" data-p="map"><div id="tabMap"></div><div class="tab-map-info" id="tbMapInfo"></div></div>
      <div class="tab-page" data-p="flight"><div id="tbFlight"></div></div>
      <div class="tab-page" data-p="dest"><div id="tbDest"></div></div>
      <div class="tab-page" data-p="crew"><div id="tbCrew"></div></div>
      <div class="tab-page" data-p="service"><div id="tbService"></div></div>
    </div>
    <div class="tab-nav">
      <button data-t="flight">✈️<span>Vuelo</span></button><button data-t="map">🗺️<span>Mapa</span></button>
      <button data-t="dest">🌤️<span>Destino</span></button><button data-t="crew">👨‍✈️<span>Tripulación</span></button>
      <button data-t="service">🛎️<span>Servicio</span></button>
    </div></div></div>`;
}
function setTab(t){
  V.tabPage = t;
  document.querySelectorAll('#tablet .tab-page').forEach(p => p.classList.toggle('on', p.dataset.p===t));
  document.querySelectorAll('#tablet .tab-nav button').forEach(b => b.classList.toggle('on', b.dataset.t===t));
  if(t==='map') ensureTabMap();
  updateTablet(true);
}
function ensureTabMap(){
  if(typeof L==='undefined') { $('tabMap').innerHTML = '<div style="padding:20px;color:#777">Mapa no disponible sin conexión</div>'; return; }
  if(!V.tabMap){
    V.tabMap = L.map('tabMap', { zoomControl:false, attributionControl:false });
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom:12 }).addTo(V.tabMap);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxZoom:12, opacity:.75 }).addTo(V.tabMap);
  }
  if(V.tabFor !== flight.id){
    V.tabFor = flight.id;
    if(V.tabLayer) V.tabLayer.remove();
    V.tabLayer = L.layerGroup().addTo(V.tabMap);
    [V.tabA, V.tabB] = routeLatLngs(AP[flight.from], AP[flight.to]);
    V.tabLayer.addLayer(L.polyline([V.tabA,V.tabB], { color:'#d4af6a', weight:2, dashArray:'6 7' }));
    V.tabFlown = L.polyline([V.tabA,V.tabA], { color:'#f1d9a4', weight:3 }); V.tabLayer.addLayer(V.tabFlown);
    V.tabLayer.addLayer(L.circleMarker(V.tabA, { radius:5, color:'#d4af6a', fillOpacity:1 }));
    V.tabLayer.addLayer(L.circleMarker(V.tabB, { radius:5, color:'#d4af6a', fillOpacity:1 }));
    const heli = acOf(flight).kind==='heli';
    V.tabMarker = L.marker(V.tabA, { icon:L.divIcon({ className:'plane-icon', iconSize:[30,30], iconAnchor:[15,15], html: heli ? '<div>🚁</div>' : (()=>{ const pa=V.tabMap.project(V.tabA,0), pb=V.tabMap.project(V.tabB,0); return `<div style="transform:rotate(${Math.atan2(pb.y-pa.y,pb.x-pa.x)*180/Math.PI+45}deg)">✈️</div>`; })() }) });
    V.tabLayer.addLayer(V.tabMarker);
    V.tabMap.fitBounds(L.latLngBounds([V.tabA,V.tabB]), { padding:[30,30], maxZoom:10 });
  }
  setTimeout(() => { V.tabMap.invalidateSize(); }, 60);
}
function service(kind){
  if(!flight) return;
  audio(); if(actx) CABIN_SOUNDS.call();
  const f = flight, d = AP[f.to];
  const replies = {
    coffee: [`Enseguida, Comandante Supremo. Le traigo ${pick(Math.random,['un café solo','un cortado','un cappuccino'])} recién hecho.`],
    water:  ['Aquí tiene agua fresca con limón. Hidratarse ayuda a concentrarse.'],
    food:   [`Le preparo ${f.catering}. En unos minutos lo tiene en su mesa.`],
    snack:  [`Le dejo ${pick(Math.random,['frutos secos tostados','fruta cortada','chocolate negro','unas galletas artesanas'])} para picar mientras estudia.`],
    blanket:['Le traigo una manta y una almohada. Que esté cómodo.'],
    lights: ['Ajusto la iluminación de cabina a modo lectura.'],
  };
  if(kind==='dnd'){
    f.dnd = !f.dnd; saveFlight();
    say('fa', f.dnd ? 'Entendido: no le molestaremos salvo avisos de seguridad. Concéntrese.' : 'De acuerdo, vuelvo a estar a su disposición.');
  } else if(kind==='captain'){
    const left = fmtHM(f.durMs/60000 - elapsedMs(f)/60000);
    say('cap', `Aquí su comandante. Todo en orden: quedan ${left} hasta ${d.city}. ${f.meteo.live ? `Allí hay ${f.meteo.t}°C, ${f.meteo.sky.toLowerCase()}.` : ''}`);
  } else {
    say('fa', pick(Math.random, replies[kind]));
  }
  updateTablet(true);
}
function updateTablet(force){
  if(!flight || V.mode!=='window') return;
  const now = performance.now(); if(!force && now - V.lastTab < 500) return; V.lastTab = now;
  const s = state(), f = s.f, ac = s.ac;
  $('tbTitle').textContent = `${f.flightNo} · ${s.o.iata} → ${s.d.iata}`;
  $('tbClock').textContent = fmtTime(Date.now());
  if(V.tabPage==='flight'){
    $('tbFlight').innerHTML = `
      <div class="tb-big">${fmtClock(f.breakUntil ? f.breakUntil-Date.now() : s.rem)}</div>
      <div class="tb-sub">${f.breakUntil ? '☕ Descanso en curso' : s.paused ? '⏸ En espera' : `${s.ph.i} ${s.ph.n}`}</div>
      <div class="tb-prog"><div style="width:${s.p*100}%"></div><span style="left:${s.p*100}%">${s.heli?'🚁':'✈️'}</span></div>
      <div class="tb-route"><span>${s.o.iata}<small>${s.o.city}</small></span><span style="text-align:right">${s.d.iata}<small>${s.d.city}</small></span></div>
      <div class="tb-grid">
        <div><b>${fmtN(s.alt)}</b><small>pies</small></div><div><b>${fmtN(s.spd)}</b><small>km/h</small></div>
        <div><b>${fmtN(s.distLeft)}</b><small>km restantes</small></div><div><b>${fmtTimeTZ(Date.now()+s.rem, f.tzD)}</b><small>llegada local</small></div>
        <div><b>${fmtClock(s.el)}</b><small>estudiando</small></div><div><b>${Math.round(s.hdg)}°</b><small>rumbo</small></div>
      </div>`;
  } else if(V.tabPage==='map'){
    if(V.tabMap && V.tabMarker){ const pa=V.tabMap.project(V.tabA,0), pb=V.tabMap.project(V.tabB,0); const pos=V.tabMap.unproject(pa.add(pb.subtract(pa).multiplyBy(s.p)),0); V.tabMarker.setLatLng(pos); V.tabFlown.setLatLngs([V.tabA,pos]); }
    $('tbMapInfo').innerHTML = `<b>${fmtN(s.distLeft)} km</b> hasta ${s.d.city} · ${fmtN(s.alt)} ft · ${fmtN(s.spd)} km/h`;
  } else if(V.tabPage==='dest' && force){
    $('tbDest').innerHTML = `
      <div class="tb-dest-h">${flag(s.d.cc)} ${s.d.city}</div><div class="tb-sub">${s.d.name} · ${COUNTRIES[s.d.cc]||''}</div>
      <div class="tb-grid">
        <div><b>${f.meteo.t}°C</b><small>${f.meteo.live?'ahora mismo':'previsión'}</small></div><div><b>${f.meteo.sky.split(' ').pop()}</b><small>${f.meteo.sky.replace(/\s\S+$/,'')}</small></div>
        <div><b>${f.tzD!=null ? fmtTimeTZ(Date.now(), f.tzD) : fmtTime(Date.now())}</b><small>hora local ${f.tzD!=null?fmtUTC(f.tzD):''}</small></div><div><b>${f.meteo.wind!=null?f.meteo.wind+' km/h':'—'}</b><small>viento</small></div>
      </div>
      ${s.d.note ? `<div class="tb-note">${AP_TYPES[s.d.type].icon} ${s.d.note}</div>` : ''}
      <div class="tb-note">Llegada estimada: <b>${fmtTimeTZ(Date.now()+s.rem, f.tzD)}</b> hora local.</div>`;
  } else if(V.tabPage==='crew' && force){
    const rk = f.crew.rk || { c:'Comandante', f: s.heli?'Copiloto':'Primer oficial', a:'Azafata' };
    $('tbCrew').innerHTML = `
      <div class="tb-crew"><span>👨‍✈️</span><div><b>${rk.c==='Cte.'?'Comandante':rk.c} ${f.crew.captain}</b><small>Al mando de la aeronave</small></div></div>
      <div class="tb-crew"><span>🧑‍✈️</span><div><b>${f.crew.fo}</b><small>${s.heli?'Copiloto':'Primer oficial'}</small></div></div>
      <div class="tb-crew"><span>💁‍♀️</span><div><b>${f.crew.fa}</b><small>Azafata · a su servicio</small></div></div>
      <div class="tb-note">${ac.name}<br>Matrícula <b>${f.reg}</b> · Indicativo <b>${f.callsign}</b>${ac.unit?`<br>🎖️ ${ac.unit}`:''}</div>`;
  } else if(V.tabPage==='service' && force){
    $('tbService').innerHTML = `
      <div class="tb-sub" style="margin-bottom:10px">¿Qué le apetece, Comandante Supremo?</div>
      <div class="tb-svc">
        <button data-s="coffee">☕<span>Café</span></button><button data-s="water">💧<span>Agua</span></button>
        <button data-s="snack">🥜<span>Picar algo</span></button><button data-s="food">🍽️<span>Comida</span></button>
        <button data-s="blanket">🧣<span>Manta</span></button><button data-s="lights">💡<span>Luz de lectura</span></button>
        <button data-s="captain">📞<span>Hablar con el comandante</span></button>
        <button data-s="dnd" class="${f.dnd?'on':''}">🔕<span>${f.dnd?'No molestar: ON':'No molestar'}</span></button>
      </div>`;
  }
}

/* =================================================================
   BUCLE Y CONTROL DE VISTAS
   ================================================================= */
function resize(){
  const c = V.cv; if(!c) return;
  V.dpr = Math.min(2, window.devicePixelRatio || 1);
  V.w = window.innerWidth; V.h = window.innerHeight;
  c.width = Math.round(V.w*V.dpr); c.height = Math.round(V.h*V.dpr);
  c.style.width = V.w+'px'; c.style.height = V.h+'px';
}
function frame(ts){
  V.raf = null;
  if(!flight || !flight.start || V.mode==='map') return;
  const dt = V.last ? Math.min(.1, (ts - V.last)/1000) : 0; V.last = ts;
  const s = state();
  if(!s.paused){
    V.travel += s.spd/3.6 * dt * (s.heli ? 1 : 1);
    if(s.onGround && s.p < .1) V.rollM = (V.rollM||0) + s.spd/3.6*dt; else if(!s.onGround) V.rollM = 0;
  }
  const ctx = V.ctx; ctx.setTransform(V.dpr,0,0,V.dpr,0,0);
  ctx.clearRect(0,0,V.w,V.h);
  drawWindow(ctx, V.w, V.h, s);
  updateTablet(false);
  updateBar(s);
  V.raf = requestAnimationFrame(frame);
}
function updateBar(s){
  const now = performance.now(); if(V.lastBar && now - V.lastBar < 250) return; V.lastBar = now;
  $('vbTimer').textContent = fmtClock(s.f.breakUntil ? s.f.breakUntil-Date.now() : s.rem);
  $('vbPhase').textContent = s.f.breakUntil ? '☕ Descanso' : s.paused ? '⏸ En espera' : `${s.ph.i} ${s.ph.n}`;
  $('vbPause').textContent = s.paused ? '▶️' : '⏸';
}
function setView(m){
  V.mode = m; LS.set('vp_view', m);
  document.body.classList.remove('view-map','view-window');
  document.body.classList.add('view-'+m);
  document.querySelectorAll('#viewSwitch button').forEach(b => b.classList.toggle('on', b.dataset.v===m));
  if(m==='map'){ if(V.raf) cancelAnimationFrame(V.raf); V.raf=null; if(typeof map!=='undefined' && map) setTimeout(()=>{ map.invalidateSize(); fitRoute(); }, 50); return; }
  if(!V.clouds || V.world !== flight.id){ initWorld(); V.world = flight.id; V.travel = 0; }
  $('pa').classList.add('collapsed'); $('paToggle').textContent = '+';
  if(m==='window'){ setTab(V.tabPage); }
  resize(); V.last = 0;
  if(!V.raf) V.raf = requestAnimationFrame(frame);
}

function init(){
  V.cv = $('viewCanvas'); V.ctx = V.cv.getContext('2d');
  $('tablet').innerHTML = tabletHTML();
  $('tablet').addEventListener('click', e => {
    const t = e.target.closest('.tab-nav button'); if(t){ setTab(t.dataset.t); return; }
    const sv = e.target.closest('.tb-svc button'); if(sv){ service(sv.dataset.s); }
  });
  $('tabToggle').onclick = () => document.body.classList.toggle('tablet-min');
  $('viewSwitch').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if(b && flight && flight.start && ['map','window'].includes(b.dataset.v)) setView(b.dataset.v); });
  $('vbPause').onclick = () => togglePause();
  $('vbNoise').onclick = () => setNoise(!noise);
  window.addEventListener('resize', () => { if(V.mode!=='map') resize(); });
  document.addEventListener('visibilitychange', () => { V.last = 0; });
}
window.VPV = {
  enter(){ const m = LS.get('vp_view','map'); setView(m==='window' ? 'window' : 'map'); },
  exit(){ V.mode='map'; if(V.raf) cancelAnimationFrame(V.raf); V.raf=null; document.body.classList.remove('view-window'); document.body.classList.add('view-map'); V.tabFor=null; },
  set: setView,
  get mode(){ return V.mode; },
};
init();
if(flight && flight.start) VPV.enter(); else document.body.classList.add('view-map');
})();
