/* ============================================================
   VUELO PRIVADO · Rutas aéreas realistas
   - Pista en uso según el viento real (Open-Meteo)
   - Salida por el rumbo de pista, ruta por radioayudas VOR reales,
     tramos oceánicos por ortodrómica con puntos tipo 45N030W
   - Llegada alineada con la pista: IAF → FAF → umbral
   ============================================================ */
'use strict';

const RT_R = 6371, RT_D2R = Math.PI/180;
const WIND = {};   // código → { dir, spd (km/h), t }

/* ---------- geodesia ---------- */
function gcDist(a, b){
  const dLat=(b.lat-a.lat)*RT_D2R, dLon=(b.lon-a.lon)*RT_D2R;
  const h=Math.sin(dLat/2)**2+Math.cos(a.lat*RT_D2R)*Math.cos(b.lat*RT_D2R)*Math.sin(dLon/2)**2;
  return 2*RT_R*Math.asin(Math.min(1,Math.sqrt(h)));
}
function gcBearing(a, b){
  const y=Math.sin((b.lon-a.lon)*RT_D2R)*Math.cos(b.lat*RT_D2R);
  const x=Math.cos(a.lat*RT_D2R)*Math.sin(b.lat*RT_D2R)-Math.sin(a.lat*RT_D2R)*Math.cos(b.lat*RT_D2R)*Math.cos((b.lon-a.lon)*RT_D2R);
  return (Math.atan2(y,x)/RT_D2R+360)%360;
}
function gcDest(p, brg, km){
  const d=km/RT_R, b=brg*RT_D2R, la=p.lat*RT_D2R, lo=p.lon*RT_D2R;
  const la2=Math.asin(Math.sin(la)*Math.cos(d)+Math.cos(la)*Math.sin(d)*Math.cos(b));
  const lo2=lo+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(la), Math.cos(d)-Math.sin(la)*Math.sin(la2));
  return { lat: la2/RT_D2R, lon: ((lo2/RT_D2R+540)%360)-180 };
}
function gcInterp(a, b, f){
  const d = gcDist(a,b)/RT_R; if(d < 1e-9) return { lat:a.lat, lon:a.lon };
  const A=Math.sin((1-f)*d)/Math.sin(d), B=Math.sin(f*d)/Math.sin(d);
  const la1=a.lat*RT_D2R, lo1=a.lon*RT_D2R, la2=b.lat*RT_D2R, lo2=b.lon*RT_D2R;
  const x=A*Math.cos(la1)*Math.cos(lo1)+B*Math.cos(la2)*Math.cos(lo2);
  const y=A*Math.cos(la1)*Math.sin(lo1)+B*Math.cos(la2)*Math.sin(lo2);
  const z=A*Math.sin(la1)+B*Math.sin(la2);
  return { lat: Math.atan2(z, Math.sqrt(x*x+y*y))/RT_D2R, lon: Math.atan2(y,x)/RT_D2R };
}
const angDiff = (a,b) => { let d=((a-b)%360+540)%360-180; return d; };

/* ---------- índice espacial de VOR ---------- */
const NAV_GRID = {};
(typeof NAVAIDS!=='undefined' ? NAVAIDS : []).forEach(n => {
  const k = Math.floor(n[2]/2)+':'+Math.floor(n[3]/2);
  (NAV_GRID[k] ||= []).push({ id:n[0], name:n[1], lat:n[2], lon:n[3], type:n[4] });
});
function navNear(p, radiusKm){
  const out=[], cl=Math.floor(p.lat/2), co=Math.floor(p.lon/2), span=Math.ceil(radiusKm/200)+1;
  for(let i=-span;i<=span;i++) for(let j=-span;j<=span;j++){
    let cj = co+j; if(cj < -90) cj += 180; if(cj >= 90) cj -= 180;
    (NAV_GRID[(cl+i)+':'+cj]||[]).forEach(n => { const d=gcDist(p,n); if(d<=radiusKm) out.push({ n, d }); });
  }
  return out.sort((a,b)=>a.d-b.d);
}

