/* ============================================================
   VUELO PRIVADO · Vistas inmersivas: ventanilla (con tablet) y cabina de pilotaje
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
   ESCENA FRONTAL (cabina)
   ================================================================= */
function drawFrontScene(ctx, x0, y0, w, h, s){
  const f = w*0.75, A = Math.max(s.heli?3:4, s.alt*0.3048);
  const sk = sky(s.sun, s.alt), gb = groundBase(sk.light);
  const cx = x0 + w*(s.heli ? .34 : .3), cy = y0 + h*0.48;   // vista desde el asiento del comandante
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(-s.bank*D2R);
  const hy = s.pitch * D2R * f;          // horizonte se mueve al cabecear
  // cielo
  let g = ctx.createLinearGradient(0, hy - h*1.3, 0, hy);
  g.addColorStop(0, sk.top); g.addColorStop(1, sk.hor);
  ctx.fillStyle = g; ctx.fillRect(-w*1.5, -h*2, w*3, hy + h*2);
  if(sk.light < .45){ ctx.fillStyle='#fff'; V.stars.forEach(st => { ctx.globalAlpha=(1-sk.light/.45)*st.m; ctx.fillRect((st.x-.5)*w*1.4, hy - st.y*h*1.2, 1.3, 1.3); }); ctx.globalAlpha=1; }
  // suelo
  g = ctx.createLinearGradient(0, hy, 0, hy + h*1.5);
  g.addColorStop(0, mixHex(gb.far, sk.hor, .5)); g.addColorStop(.15, gb.far); g.addColorStop(1, gb.near);
  ctx.fillStyle = g; ctx.fillRect(-w*1.5, hy, w*3, h*3);
  // franjas de terreno acercándose
  const spacing = clamp(A*0.6, 30, 3000);
  const off = V.travel % spacing;
  for(let k=1;k<70;k++){
    const D = k*spacing - off; if(D < 5) continue;
    const y = hy + f*A/D, y2 = hy + f*A/(D+spacing*.5);
    if(y2 > h*2) continue;
    const r = h2(Math.floor((V.travel+D)/spacing), 3);
    let col = r<.3 ? '#56703a' : r<.55 ? '#7d7d4e' : r<.75 ? '#476035' : '#8d815c';
    col = mixHex(mixHex(col,'#05070a',1-sk.light), sk.hor, clamp(D/(spacing*70),0,.8)*sk.light);
    ctx.fillStyle = col; ctx.fillRect(-w*1.5, y2, w*3, Math.max(1, y-y2));
    if(sk.light < .5 && r < .5){
      ctx.fillStyle = `rgba(255,200,130,${(1-sk.light*2)*.8})`;
      for(let q=0;q<10;q++){ const lx = (h2(k+Math.floor((V.travel+D)/spacing), q)-.5) * 30000; ctx.fillRect(lx*f/D, y2 + (y-y2)*h2(q,k), clamp(40*f/D, 1, 3.5), clamp(6*f/D, 1, 2.5)); }
    }
  }
  // líneas de linde que convergen al horizonte
  ctx.strokeStyle = `rgba(0,0,0,${.05+.05*sk.light})`; ctx.lineWidth = 1;
  for(let k=-12;k<=12;k++){ if(!k) continue; const L = k*k*Math.sign(k)*A*0.35 + k*A*0.8; ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(L*f/(A*0.6), hy + f*A/(A*0.6)); ctx.stroke(); }
  // pista / helipuerto
  const remM = s.distLeft*1000;
  if(!s.heli){
    let near, far;
    if(s.p < .1 && s.onGround){ const roll = Math.min(2400, V.rollM||0); near = 3; far = 2800 - roll; }
    else if(s.p > .7 && Math.max(remM, A*19) < 30000){ near = Math.max(remM, A*19) + 150; far = near + 2800; }
    else if(s.p > .995){ near = 3; far = 2600; }
    if(near != null && far > near) drawRunway(ctx, f, A, hy, near, far, sk, s);
  } else if(s.p > .5 && Math.max(remM, A*5.5) < 7000){
    drawHelipad(ctx, f, A, hy, Math.max(8, remM, A*5.5), sk, s);
  } else if(s.onGround && s.p < .05){
    drawHelipad(ctx, f, A, hy, 12, sk, s);
  }
  // nubes de frente
  V.fwdClouds.forEach((c,i) => {
    if(i/V.fwdClouds.length > V.cloudCover) return;
    let D = ((c.D - V.travel) % 30000 + 30000) % 30000 + 300;
    const dy = (V.cloudAlt + c.dy) - A;
    const sx = c.x*f/D, sy = hy - f*dy/D, size = c.s*f/D;
    if(size < 3 || Math.abs(sx) > w*1.2) return;
    ctx.save(); ctx.filter = `brightness(${Math.round((.35+sk.light*.65)*100)}%)`;
    drawPuffCluster(ctx, sx, sy, size, c.a*clamp(D/1500,0,1), c.n, i+100); ctx.restore();
  });
  ctx.restore();
  const inCloud = 1 - clamp(Math.abs(A - V.cloudAlt)/250, 0, 1);
  if(inCloud > 0 && V.cloudCover > .5){ ctx.fillStyle = `rgba(${Math.round(200*sk.light+30)},${Math.round(205*sk.light+30)},${Math.round(215*sk.light+35)},${inCloud*.85})`; ctx.fillRect(x0,y0,w,h); }
  return sk;
}
function drawRunway(ctx, f, A, hy, near, far, sk, s){
  const hw = 22.5, pt = (D, x) => [x*f/D, hy + f*A/D];
  const [nlx, ny] = pt(near,-hw), [nrx] = pt(near,hw), [flx, fy] = pt(far,-hw), [frx] = pt(far,hw);
  ctx.fillStyle = mixHex('#141518','#4a4c50',sk.light);
  ctx.beginPath(); ctx.moveTo(nlx, ny); ctx.lineTo(nrx, ny); ctx.lineTo(frx, fy); ctx.lineTo(flx, fy); ctx.closePath(); ctx.fill();
  // marcas: umbral y eje
  ctx.fillStyle = sk.light > .3 ? 'rgba(240,240,240,.9)' : 'rgba(200,200,200,.5)';
  for(let D = Math.max(near, 5); D < far; D += 60){
    const D2 = D + 30; if(D2 > far) break;
    const [a1, y1] = pt(D, -.5), [, y2] = pt(D2, -.5), [b2] = pt(D2, .5);
    ctx.beginPath(); ctx.moveTo(a1, y1); ctx.lineTo(-a1, y1); ctx.lineTo(b2, y2); ctx.lineTo(-b2, y2); ctx.fill();
  }
  for(let i=-7;i<=7;i++){ if(Math.abs(i)<1) continue; const x = i*2.6; const [a,y1]=pt(near+2,x-0.9), [b]=pt(near+2,x+0.9), [c,y2]=pt(near+40,x+0.9), [d]=pt(near+40,x-0.9); ctx.beginPath(); ctx.moveTo(a,y1); ctx.lineTo(b,y1); ctx.lineTo(c,y2); ctx.lineTo(d,y2); ctx.fill(); }
  // luces de borde y aproximación
  const night = sk.light < .6;
  for(let D = Math.max(near,5); D < far; D += 60){
    [-hw-1, hw+1].forEach(x => { const [lx, ly] = pt(D, x); ctx.fillStyle = night ? 'rgba(255,240,190,1)' : 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(lx, ly, clamp(80/D*f/400, .8, 4), 0, 7); ctx.fill(); });
  }
  for(let k=1;k<=10;k++){ const D = near - k*30; if(D < 5) continue; for(let x=-12;x<=12;x+=3){ const [lx, ly] = pt(D, x); ctx.fillStyle = night ? 'rgba(255,250,220,1)' : 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(lx, ly, clamp(60/D*f/400,.7,3), 0, 7); ctx.fill(); } }
  // PAPI
  if(near > 150){ const glide = Math.atan(A/near)/D2R; const whites = glide > 3.5 ? 4 : glide > 3.2 ? 3 : glide > 2.8 ? 2 : glide > 2.5 ? 1 : 0;
    for(let i=0;i<4;i++){ const [lx, ly] = pt(near+300, -hw-15-i*9); ctx.fillStyle = i < whites ? '#fff' : '#ff3030'; ctx.beginPath(); ctx.arc(lx, ly, clamp(120/near*f/400,1,4), 0, 7); ctx.fill(); } }
}
function drawHelipad(ctx, f, A, hy, D, sk, s){
  const R = 14, cxp = 0, cyp = hy + f*A/D, rx = R*f/D, ry = Math.max(rx*clamp(A/D,0.06,1), 1);
  ctx.fillStyle = mixHex('#1b1d20','#55595e',sk.light); ctx.beginPath(); ctx.ellipse(cxp, cyp, rx*1.3, ry*1.3, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = sk.light>.3 ? '#f2f2f2' : '#9aa'; ctx.lineWidth = Math.max(1, rx*.06); ctx.beginPath(); ctx.ellipse(cxp, cyp, rx, ry, 0, 0, 7); ctx.stroke();
  ctx.fillStyle = sk.light>.3 ? '#f2f2f2' : '#9aa';
  const hw = rx*.35, hh = ry*.6, bar = Math.max(1, rx*.09);
  ctx.fillRect(cxp-hw, cyp-hh, bar, hh*2); ctx.fillRect(cxp+hw-bar, cyp-hh, bar, hh*2); ctx.fillRect(cxp-hw, cyp-bar/2*clamp(ry/rx,0.2,1), hw*2, Math.max(1,bar*clamp(ry/rx,.2,1)));
  if(sk.light < .6){ for(let i=0;i<16;i++){ const a=i/16*Math.PI*2; ctx.fillStyle = i%2 ? '#3cff6a' : '#ffd23c'; ctx.beginPath(); ctx.arc(cxp+Math.cos(a)*rx*1.3, cyp+Math.sin(a)*ry*1.3, Math.max(1, rx*.04), 0, 7); ctx.fill(); } }
}

/* =================================================================
   INSTRUMENTOS
   ================================================================= */
const KT = 1/1.852;
function txt(ctx, s, x, y, size, col, align='center', font='IBM Plex Mono'){ ctx.font = `600 ${size}px "${font}", monospace`; ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); }
function screenBox(ctx, x, y, w, h){ ctx.fillStyle = '#050608'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#2a2d33'; ctx.lineWidth = 3; ctx.strokeRect(x-1.5, y-1.5, w+3, h+3); }
function drawPFD(ctx, x, y, w, h, s){
  screenBox(ctx, x, y, w, h);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const ax = x + w*.5, ay = y + h*.48, aw = w*.56, ah = h*.66, ppd = ah/32;
  // actitud
  ctx.save(); ctx.beginPath(); ctx.rect(ax-aw/2, ay-ah/2, aw, ah); ctx.clip();
  ctx.translate(ax, ay); ctx.rotate(-s.bank*D2R); const py = s.pitch*ppd;
  ctx.fillStyle = '#2f7fd6'; ctx.fillRect(-aw*2, -ah*3 + py, aw*4, ah*3);
  ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-aw*2, py, aw*4, ah*3);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-aw*2, py); ctx.lineTo(aw*2, py); ctx.stroke();
  for(let d=-30; d<=30; d+=2.5){ if(d===0) continue; const yy = py - d*ppd, len = d%10===0 ? aw*.22 : d%5===0 ? aw*.13 : aw*.06; ctx.beginPath(); ctx.moveTo(-len, yy); ctx.lineTo(len, yy); ctx.stroke(); if(d%10===0){ txt(ctx, Math.abs(d), -len-10, yy, h*.035, '#fff'); txt(ctx, Math.abs(d), len+10, yy, h*.035, '#fff'); } }
  ctx.restore();
  // escala de alabeo
  ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(ax, ay, ah*.42, (-90-60)*D2R, (-90+60)*D2R); ctx.stroke();
  [-60,-45,-30,-20,-10,0,10,20,30,45,60].forEach(a => { const r1=ah*.42, r2=r1+(a%30===0?10:6); ctx.beginPath(); ctx.moveTo(ax+Math.sin(a*D2R)*r1, ay-Math.cos(a*D2R)*r1); ctx.lineTo(ax+Math.sin(a*D2R)*r2, ay-Math.cos(a*D2R)*r2); ctx.stroke(); });
  ctx.save(); ctx.translate(ax, ay); ctx.rotate(-s.bank*D2R); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.moveTo(0,-ah*.42+2); ctx.lineTo(-6,-ah*.42+12); ctx.lineTo(6,-ah*.42+12); ctx.fill(); ctx.restore();
  // símbolo del avión
  ctx.fillStyle='#ffd23c'; ctx.strokeStyle='#000'; ctx.lineWidth=1;
  ctx.fillRect(ax-aw*.32, ay-3, aw*.18, 6); ctx.fillRect(ax+aw*.14, ay-3, aw*.18, 6); ctx.fillRect(ax-4, ay-4, 8, 8);
  // cinta de velocidad
  const tw = w*.13, tx = x + w*.04, kt = s.spd*KT;
  ctx.fillStyle = 'rgba(80,85,95,.6)'; ctx.fillRect(tx, ay-ah/2, tw, ah);
  ctx.save(); ctx.beginPath(); ctx.rect(tx, ay-ah/2, tw, ah); ctx.clip();
  const pk = ah/80;
  for(let v = Math.floor((kt-45)/10)*10; v < kt+45; v+=10){ if(v<0) continue; const yy = ay - (v-kt)*pk; ctx.strokeStyle='#fff'; ctx.beginPath(); ctx.moveTo(tx+tw-8, yy); ctx.lineTo(tx+tw, yy); ctx.stroke(); if(v%20===0) txt(ctx, v, tx+tw*.45, yy, h*.04, '#fff'); }
  ctx.restore();
  ctx.fillStyle='#000'; ctx.fillRect(tx-2, ay-h*.035, tw+6, h*.07); ctx.strokeStyle='#fff'; ctx.strokeRect(tx-2, ay-h*.035, tw+6, h*.07);
  txt(ctx, Math.round(kt), tx+tw*.5, ay, h*.05, '#fff');
  txt(ctx, s.heli ? 'KT' : 'M ' + (kt/600).toFixed(2), tx+tw*.5, ay+ah/2+h*.05, h*.035, '#3cff6a');
  // cinta de altitud
  const atx = x + w*.83, atw = w*.14;
  ctx.fillStyle = 'rgba(80,85,95,.6)'; ctx.fillRect(atx, ay-ah/2, atw, ah);
  ctx.save(); ctx.beginPath(); ctx.rect(atx, ay-ah/2, atw, ah); ctx.clip();
  const pa = ah/1000;
  for(let v = Math.floor((s.alt-600)/100)*100; v < s.alt+600; v+=100){ const yy = ay - (v-s.alt)*pa; ctx.strokeStyle='#fff'; ctx.beginPath(); ctx.moveTo(atx, yy); ctx.lineTo(atx+8, yy); ctx.stroke(); if(v%200===0) txt(ctx, v, atx+atw*.58, yy, h*.035, '#fff'); }
  ctx.restore();
  ctx.fillStyle='#000'; ctx.fillRect(atx-4, ay-h*.035, atw+4, h*.07); ctx.strokeStyle='#fff'; ctx.strokeRect(atx-4, ay-h*.035, atw+4, h*.07);
  txt(ctx, Math.round(s.alt), atx+atw*.5, ay, h*.045, '#fff');
  txt(ctx, (s.vs>=0?'↑':'↓')+Math.abs(Math.round(s.vs/50)*50), atx+atw*.5, ay+ah/2+h*.05, h*.035, '#3cff6a');
  const sel = s.heli ? Math.round(s.f.alt/100)*100 : 'FL'+(s.f.alt/100);
  txt(ctx, sel, atx+atw*.5, ay-ah/2-h*.04, h*.035, '#ff5ce1');
  // rumbo
  const hy2 = y + h*.9, hw2 = w*.5;
  ctx.fillStyle='rgba(80,85,95,.6)'; ctx.fillRect(ax-hw2/2, hy2-h*.04, hw2, h*.08);
  ctx.save(); ctx.beginPath(); ctx.rect(ax-hw2/2, hy2-h*.04, hw2, h*.08); ctx.clip();
  for(let d = Math.floor(s.hdg/5)*5-30; d < s.hdg+30; d+=5){ const xx = ax + (d-s.hdg)*hw2/50; ctx.strokeStyle='#fff'; ctx.beginPath(); ctx.moveTo(xx, hy2-h*.04); ctx.lineTo(xx, hy2-h*.04+(d%10===0?8:4)); ctx.stroke(); if(d%10===0) txt(ctx, String(((d%360)+360)%360/10|0).padStart(2,'0'), xx, hy2+h*.012, h*.03, '#fff'); }
  ctx.restore();
  ctx.fillStyle='#000'; ctx.fillRect(ax-w*.05, hy2-h*.045, w*.1, h*.04); txt(ctx, String(Math.round(s.hdg)).padStart(3,'0'), ax, hy2-h*.025, h*.035, '#fff');
  // anunciador de modos
  const fma = s.onGround ? (s.p<.1 ? ['THR TO','RWY','SRS'] : ['IDLE','ROLL','—']) : s.pi<=2 ? ['THR CLB','NAV','CLB'] : s.pi===3 ? ['SPEED','NAV','ALT CRZ'] : s.pi===4 ? ['THR IDLE','NAV','DES'] : ['SPEED','LOC','G/S'];
  fma.forEach((m,i) => txt(ctx, m, x + w*(.2+i*.3), y + h*.05, h*.035, i===0?'#3cff6a':'#3cff6a'));
  txt(ctx, s.paused ? 'HOLD' : 'AP1', x + w*.92, y + h*.05, h*.032, s.paused ? '#ffd23c' : '#fff');
  ctx.restore();
}
function drawND(ctx, x, y, w, h, s){
  screenBox(ctx, x, y, w, h);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const cx = x + w/2, cy = y + h*.86, R = h*.7;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, R, (-90-50)*D2R, (-90+50)*D2R); ctx.stroke();
  for(let d=-50; d<=50; d+=5){ const hd = s.hdg + d, a = (d-90)*D2R, r2 = R - ((Math.round(hd)%10===0)?12:6); ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*R, cy+Math.sin(a)*R); ctx.lineTo(cx+Math.cos(a)*r2, cy+Math.sin(a)*r2); ctx.stroke(); }
  for(let d=-60; d<=60; d+=10){ const hd = Math.round((s.hdg + d)/10)*10, dd = hd - s.hdg, a = (dd-90)*D2R; if(Math.abs(dd) > 48 || hd%30) continue; txt(ctx, String(((hd%360)+360)%360/10|0), cx+Math.cos(a)*(R-24), cy+Math.sin(a)*(R-24), h*.045, '#fff'); }
  // anillos de alcance
  const nmLeft = s.distLeft/1.852, range = [5,10,20,40,80,160,320,640].find(r => r >= nmLeft*1.15) || 640;
  ctx.setLineDash([4,6]); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(cx, cy, R/2, (-90-50)*D2R, (-90+50)*D2R); ctx.stroke(); ctx.setLineDash([]);
  txt(ctx, range/2, cx - R/2*.64 - 10, cy - R/2*.77, h*.035, 'rgba(255,255,255,.7)');
  // ruta
  const wy = cy - R*Math.min(1, nmLeft/range);
  ctx.strokeStyle = '#ff5ce1'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, wy); ctx.stroke();
  ctx.fillStyle = '#ff5ce1'; ctx.beginPath(); ctx.moveTo(cx, wy-7); ctx.lineTo(cx+7, wy); ctx.lineTo(cx, wy+7); ctx.lineTo(cx-7, wy); ctx.closePath(); ctx.fill();
  txt(ctx, s.d.iata, cx + 14, wy, h*.045, '#ff5ce1', 'left');
  // avión propio
  ctx.fillStyle = '#ffd23c'; ctx.beginPath(); ctx.moveTo(cx, cy-12); ctx.lineTo(cx-8, cy+8); ctx.lineTo(cx, cy+3); ctx.lineTo(cx+8, cy+8); ctx.fill();
  // datos
  txt(ctx, `GS ${Math.round(s.spd*KT)}  TAS ${Math.round(s.spd*KT*1.02)}`, x+8, y+h*.06, h*.04, '#fff', 'left');
  txt(ctx, `${Math.round((s.hdg+180)%360)}° / ${8+Math.round(Math.abs(Math.sin(s.t/40))*20)} KT`, x+8, y+h*.12, h*.04, '#3cffff', 'left');
  txt(ctx, s.d.iata, x+w-8, y+h*.06, h*.045, '#ff5ce1', 'right');
  txt(ctx, `${nmLeft.toFixed(nmLeft<10?1:0)} NM`, x+w-8, y+h*.12, h*.04, '#fff', 'right');
  txt(ctx, fmtTimeTZ(Date.now()+s.rem, 0)+'z', x+w-8, y+h*.18, h*.04, '#fff', 'right');
  txt(ctx, 'HDG ' + String(Math.round(s.hdg)).padStart(3,'0') + ' MAG', cx, y+h*.06, h*.04, '#3cff6a');
  txt(ctx, `${range} NM`, x+8, y+h*.95, h*.035, 'rgba(255,255,255,.6)', 'left');
  ctx.restore();
}
function gauge(ctx, cx, cy, r, val, max, label, unit, col='#fff'){
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI*.8, Math.PI*2.2); ctx.stroke();
  const a = Math.PI*.8 + Math.PI*1.4*clamp(val/max,0,1);
  ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI*.8, a); ctx.stroke();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx+Math.cos(a)*r, cy+Math.sin(a)*r); ctx.stroke();
  txt(ctx, (Math.round(val*10)/10).toFixed(1), cx, cy + r*.55, r*.38, '#3cff6a');
  txt(ctx, label, cx, cy - r - 8, r*.3, '#9adfff');
  if(unit) txt(ctx, unit, cx, cy + r*.95, r*.26, 'rgba(255,255,255,.6)');
}
function drawEICAS(ctx, x, y, w, h, s){
  screenBox(ctx, x, y, w, h);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const r = Math.min(w*.17, h*.17);
  const fuel0 = s.heli ? 900 : Math.round(s.ac.range*2.2);
  const fuel = Math.max(fuel0*0.12, fuel0*(1 - 0.85*s.p));
  if(s.heli){
    const tq = s.onGround ? (s.p<.02?15:35) : s.pi<=2 ? 88 : s.pi===3 ? 72 : s.pi===4 ? 55 : 80;
    const jit = Math.sin(s.t*3)*.6;
    gauge(ctx, x+w*.25, y+h*.25, r, s.p<.01 ? 60+s.p*4000 : 100+jit*.3, 120, 'NR', '%', '#3cff6a');
    gauge(ctx, x+w*.6, y+h*.25, r, tq+jit, 120, 'TQ', '%');
    gauge(ctx, x+w*.25, y+h*.62, r*.8, 640+tq*1.6+jit*3, 1000, 'TOT 1', '°C');
    gauge(ctx, x+w*.6, y+h*.62, r*.8, 635+tq*1.6-jit*3, 1000, 'TOT 2', '°C');
    txt(ctx, `FUEL ${Math.round(fuel)} KG`, x+w*.85, y+h*.2, h*.04, '#fff');
    txt(ctx, `OAT ${Math.round(15 - s.alt*0.002)}°`, x+w*.85, y+h*.3, h*.04, '#fff');
    txt(ctx, `NG ${(92+tq*.08).toFixed(1)}%`, x+w*.85, y+h*.4, h*.04, '#3cff6a');
  } else {
    const n1 = s.onGround ? (s.p<.1 && s.spd>40 ? 93 : 22) : s.pi<=2 ? 92 : s.pi===3 ? 86 : s.pi===4 ? 42 : 61;
    const jit = Math.sin(s.t*2)*.3;
    gauge(ctx, x+w*.25, y+h*.25, r, n1+jit, 110, 'N1', '%', '#3cff6a');
    gauge(ctx, x+w*.6, y+h*.25, r, n1-jit, 110, 'N1', '%', '#3cff6a');
    gauge(ctx, x+w*.25, y+h*.62, r*.8, 420+n1*4+jit*5, 1000, 'EGT', '°C');
    gauge(ctx, x+w*.6, y+h*.62, r*.8, 418+n1*4-jit*5, 1000, 'EGT', '°C');
    txt(ctx, `FOB ${Math.round(fuel).toLocaleString('es-ES')} KG`, x+w*.86, y+h*.18, h*.04, '#fff');
    txt(ctx, `CAB ALT ${Math.round(Math.min(6000, s.alt*0.14))}`, x+w*.86, y+h*.27, h*.04, '#fff');
    const flaps = s.onGround || s.p > .95 ? (s.p>.5?'FULL':'15') : s.p < .12 ? '15' : 'UP';
    txt(ctx, `FLAPS ${flaps}`, x+w*.86, y+h*.36, h*.04, flaps==='UP' ? '#fff' : '#3cffff');
  }
  const gearDown = s.alt < 1800 || s.onGround;
  ctx.fillStyle = gearDown ? '#3cff6a' : '#555'; ['L','N','R'].forEach((g,i) => { ctx.fillRect(x+w*(.77+i*.07), y+h*.5, w*.055, h*.07); txt(ctx, g, x+w*(.797+i*.07), y+h*.535, h*.035, '#000'); });
  txt(ctx, gearDown ? 'GEAR DOWN' : 'GEAR UP', x+w*.86, y+h*.62, h*.035, gearDown ? '#3cff6a' : '#aaa');
  // mensajes
  const msgs = s.paused ? ['HOLDING PATTERN'] : s.f.breakUntil ? ['CABIN BREAK'] : s.pi===3 ? ['AP ENGAGED','CRZ'] : s.pi>=4 ? ['APPROACH','SEAT BELTS'] : ['T/O CONFIG OK'];
  msgs.forEach((m,i) => txt(ctx, m, x+w*.06, y+h*(.86+i*.07), h*.04, i ? '#3cffff' : '#3cff6a', 'left'));
  ctx.restore();
}