/* ---------- pistas ---------- */
function runwayEnds(code){
  const R = typeof RUNWAYS!=='undefined' ? RUNWAYS[code] : null, a = AP[code];
  if(!R || !R.rw || !R.rw.length || !a) return [];
  const ends=[];
  R.rw.forEach(rw => {
    [0,1].forEach(i => {
      const hdg = rw.h[i];
      let thr, far;
      if(rw.e){ thr={lat:rw.e[i][0],lon:rw.e[i][1]}; far={lat:rw.e[1-i][0],lon:rw.e[1-i][1]}; }
      else { thr=gcDest(a, hdg+180, rw.len/2000); far=gcDest(a, hdg, rw.len/2000); }
      ends.push({ id:rw.id[i], hdg, thr, far, len:rw.len, icao:R.icao });
    });
  });
  return ends;
}
/* elige la pista con más viento de cara; sin viento, la mejor alineada con la ruta y más larga */
function pickRunway(code, mode, wind, routeBrg){
  const ends = runwayEnds(code); if(!ends.length) return null;
  const w = wind || WIND[code];
  let best=null, bestS=-1e9;
  ends.forEach(e => {
    let s = e.len/1500;
    if(w && w.spd >= 6){
      const head = Math.cos(angDiff(e.hdg, w.dir)*RT_D2R) * w.spd;   // viento de cara (+) o de cola (−)
      s += head*0.6; if(head < -8) s -= 40;
    } else if(routeBrg != null){
      const want = mode==='dep' ? routeBrg : routeBrg;   // salir hacia el destino / llegar recto
      s += Math.cos(angDiff(e.hdg, want)*RT_D2R)*2.5;
    }
    if(s > bestS){ bestS=s; best=e; }
  });
  return best;
}

/* ---------- formato de puntos oceánicos (p. ej. 45N030W) ---------- */
function oceanicName(p){
  const la=Math.round(Math.abs(p.lat)), lo=Math.round(Math.abs(p.lon));
  return `${String(la).padStart(2,'0')}${p.lat>=0?'N':'S'}${String(lo).padStart(3,'0')}${p.lon>=0?'E':'W'}`;
}

/* ---------- construcción de la ruta ---------- */
function buildRoute(oCode, dCode, ac, mode, startPt){
  const o = startPt ? { lat:startPt.lat, lon:startPt.lon, iata:'POS', city:'Posición actual' } : AP[oCode], d = AP[dCode];
  const P = (lat, lon, name, kind, label) => ({ lat, lon, name, kind, label: label||'' });
  const first = () => startPt ? P(o.lat, o.lon, 'DESVÍO', 'cur', 'Cambio de destino') : P(o.lat,o.lon,o.iata,'apt',o.city);
  const direct = () => {
    const pts=[first(), P(d.lat,d.lon,d.iata,'apt',d.city)];
    return finish({ pts, dep:null, arr:null, vfr: ac.kind==='heli' });
  };
  if(ac.kind==='heli' || mode==='direct') return direct();

  const gcBrg = gcBearing(o,d), total = gcDist(o,d);
  const dep = startPt ? null : pickRunway(oCode, 'dep', null, gcBrg);
  const arr = pickRunway(dCode, 'arr', null, gcBrg);
  const pts=[];
  // salida
  let A;
  if(dep){
    pts.push(P(dep.thr.lat, dep.thr.lon, `${o.iata} ${dep.id}`, 'rwy', `Pista ${dep.id}`));
    pts.push(P(dep.far.lat, dep.far.lon, '', 'rwyend'));
    const climbKm = total < 80 ? 4 : 9;
    A = gcDest(dep.far, dep.hdg, climbKm);
    pts.push(P(A.lat, A.lon, `D${dep.id}`, 'sid', `Salida pista ${dep.id}`));
  } else {
    pts.push(first()); A = { lat:o.lat, lon:o.lon };
  }
  // llegada (se calcula ya para saber dónde termina el tramo en ruta)
  let arrPts=[], B;
  if(arr){
    const back = (arr.hdg+180)%360;
    const faf = gcDest(arr.thr, back, total < 80 ? 9 : 15);
    // lado por el que llegamos respecto al eje de pista
    const inBrg = gcBearing(A, faf);
    const side = angDiff(inBrg, arr.hdg) > 0 ? -1 : 1;
    const turn = Math.abs(angDiff(inBrg, arr.hdg));
    if(turn > 35){
      const iaf = gcDest(faf, back + side*55, total < 80 ? 6 : 13);
      arrPts.push(P(iaf.lat, iaf.lon, `IAF${arr.id}`, 'star', `Inicio aproximación ${arr.id}`));
    }
    arrPts.push(P(faf.lat, faf.lon, `FAF${arr.id}`, 'faf', `Final pista ${arr.id}`));
    arrPts.push(P(arr.thr.lat, arr.thr.lon, `${d.iata} ${arr.id}`, 'rwy', `Pista ${arr.id}`));
    B = arrPts[0];
  } else {
    arrPts.push(P(d.lat,d.lon,d.iata,'apt',d.city)); B = { lat:d.lat, lon:d.lon };
  }
  // tramo en ruta por VOR / ortodrómica
  const Dab = gcDist(A,B);
  if(Dab > 140){
    const N = Math.max(2, Math.ceil(Dab/220));
    const radius = Math.max(75, Math.min(140, Dab*0.09));
    const used = new Set(); let lastF = 0;
    for(let k=1;k<N;k++){
      const f = k/N, S = gcInterp(A,B,f);
      const cand = navNear(S, radius).find(c => !used.has(c.n.id+c.n.lat) );
      if(cand){
        const n = cand.n;
        // que avance a lo largo de la ruta
        const fN = gcDist(A,n)/ (gcDist(A,n)+gcDist(n,B));
        if(fN > lastF + 0.3/N){ used.add(n.id+n.lat); lastF=fN; pts.push(P(n.lat, n.lon, n.id, 'vor', `${n.type} ${n.name}`)); continue; }
      }
      pts.push(P(S.lat, S.lon, oceanicName(S), 'gc', 'Punto de ruta')); lastF = f;
    }
  }
  pts.push(...arrPts);
  return finish({ pts, dep, arr, vfr:false });

  function finish(r){
    // desenrolla longitudes para dibujar sin cruzar el antimeridiano al revés
    for(let i=1;i<r.pts.length;i++){ let dl=r.pts[i].lon-r.pts[i-1].lon; while(dl>180){ r.pts[i].lon-=360; dl-=360; } while(dl<-180){ r.pts[i].lon+=360; dl+=360; } }
    let dist=0; r.cum=[0];
    for(let i=1;i<r.pts.length;i++){ dist+=gcDist(r.pts[i-1], r.pts[i]); r.cum.push(dist); }
    r.dist = dist;
    const icaoO = startPt ? 'DESVÍO' : ((RUNWAYS[oCode]?.icao) || o.iata), icaoD = (RUNWAYS[dCode]?.icao) || d.iata;
    const mid = r.pts.filter(p => p.kind==='vor' || p.kind==='gc').map(p => p.name);
    r.str = r.vfr ? `${icaoO} VFR DCT ${icaoD}` :
      `${icaoO}${r.dep?'/'+r.dep.id:''} ${mid.length ? 'DCT ' + mid.join(' DCT ') + ' ' : ''}DCT ${icaoD}${r.arr?'/'+r.arr.id:''}`;
    const midS = mid.length > 12 ? [...mid.slice(0,6), '…', ...mid.slice(-4)] : mid;
    r.strShort = r.vfr ? r.str : `${icaoO}${r.dep?'/'+r.dep.id:''} ${midS.length ? midS.join(' ') + ' ' : ''}${icaoD}${r.arr?'/'+r.arr.id:''}`;
    r.wind = { o: startPt ? null : (WIND[oCode]||null), d: WIND[dCode]||null };
    return r;
  }
}