/* =================================================================
   VISTA CABINA
   ================================================================= */
function drawCockpit(ctx, W, H, s){
  const heli = s.heli, mil = s.mil;
  const small = W < 820;
  const portrait = H > W*1.1;
  const wsH = H*(portrait ? (heli ? .42 : .38) : (heli ? .62 : .54));
  const vib = heli && !s.onGround ? Math.sin(s.t*47)*1 : 0;
  ctx.save(); ctx.translate(0, vib);
  const sk = drawFrontScene(ctx, 0, 0, W, wsH*1.05, s);
  // marco del parabrisas
  const frame = mil ? '#2b2f25' : '#15171b';
  ctx.fillStyle = frame;
  if(heli){
    ctx.fillRect(0, 0, W, H*.03);
    ctx.beginPath(); ctx.moveTo(W*.5-8, 0); ctx.lineTo(W*.5+8, 0); ctx.lineTo(W*.5+5, wsH); ctx.lineTo(W*.5-5, wsH); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W*.06, 0); ctx.lineTo(W*.02, wsH); ctx.lineTo(0, wsH); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W*.94, 0); ctx.lineTo(W*.98, wsH); ctx.lineTo(W, wsH); ctx.fill();
  } else {
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(W,0); ctx.lineTo(W, H*.06); ctx.quadraticCurveTo(W*.5, H*.1, 0, H*.06); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W*.5-14, H*.07); ctx.lineTo(W*.5+14, H*.07); ctx.lineTo(W*.5+9, wsH); ctx.lineTo(W*.5-9, wsH); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, H*.06); ctx.lineTo(W*.13, H*.08); ctx.lineTo(W*.05, wsH); ctx.lineTo(0, wsH); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W, H*.06); ctx.lineTo(W*.87, H*.08); ctx.lineTo(W*.95, wsH); ctx.lineTo(W, wsH); ctx.fill();
  }
  // reflejo
  const rg = ctx.createLinearGradient(0,0,W,wsH); rg.addColorStop(0,'rgba(255,255,255,.04)'); rg.addColorStop(1,'rgba(255,255,255,0)'); ctx.fillStyle=rg; ctx.fillRect(0,0,W,wsH);
  // visera (glareshield) con panel de piloto automático
  const gsY = wsH, gsH = H*.06;
  ctx.fillStyle = mil ? '#24281f' : '#1c1e23'; ctx.beginPath(); ctx.moveTo(0, gsY); ctx.quadraticCurveTo(W*.5, gsY-H*.03, W, gsY); ctx.lineTo(W, gsY+gsH); ctx.lineTo(0, gsY+gsH); ctx.fill();
  const apW = Math.min(W*.6, 760), apX = (W-apW)/2, apY = gsY + gsH*.18, apH = gsH*.64;
  ctx.fillStyle = '#2d3038'; ctx.fillRect(apX, apY, apW, apH);
  const fields = heli ? [['IAS', Math.round(s.f && acOf(s.f).speed*KT)], ['HDG', String(Math.round(s.hdg)).padStart(3,'0')], ['ALT', Math.round(s.f.alt)], ['VS', Math.round(s.vs/100)*100], ['AP', s.paused?'HOLD':'ON']]
    : [['SPD', s.pi===3 ? '.'+Math.round(s.spd*KT/600*100) : Math.round(s.spd*KT)], ['HDG', String(Math.round(s.hdg)).padStart(3,'0')], ['ALT', s.pi<=3 ? 'FL'+(s.f.alt/100) : Math.round(Math.max(2000,s.alt)/100)*100], ['V/S', Math.round(s.vs/100)*100], ['AP1', s.paused?'HOLD':'ON']];
  fields.forEach((fd,i) => { const fx = apX + apW*(i+.5)/fields.length; txt(ctx, fd[0], fx, apY+apH*.28, apH*.24, '#c9ccd3', 'center', 'Manrope'); txt(ctx, fd[1], fx, apY+apH*.68, apH*.36, '#ffb547'); });
  // panel principal
  const pY = gsY + gsH, pH = H - pY;
  const pg = ctx.createLinearGradient(0, pY, 0, H); pg.addColorStop(0, mil ? '#30352a' : '#23262c'); pg.addColorStop(1, mil ? '#1c1f18' : '#121418');
  ctx.fillStyle = pg; ctx.fillRect(0, pY, W, pH);
  // pantallas
  const order = portrait ? ['pfd','nd','eng', heli ? null : 'pfd2'].filter(Boolean).slice(0, heli ? 3 : 4) : (heli ? ['pfd','nd','eng'] : ['pfd','nd','eng','pfd2']);
  const scr = order.length, cols = portrait ? 2 : scr, rowsN = Math.ceil(scr/cols);
  const gap = W*.015;
  let sw = Math.min((W - gap*(cols+1))/cols, (pH*.86/rowsN)*1.25);
  let sh = Math.min(sw*.82, pH*.86/rowsN - gap);
  const totalW = sw*cols + gap*(cols-1), sx0 = (W-totalW)/2, sy = pY + pH*.04;
  order.forEach((k,i) => {
    const col = i % cols, row = Math.floor(i/cols);
    const lastRowCount = scr - Math.floor((scr-1)/cols)*cols;
    const rowOff = (row === rowsN-1 && lastRowCount < cols) ? (cols-lastRowCount)*(sw+gap)/2 : 0;
    const xx = sx0 + col*(sw+gap) + rowOff, yy = sy + row*(sh+gap);
    const sy_ = yy;
    if(k==='pfd' || k==='pfd2') drawPFD(ctx, xx, sy_, sw, sh, s);
    else if(k==='nd') drawND(ctx, xx, sy_, sw, sh, s);
    else drawEICAS(ctx, xx, sy_, sw, sh, s);
  });
  const screensBottom = sy + rowsN*(sh+gap) - gap;
  // pedestal y mandos bajo las pantallas
  const below = screensBottom + pH*.04, room = H - below;
  if(room > 26){
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    for(let i=0;i<24;i++){ ctx.beginPath(); ctx.arc(sx0 + (i/23)*totalW, below - pH*.02, 2.5, 0, 7); ctx.fill(); }
    const pw = Math.min(W*.16, 220), px = W/2 - pw/2;
    ctx.fillStyle = '#16171b'; ctx.fillRect(px, below, pw, room);
    if(heli){
      txt(ctx, s.f.callsign, W/2, below + Math.min(room*.5, 22), Math.min(16, room*.4), '#ffb547');
      // collective (izq.) y cíclico (centro) asomando
      ctx.fillStyle = '#0c0d10'; ctx.fillRect(px - pw*.5, H - room*.6, pw*.25, room*.6);
      ctx.beginPath(); ctx.arc(px - pw*.38, H - room*.62, Math.min(14, room*.25), 0, 7); ctx.fill();
    } else {
      const thr = s.onGround ? (s.p<.1 && s.spd>40 ? .9 : .1) : s.pi<=2 ? .85 : s.pi===3 ? .7 : .25;
      [W/2 - pw*.18, W/2 + pw*.18].forEach(xx => { ctx.fillStyle='#2b2d33'; ctx.fillRect(xx-3, below+6, 6, room-6); ctx.fillStyle='#d9dbe0'; ctx.fillRect(xx-10, below + 6 + (room-20)*(1-thr), 20, 12); });
      txt(ctx, 'THR', W/2, below + room - 8, 9, 'rgba(255,255,255,.4)');
    }
  }
  // placa de la aeronave
  txt(ctx, `${s.ac.name.toUpperCase()} · ${s.f.reg}`, 14, H - 12, Math.max(9, H*.013), 'rgba(255,255,255,.35)', 'left', 'Manrope');
  // luz ambiente nocturna en el panel
  if(sk.light < .4){ ctx.fillStyle = `rgba(0,0,0,${(.4-sk.light)*.4})`; ctx.fillRect(0, pY, W, pH); }
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
  if(V.mode==='window') drawWindow(ctx, V.w, V.h, s); else drawCockpit(ctx, V.w, V.h, s);
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
  document.body.classList.remove('view-map','view-window','view-cockpit');
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
  $('viewSwitch').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if(b && flight && flight.start) setView(b.dataset.v); });
  $('vbPause').onclick = () => togglePause();
  $('vbNoise').onclick = () => setNoise(!noise);
  window.addEventListener('resize', () => { if(V.mode!=='map') resize(); });
  document.addEventListener('visibilitychange', () => { V.last = 0; });
}
window.VPV = {
  enter(){ const m = LS.get('vp_view','map'); setView(['map','window','cockpit'].includes(m) ? m : 'map'); },
  exit(){ V.mode='map'; if(V.raf) cancelAnimationFrame(V.raf); V.raf=null; document.body.classList.remove('view-window','view-cockpit'); document.body.classList.add('view-map'); V.tabFor=null; },
  set: setView,
  get mode(){ return V.mode; },
};
init();
if(flight && flight.start) VPV.enter(); else document.body.classList.add('view-map');
})();