/* ---------- posición a lo largo de la ruta ---------- */
function routeSegAt(route, p){
  const target = p * route.dist, c = route.cum;
  let i = 1; while(i < c.length-1 && c[i] < target) i++;
  const segLen = c[i]-c[i-1] || 1;
  return { i, f: Math.max(0, Math.min(1, (target-c[i-1])/segLen)) };
}
function nextWaypoint(route, p){
  const { i } = routeSegAt(route, p);
  for(let k=i;k<route.pts.length;k++){ const q=route.pts[k]; if(q.name && q.kind!=='rwyend') return { pt:q, km: route.cum[k] - p*route.dist, idx:k }; }
  return null;
}
/* serializa la ruta para guardarla en el vuelo (compacta) */
function packRoute(r){ return { pts:r.pts.map(p=>[+p.lat.toFixed(5), +p.lon.toFixed(5), p.name, p.kind, p.label]), cum:r.cum.map(x=>+x.toFixed(2)), dist:r.dist, str:r.str, strShort:r.strShort, vfr:r.vfr,
  dep: r.dep ? { id:r.dep.id, hdg:r.dep.hdg, len:r.dep.len } : null, arr: r.arr ? { id:r.arr.id, hdg:r.arr.hdg, len:r.arr.len } : null, wind:r.wind }; }
function unpackRoute(r){ if(!r) return null; return { ...r, pts: r.pts.map(a => ({ lat:a[0], lon:a[1], name:a[2], kind:a[3], label:a[4] })) }; }

/* recalcula distancias acumuladas tras unir tramos */
function recomputeRoute(r){
  for(let i=1;i<r.pts.length;i++){ let dl=r.pts[i].lon-r.pts[i-1].lon; while(dl>180){ r.pts[i].lon-=360; dl-=360; } while(dl<-180){ r.pts[i].lon+=360; dl+=360; } }
  let dist=0; r.cum=[0];
  for(let i=1;i<r.pts.length;i++){ dist+=gcDist(r.pts[i-1], r.pts[i]); r.cum.push(dist); }
  r.dist=dist; return r;
}
/* punto exacto a lo largo de la ruta (fracción de distancia) */
function routePointAt(r, frac){
  const { i, f } = routeSegAt(r, frac);
  const a = r.pts[i-1], b = r.pts[i];
  const q = gcInterp({ lat:a.lat, lon:a.lon }, { lat:b.lat, lon:b.lon }, f);
  q.lon += 360*Math.round((a.lon + (b.lon-a.lon)*f - q.lon)/360);   // mantener la misma "copia" del mundo
  return { ...q, seg:i };
}
