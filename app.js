/* ============================================================
   VUELO PRIVADO · Lógica de la app
   ============================================================ */
'use strict';
const PAX = { name:'GORKA CORBACHO MARTÍNEZ', alias:'COMANDANTE SUPREMO' };

const AIRPORTS = AIRPORTS_RAW.map(a => ({ iata:a[0], city:a[1], name:a[2], cc:a[3], lat:a[4], lon:a[5], type:a[6]||'ap', note:a[7]||'' }));
const AP = Object.fromEntries(AIRPORTS.map(a => [a.iata, a]));
const ACF = Object.fromEntries(AIRCRAFT.map(a => [a.id, a]));
const heliOnly = a => a.type==='hp' || a.type==='milh' || a.type==='cp';

/* ---- puntos libres elegidos en el mapa (solo helicóptero) ---- */
let customPts = LS_get('vp_custom', []);
function LS_get(k,d){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; } }
function indexCustom(c){
  const a = { iata:c.code, city:c.city, name:c.name, cc:c.cc, lat:c.lat, lon:c.lon, type:'cp', note:'Punto libre elegido en el mapa', custom:true };
  if(c.country && !COUNTRIES[c.cc]) COUNTRIES[c.cc] = c.country;
  const i = AIRPORTS.findIndex(x => x.iata===a.iata); if(i>=0) AIRPORTS[i]=a; else AIRPORTS.push(a);
  AP[a.iata] = a; return a;
}
customPts.forEach(indexCustom);
const isMilAp = a => a.type==='mil' || a.type==='milh';

const NAMES_M = ['Alejandro','Javier','Íñigo','Mikel','Álvaro','Sergio','Daniel','Jorge','Rafael','Unai','Pablo','Marcos','Diego','Hugo','Adrián','Asier','Fernando','Gonzalo','Ignacio','Rodrigo','Aitor','Martín'];
const NAMES_F = ['Lucía','Carmen','Elena','Irene','Paula','Ane','Nerea','Marta','Sofía','Claudia','Laura','Alba','Leire','Valeria','Cristina','Julia','Noelia','Olivia','Amaia','Inés','Beatriz','Carlota'];
const SURN = ['García','Fernández','Etxeberria','Aguirre','Navarro','Ortega','Castillo','Ibarra','Ruiz','Romero','Delgado','Zubiaurre','Molina','Herrera','Vidal','Sáez','Prieto','Arrieta','Montero','Salazar','Iglesias','Urquijo','Cortés','Mendoza','Lasarte','Belmonte','Olabarria','Valverde','Quintana','Echevarría'];
const CATERING = ['jamón ibérico de bellota y pan de cristal','sushi omakase','ostras con champán','tabla de quesos curados','tortilla de patata recién hecha','pintxos donostiarras','caviar Beluga con blinis','fruta tropical cortada','croissants de mantequilla','solomillo con foie','ensalada de burrata','chocolates belgas'];
const DRINKS = ['un café solo','un cappuccino','zumo de naranja natural','agua con gas y limón','un té matcha','un chocolate caliente','una limonada de la casa','un smoothie de frutos rojos'];
const SKY = ['Despejado ☀️','Poco nuboso 🌤️','Nubes y claros ⛅','Brisa suave 🌬️'];
const GATES = ['Pie de avión','Plataforma VIP 3','FBO · Stand 7','Hangar privado 2','Rampa ejecutiva 5'];
const GATES_MIL = ['Sala de autoridades','Plataforma de Estado','Hangar VIP','Rampa de honores'];
const STAMP_INKS = ['#9b2c2c','#1f4e8c','#2f6b3a','#6b2f7a','#8a5a12','#0f5f66'];

const TIERS = [
 { n:'Silver',h:0,c:'#c9ccd3' },{ n:'Gold',h:5,c:'#d4af6a' },{ n:'Platinum',h:20,c:'#e9e7e1' },{ n:'Black',h:50,c:'#1a1a1a' },{ n:'Infinite',h:100,c:'#9b7bff' },
];
const PHASES_JET = [
 { to:.03,n:'Rodaje',i:'🛞' },{ to:.08,n:'Despegue',i:'🛫' },{ to:.20,n:'Ascenso',i:'↗️' },{ to:.82,n:'Crucero',i:'✈️' },{ to:.95,n:'Descenso',i:'↘️' },{ to:1.01,n:'Aproximación',i:'🛬' },
];
const PHASES_HELI = [
 { to:.02,n:'Arranque de rotores',i:'🔄' },{ to:.04,n:'Despegue vertical',i:'🚁' },{ to:.10,n:'Ascenso',i:'↗️' },{ to:.90,n:'Crucero',i:'🚁' },{ to:.97,n:'Descenso',i:'↘️' },{ to:1.01,n:'Toma',i:'🛬' },
];

/* =================== UTILIDADES =================== */
const $ = id => document.getElementById(id);
const LS = { get(k,d){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch(e){ return d; } }, set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }, del(k){ try{ localStorage.removeItem(k); }catch(e){} } };
const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
const flag = cc => String.fromCodePoint(...[...cc].map(c => 127397 + c.charCodeAt(0)));
const fmtN = n => Math.round(n).toLocaleString('es-ES');
const pad = n => String(n).padStart(2,'0');
function fmtClock(ms){ ms=Math.max(0,ms); const s=Math.floor(ms/1000), h=Math.floor(s/3600), m=Math.floor(s%3600/60), x=s%60; return h ? `${h}:${pad(m)}:${pad(x)}` : `${pad(m)}:${pad(x)}`; }
function fmtHM(min){ min=Math.round(min); const h=Math.floor(min/60), m=min%60; return h ? `${h} h ${pad(m)} min` : `${m} min`; }
function fmtTime(ts){ const d=new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fmtTimeTZ(ts, off){ if(off==null) return fmtTime(ts); const d=new Date(ts+off*1000); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; }
function fmtUTC(off){ if(off==null) return ''; const h=off/3600; return 'UTC' + (h>=0?'+':'−') + (Math.abs(h)%1 ? Math.abs(h).toFixed(1) : Math.abs(h)); }
function fmtDate(ts){ return new Date(ts).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase().replace('.',''); }
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const pick = (r,arr) => arr[Math.floor(r()*arr.length)];
function hashStr(s){ let h=2166136261; for(const c of s){ h^=c.charCodeAt(0); h=Math.imul(h,16777619); } return h>>>0; }
function distKm(a,b){ const R=6371, toR=Math.PI/180; const dLat=(b.lat-a.lat)*toR, dLon=(b.lon-a.lon)*toR; const h=Math.sin(dLat/2)**2+Math.cos(a.lat*toR)*Math.cos(b.lat*toR)*Math.sin(dLon/2)**2; return 2*R*Math.asin(Math.sqrt(h)); }
function greeting(){ const h=new Date().getHours(); return h<6?'Buenas noches':h<13?'Buenos días':h<21?'Buenas tardes':'Buenas noches'; }
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('show'),3000); }
function loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); }
function person(r,g){ g = g || (r()<.5?'M':'F'); return `${pick(r, g==='M'?NAMES_M:NAMES_F)} ${pick(r,SURN)} ${pick(r,SURN)}`; }
const typeIcon = a => AP_TYPES[a.type].icon;

/* =================== CÁLCULO DE VUELO =================== */
const maxStops = ac => ac.kind==='heli' ? 4 : 1;
const stopsFor = (dist,ac) => Math.max(0, Math.ceil(dist/ac.range)-1);
function feasible(ac,o,d){
  if((heliOnly(o)||heliOnly(d)) && ac.kind!=='heli') return false;
  return stopsFor(distKm(o,d),ac) <= maxStops(ac);
}
function flightMin(dist,ac){
  const stops = stopsFor(dist,ac);
  if(ac.kind==='heli'){
    // helicóptero: sin rodaje; ~2 min despegue/ascenso + ~2 min aproximación; en tramos cortos no llega a velocidad de crucero
    const eff = dist < 30 ? ac.speed*0.7 : dist < 100 ? ac.speed*0.8 : ac.speed*0.88;
    return Math.max(4, Math.round(dist/eff*60 + 4 + stops*20));
  }
  // jet: rodaje, despegue/ascenso y descenso/aproximación (~18 min) + crucero
  return Math.max(15, Math.round(dist/(ac.speed*0.92)*60 + 18 + stops*45));
}
function cruiseAlt(dist,ac){
  if(ac.kind==='heli') return dist<60 ? 1500 : dist<200 ? 2500 : 4500;
  if(dist<400) return 28000; if(dist<900) return 37000;
  return Math.min(ac.ceil, dist>5000 ? 47000 : 43000);
}
function bestAircraft(o,d,prefer){
  const cur = ACF[prefer];
  if(cur && feasible(cur,o,d)) return cur;
  const list = AIRCRAFT.filter(a => feasible(a,o,d));
  if(!list.length) return null;
  // mismo tipo y misma "familia" (privado / Estado) si es posible
  const same = list.filter(a => a.kind===(cur?.kind) && !!a.mil===!!cur?.mil);
  const pool = same.length ? same : list.filter(a => a.kind===(cur?.kind)).length ? list.filter(a => a.kind===(cur?.kind)) : list;
  return pool.sort((a,b) => stopsFor(distKm(o,d),a)-stopsFor(distKm(o,d),b) || a.range-b.range)[0];
}

/* =================== ESTADO =================== */
const pref = LS.get('vp_pref', {});
let S = {
  origin: AP[pref.origin] ? pref.origin : 'MAD',
  dest: AP[pref.dest] ? pref.dest : null,
  ac: ACF[pref.ac] ? pref.ac : 'g700',
  study: pref.study || 60,
  breaks: pref.breaks ?? 50,
  routeMode: pref.routeMode || 'real',
};
let flight = LS.get('vp_active', null);
let log = LS.get('vp_log', []);
let follow = false;
const savePref = () => LS.set('vp_pref', S);
const saveFlight = () => flight ? LS.set('vp_active', Object.fromEntries(Object.entries(flight).filter(([k]) => k[0] !== '_'))) : LS.del('vp_active');
const saveLog = () => LS.set('vp_log', log);
const acOf = f => ACF[f.ac] || AIRCRAFT[0];
/* límites de fase en tiempo absoluto realista (se comprimen solo en vuelos cortos) */
function phaseMinutes(f, D){
  D = D || f.durMs/60000;
  const heli = acOf(f).kind==='heli';
  const m = heli ? [2, .6, 3, 4, 1.6] : [5, 2, 18, 22, 7];      // rodaje/arranque, despegue, ascenso, descenso, aproximación (min)
  const sum = m.reduce((a,b)=>a+b,0), k = Math.min(1, (heli?.65:.75)*D/sum);
  return m.map(x => x*k);
}
function boundsFrom(m, D){
  const b0=m[0]/D, b1=b0+m[1]/D, b4=1-m[4]/D, b3=Math.max(b1, b4-m[3]/D), b2=Math.min(b1+m[2]/D, b3);
  return [b0, b1, b2, b3, b4, 1.01];
}
function phaseBounds(f){
  if(f._pb) return f._pb;
  if(!f.pm) f.pm = phaseMinutes(f);
  return (f._pb = boundsFrom(f.pm, f.durMs/60000));
}
const phasesOf = f => { const b=phaseBounds(f); return (acOf(f).kind==='heli' ? PHASES_HELI : PHASES_JET).map((x,i) => ({ ...x, to:b[i] })); };

/* =================== METEO Y HORA LOCAL (Open-Meteo, sin clave) =================== */
function wmo(code, isDay){
  if(code===0 || code===1) return isDay===0 ? (code===0?'Despejado 🌙':'Poco nuboso 🌙') : (code===0?'Despejado ☀️':'Poco nuboso 🌤️');
  if(code===2) return 'Nubes y claros ⛅'; if(code===3) return 'Cubierto ☁️';
  if(code===45||code===48) return 'Niebla 🌫️';
  if(code>=51&&code<=57) return 'Llovizna 🌦️'; if(code>=61&&code<=67) return 'Lluvia 🌧️';
  if(code>=71&&code<=77) return 'Nieve 🌨️'; if(code>=80&&code<=82) return 'Chubascos 🌦️';
  if(code===85||code===86) return 'Chubascos de nieve 🌨️'; if(code>=95) return 'Tormenta ⛈️';
  return 'Variable 🌤️';
}
async function fetchPlace(a){
  const ctl = new AbortController(); const to = setTimeout(()=>ctl.abort(), 6000);
  try{
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${a.lat}&longitude=${a.lon}&current=temperature_2m,weather_code,is_day,wind_speed_10m,wind_direction_10m&timezone=auto`;
    const r = await fetch(u, { signal:ctl.signal }); const j = await r.json();
    const w = { dir:Math.round(j.current.wind_direction_10m), spd:Math.round(j.current.wind_speed_10m), t:Date.now() };
    if(a.iata) WIND[a.iata] = w;
    return { off:j.utc_offset_seconds, tz:j.timezone, t:Math.round(j.current.temperature_2m), sky:wmo(j.current.weather_code, j.current.is_day), wind:w.spd, wdir:w.dir };
  }catch(e){ return null; } finally{ clearTimeout(to); }
}
async function enrichFlight(f){
  const [o,d] = await Promise.all([fetchPlace(AP[f.from]), fetchPlace(AP[f.to])]);
  if(!flight || flight.id!==f.id) return;
  if(o){ f.tzO=o.off; }
  if(d){ f.tzD=d.off; f.tzName=d.tz; f.meteo={ t:d.t, sky:d.sky, wind:d.wind, wdir:d.wdir, live:true }; }
  saveFlight();
  if($('mPass').classList.contains('open') && $('bpCard')) $('bpHolder').innerHTML = passHTML(f);
}

/* viento para elegir pistas: se pide al elegir origen/destino (caché 20 min) */
const windPending = new Set();
async function ensureWind(codes){
  const need = codes.filter(c => c && AP[c] && RUNWAYS[c]?.rw?.length && !(WIND[c] && Date.now()-WIND[c].t < 20*60000) && !windPending.has(c));
  if(!need.length) return;
  need.forEach(c => windPending.add(c));
  await Promise.all(need.map(c => fetchPlace(AP[c])));
  need.forEach(c => windPending.delete(c));
  if(!(flight && flight.start)){ planCache=null; renderPlan(); drawRoute(false); }
}
let planCache=null;
function planRoute(){
  if(!S.dest || !AP[S.origin] || !AP[S.dest]) return null;
  const key=[S.origin,S.dest,S.ac,S.routeMode,JSON.stringify(WIND[S.origin]||0),JSON.stringify(WIND[S.dest]||0)].join('|');
  if(planCache && planCache.key===key) return planCache.r;
  const r = buildRoute(S.origin, S.dest, ACF[S.ac], S.routeMode);
  planCache = { key, r }; return r;
}
function activeRoute(){
  if(flight && flight.start){
    if(!flight._route) flight._route = flight.route ? unpackRoute(flight.route) : buildRoute(flight.from, flight.to, acOf(flight), 'direct');
    return flight._route;
  }
  return planRoute();
}
const windTxt = w => w ? (w.spd < 6 ? 'viento en calma' : `viento ${String(w.dir).padStart(3,'0')}° a ${w.spd} km/h`) : '';

/* =================== MAPA =================== */
let map, airportLayer, routeLayer, historyLayer, nightLayer, planeMarker, flownLine, flownGlow, routeA, routeB;
const hasLeaflet = typeof L !== 'undefined';
function initMap(){
  if(!hasLeaflet){ $('map').innerHTML='<div style="display:grid;place-items:center;height:100%;color:#777">Mapa no disponible sin conexión</div>'; return; }
  map = L.map('map', { zoomControl:false, worldCopyJump:true, minZoom:2, attributionControl:true }).setView([40,-3], 4);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { attribution:'Tiles &copy; Esri', maxZoom:13 }).addTo(map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', { maxZoom:13, opacity:.75 }).addTo(map);
  L.control.zoom({ position:'bottomright' }).addTo(map);
  nightLayer = L.layerGroup().addTo(map);
  historyLayer = L.layerGroup().addTo(map);
  airportLayer = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);
  AIRPORTS.forEach(addApMarker);
  map.on('click', onMapClick);
  map.on('dragstart', () => { if(follow){ follow=false; $('bFollow').classList.remove('on'); } });
  drawNight(); setInterval(drawNight, 5*60000);
}
const apMarkers = {};
function addApMarker(a){
  const t = AP_TYPES[a.type];
  const m = L.circleMarker([a.lat,a.lon], { radius:t.r, color:t.color, weight:a.custom?2:1, fillColor:t.color, fillOpacity:.6, opacity:.8, bubblingMouseEvents:false });
  m.bindPopup(`<div style="font-weight:700">${flag(a.cc)} ${t.icon} <span style="font-family:var(--mono);color:var(--gold2)">${a.iata}</span> · ${a.city}</div><div style="color:var(--muted);font-size:11.5px">${a.name}${a.note?'<br>'+a.note:''}<br><i>${t.label}${heliOnly(a)?' · solo helicópteros':''}</i></div><div class="pop-btns"><button onclick="pickAirport('origin','${a.iata}')">Salir de aquí</button><button onclick="pickAirport('dest','${a.iata}')">Volar aquí</button></div>${a.custom?`<div class="pop-btns"><button onclick="removeCustom('${a.iata}')" style="color:var(--red)">Borrar este punto</button></div>`:''}`);
  airportLayer.addLayer(m); apMarkers[a.iata]=m;
}
/* --- clic libre en el mapa --- */
function onMapClick(e){
  if(flight && flight.start) return;
  const ll = e.latlng.wrap(), lat=+ll.lat.toFixed(4), lon=+ll.lng.toFixed(4);
  const heli = ACF[S.ac].kind==='heli';
  L.popup({ className:'free-pop' }).setLatLng(e.latlng).setContent(
    `<div style="font-weight:700">📍 Punto libre</div><div style="color:var(--muted);font-size:11.5px">${Math.abs(lat).toFixed(3)}°${lat>=0?'N':'S'} · ${Math.abs(lon).toFixed(3)}°${lon>=0?'E':'W'}<br>${heli?'Su helicóptero puede tomar tierra aquí.':'<b style="color:var(--gold2)">Solo en helicóptero:</b> se cambiará de aeronave.'}</div>
     <div class="pop-btns"><button onclick="pickFree('origin',${lat},${lon})">🚁 Despegar desde aquí</button><button onclick="pickFree('dest',${lat},${lon})">🚁 Aterrizar aquí</button></div>`
  ).openOn(map);
}
function nearestAp(lat,lon){ let best=null, bd=1e9; AIRPORTS.forEach(a => { if(a.custom) return; const d=distKm({lat,lon},a); if(d<bd){ bd=d; best=a; } }); return best; }
async function reverseGeocode(lat,lon){
  const ctl=new AbortController(); const to=setTimeout(()=>ctl.abort(),6000);
  try{
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14&accept-language=es`, { signal:ctl.signal });
    const j = await r.json(); if(!j) return null; if(j.error) return { sea:true };
    const ad = j.address || {};
    const place = ad.city || ad.town || ad.village || ad.hamlet || ad.municipality || ad.suburb || ad.county || ad.state;
    const spot = j.name && j.name!==place ? j.name : (ad.road || ad.neighbourhood || ad.natural || ad.peak || '');
    return { place, spot, cc:(ad.country_code||'').toUpperCase(), country:ad.country };
  }catch(e){ return null; } finally{ clearTimeout(to); }
}
window.pickFree = async function(key, lat, lon){
  if(map) map.closePopup();
  toast('📍 Localizando el punto…');
  const geo = await reverseGeocode(lat,lon);
  const near = nearestAp(lat,lon);
  const seq = LS.get('vp_cp_seq',0)+1; LS.set('vp_cp_seq',seq);
  const code = 'P' + String(seq % 1000).padStart(3,'0');
  const coordTxt = `${Math.abs(lat).toFixed(2)}°${lat>=0?'N':'S'} ${Math.abs(lon).toFixed(2)}°${lon>=0?'E':'W'}`;
  const c = {
    code,
    city: geo?.place || (geo?.sea ? `En el mar · ${coordTxt}` : `Punto ${coordTxt}`),
    name: geo?.spot ? `Punto libre · ${geo.spot}` : geo?.sea ? 'Toma sobre plataforma en el mar' : 'Punto libre de toma',
    cc: geo?.cc && geo.cc.length===2 ? geo.cc : near.cc,
    country: geo?.country || null, lat, lon,
  };
  // conserva solo los puntos usados en la bitácora o los 40 más recientes
  customPts = customPts.filter(p => p.code!==code);
  customPts.push(c);
  const used = new Set(log.flatMap(e => [e.from,e.to]).concat([S.origin,S.dest]));
  while(customPts.length > 40){ const i = customPts.findIndex(p => !used.has(p.code)); if(i<0) break; const old=customPts.splice(i,1)[0]; if(apMarkers[old.code]) airportLayer.removeLayer(apMarkers[old.code]); }
  LS.set('vp_custom', customPts);
  const a = indexCustom(c);
  if(map){ if(apMarkers[code]) airportLayer.removeLayer(apMarkers[code]); addApMarker(a); }
  pickAirport(key, code);
  toast(`📍 ${key==='origin'?'Despegue':'Aterrizaje'} en ${a.city}${COUNTRIES[a.cc]?', '+COUNTRIES[a.cc]:''}`);
};
window.removeCustom = function(code){
  if(map) map.closePopup();
  if(S.origin===code || S.dest===code){ toast('Ese punto está en su plan de vuelo actual'); return; }
  customPts = customPts.filter(p => p.code!==code); LS.set('vp_custom', customPts);
  if(apMarkers[code]) airportLayer.removeLayer(apMarkers[code]);
  if(!log.some(e => e.from===code || e.to===code)){ const i=AIRPORTS.findIndex(x=>x.iata===code); if(i>=0) AIRPORTS.splice(i,1); delete AP[code]; }
  toast('Punto borrado');
};

/* --- terminador día/noche --- */
function solarPos(date){
  const rad=Math.PI/180, jd=date/86400000+2440587.5, n=jd-2451545.0;
  const Lm=(280.460+0.9856474*n)%360, g=((357.528+0.9856003*n)%360)*rad;
  const lam=(Lm+1.915*Math.sin(g)+0.02*Math.sin(2*g))*rad, eps=(23.439-0.0000004*n)*rad;
  const alpha=Math.atan2(Math.cos(eps)*Math.sin(lam),Math.cos(lam))/rad, delta=Math.asin(Math.sin(eps)*Math.sin(lam))/rad;
  const gmst=((18.697374558+24.06570982441908*n)%24+24)%24;
  return { alpha, delta, gmst };
}
function nightRing(date, shift){
  const { alpha, delta, gmst } = solarPos(date), rad=Math.PI/180, pts=[];
  for(let lng=-180; lng<=180; lng+=2){
    const ha=gmst*15+lng-alpha;
    pts.push([Math.atan(-Math.cos(ha*rad)/Math.tan(delta*rad))/rad, lng+shift]);
  }
  const pole = delta<0 ? 85 : -85;
  return [[pole,-180+shift], ...pts, [pole,180+shift]];
}
function drawNight(){
  if(!map) return; nightLayer.clearLayers();
  const now=Date.now();
  [-360,0,360].forEach(sh => nightLayer.addLayer(L.polygon(nightRing(now,sh), { stroke:false, fillColor:'#000814', fillOpacity:.38, interactive:false })));
}
/* --- rutas voladas --- */
function drawHistory(){
  if(!map) return; historyLayer.clearLayers();
  if(flight && flight.start) return;
  const seen=new Set();
  log.forEach(e => {
    const k=e.from+'-'+e.to; if(seen.has(k) || !AP[e.from] || !AP[e.to]) return; seen.add(k);
    const [a,b]=routeLatLngs(AP[e.from],AP[e.to]);
    historyLayer.addLayer(L.polyline([a,b], { color:e.status==='ok'?'#d4af6a':'#ef7f7f', weight:1.4, opacity:.35, interactive:false }));
  });
}
function routeLatLngs(o,d){ let dl=d.lon; const diff=dl-o.lon; if(diff>180) dl-=360; else if(diff<-180) dl+=360; return [L.latLng(o.lat,o.lon), L.latLng(d.lat,dl)]; }
let routeLL=[], curSeg=-1;
/* avance real a lo largo de la ruta según la velocidad de cada fase (no lineal con el tiempo) */
const RP_N = 600;
function progressTable(){
  if(flight._rpt) return flight._rpt;
  const D = flight.durMs/60000;
  const pT = flight.rr ? flight.rr.t/D : phaseBounds(flight)[0];   // rodaje (o momento del desvío): desde aquí se recorre la ruta
  const base = flight.rr ? flight.rr.d : 0;
  const cum=[0]; let prev=Math.max(0, profileRaw(pT).spd);
  for(let k=1;k<=RP_N;k++){ const v=Math.max(0, profileRaw(pT+(1-pT)*k/RP_N).spd); cum.push(cum[k-1] + (prev+v)/2); prev=v; }
  return (flight._rpt = { pT, cum, tot: cum[RP_N] || 1, base });
}
function rp(p){
  if(!flight || !flight.start) return 0;
  const t = progressTable(), dist = flight.dist || 1, b0 = t.base/dist;
  if(p <= t.pT) return b0; if(p >= 1) return 1;
  const x=(p-t.pT)/(1-t.pT)*RP_N, i=Math.floor(x), f=x-i;
  return Math.min(1, b0 + (1-b0) * (t.cum[i] + ((t.cum[i+1]??t.cum[i]) - t.cum[i])*f) / t.tot);
}
function taxiInfo(p){   // fase de rodaje: de la plataforma al umbral de la pista
  if(!flight || !flight.start || routeLL.length < 2) return null;
  if(flight.rr) return null;
  const t = progressTable(); if(p >= t.pT) return null;
  const o = AP[flight.from], apron = L.latLng(o.lat, o.lon + 360*Math.round((routeLL[0].lng - o.lon)/360));
  const r = activeRoute(); if(!r || !r.dep) return { pos: routeLL[0], a: routeLL[0], b: routeLL[1] };
  const f = Math.min(1, p / t.pT), pa=map.project(apron,0), pb=map.project(routeLL[0],0);
  return { pos: map.unproject(pa.add(pb.subtract(pa).multiplyBy(f)),0), a: apron, b: routeLL[0] };
}
function posAt(p){
  const r=activeRoute(); if(!r || routeLL.length<2) return routeA;
  const tx = taxiInfo(p); if(tx) return tx.pos;
  const { i, f } = routeSegAt(r, rp(p));
  const pa=map.project(routeLL[i-1],0), pb=map.project(routeLL[i],0);
  return map.unproject(pa.add(pb.subtract(pa).multiplyBy(f)),0);
}
function apIcon(a,tag){ return L.divIcon({ className:'ap-label', iconSize:[0,0], html:`<div class="ap-pin ${isMilAp(a)?'mil':heliOnly(a)?'hp':''}"></div><div class="ap-tag"><small>${tag}</small><b>${a.iata}</b> · ${a.city}</div>` }); }
function vehicleHTML(kind, seg, A, B){
  seg = Math.max(1, Math.min(routeLL.length-1, seg||1));
  const pa=map.project(A||routeLL[seg-1],0), pb=map.project(B||routeLL[seg],0);
  const ang=Math.atan2(pb.y-pa.y,pb.x-pa.x)*180/Math.PI;
  if(kind==='heli'){ // 🚁 mira a la izquierda: se voltea si va hacia el este
    const east = pb.x >= pa.x;
    const tilt = Math.max(-25, Math.min(25, east ? ang : -(ang>0?180-ang:-180-ang)));
    return `<div style="transform:${east?'scaleX(-1) ':''}rotate(${east?-tilt:tilt}deg)">🚁</div>`;
  }
  return `<div style="transform:rotate(${ang+45}deg)">✈️</div>`; // ✈️ apunta al noreste
}
function wptIcon(p){
  const cls = p.kind==='vor' ? 'wp-vor' : p.kind==='gc' ? 'wp-gc' : p.kind==='cur' ? 'wp-cur' : 'wp-fix';
  const lbl = p.kind==='vor' || p.kind==='gc' ? p.name : p.kind==='faf' ? 'FAF' : p.kind==='star' ? 'IAF' : p.kind==='sid' ? 'SID' : p.kind==='cur' ? '🔀 DESVÍO' : '';
  return L.divIcon({ className:'wp', iconSize:[0,0], html:`<div class="${cls}"></div>${lbl?`<span>${lbl}</span>`:''}` });
}
function drawRunways(code, active){
  const ends = runwayEnds(code); if(!ends.length) return;
  const done = new Set();
  ends.forEach(e => {
    const k = [e.thr.lat.toFixed(4),e.far.lat.toFixed(4)].sort().join(); if(done.has(k)) return; done.add(k);
    const isAct = active && (active.id===e.id || ends.find(x=>x.id===active.id && x.thr.lat.toFixed(4)===e.far.lat.toFixed(4)));
    routeLayer.addLayer(L.polyline([[e.thr.lat,e.thr.lon],[e.far.lat,e.far.lon]], { color: isAct ? '#ffffff' : '#9a9282', weight: isAct ? 6 : 4, opacity: isAct ? .95 : .6, lineCap:'butt', interactive:false }));
  });
  if(active){
    const a = ends.find(x => x.id===active.id);
    if(a) routeLayer.addLayer(L.marker([a.thr.lat,a.thr.lon], { icon:L.divIcon({ className:'rw-lbl', iconSize:[0,0], html:`<span>${a.id}</span>` }), interactive:false }));
  }
}
function drawRoute(fit=true){
  if(!map) return;
  routeLayer.clearLayers(); planeMarker=null; flownLine=null; flownGlow=null;
  const o=AP[S.origin], d=AP[S.dest];
  drawHistory();
  if(!o) return;
  if(!d){ routeLayer.addLayer(L.marker([o.lat,o.lon],{icon:apIcon(o,'Origen')})); if(fit && mapReady()) { try{ map.flyTo([o.lat,o.lon],5,{duration:.8}); }catch(e){} } return; }
  const r = activeRoute();
  [routeA, routeB] = routeLatLngs(o,d);
  routeLL = r ? r.pts.map(q => L.latLng(q.lat, q.lon)) : [routeA, routeB];
  routeA = routeLL[0]; routeB = routeLL[routeLL.length-1]; curSeg = -1;
  routeLayer.addLayer(L.polyline(routeLL, { color:'#d4af6a', weight:2.2, opacity:.9, dashArray:'7 9' }));
  if(r){
    drawRunways(S.origin, r.dep); drawRunways(S.dest, r.arr);
    r.pts.forEach(q => { if(['vor','gc','faf','star','sid','cur'].includes(q.kind)) routeLayer.addLayer(L.marker([q.lat,q.lon], { icon:wptIcon(q), interactive:false })); });
  }
  flownGlow = L.polyline([routeA,routeA], { color:'#f1d9a4', weight:10, opacity:.18, lineCap:'round' });
  flownLine = L.polyline([routeA,routeA], { color:'#f1d9a4', weight:3.5, opacity:1 });
  routeLayer.addLayer(flownGlow); routeLayer.addLayer(flownLine);
  routeLayer.addLayer(L.marker([o.lat,o.lon],{icon:apIcon(o,'Origen')}));
  routeLayer.addLayer(L.marker([d.lat, d.lon + 360*Math.round((routeB.lng - d.lon)/360)],{icon:apIcon(d,'Destino')}));
  const kind = (flight && flight.start ? acOf(flight) : ACF[S.ac]).kind;
  const startLL = (r && r.dep) ? L.latLng(o.lat, o.lon + 360*Math.round((routeA.lng - o.lon)/360)) : routeA;
  planeMarker = L.marker(startLL, { zIndexOffset:1000, icon:L.divIcon({ className:'plane-icon', iconSize:[36,36], iconAnchor:[18,18], html:vehicleHTML(kind,1) }) });
  routeLayer.addLayer(planeMarker);
  if(fit) fitRoute();
}
function mapReady(){ const z = map && map.getSize(); return !!(z && z.x > 0 && z.y > 0); }
function fitRoute(){
  if(!map || !routeA || !mapReady()) return;
  const small = window.innerWidth < 820;
  const pd = flight && flight.start
    ? { paddingTopLeft:[40,small?200:140], paddingBottomRight:[40,small?300:230] }
    : { paddingTopLeft:[small?40:460,110], paddingBottomRight:[60,small?(window.innerHeight*.6):60] };
  try{ map.fitBounds(L.latLngBounds(routeLL.length ? routeLL : [routeA,routeB]), { ...pd, maxZoom:10 }); }catch(e){}
}
function updatePlane(p){
  if(!map || !planeMarker) return;
  const pos = posAt(p), r = activeRoute(), tx = taxiInfo(p);
  const seg = tx ? 0 : r ? routeSegAt(r, rp(p)).i : 1;
  if(seg !== curSeg){ curSeg = seg; const el = planeMarker.getElement(); const kind=(flight && flight.start ? acOf(flight) : ACF[S.ac]).kind; if(el) el.innerHTML = tx ? vehicleHTML(kind, 1, tx.a, tx.b) : vehicleHTML(kind, seg); }
  const flown = tx ? [pos] : routeLL.slice(0, seg).concat([pos]);
  planeMarker.setLatLng(pos); flownLine.setLatLngs(flown); flownGlow.setLatLngs(flown);
  if(follow && mapReady()) map.panTo(pos, { animate:true, duration:.8 });
}

/* =================== PLANIFICADOR =================== */
function setupCombo(inp, list, key){
  let active=-1, items=[];
  const render = () => {
    const q = norm(inp.value.trim());
    items = AIRPORTS.filter(a => !q || norm(`${a.iata} ${a.city} ${a.name} ${COUNTRIES[a.cc]||''} ${AP_TYPES[a.type].label} ${a.note}`).includes(q)).slice(0,60);
    list.innerHTML = items.map((a,i) => `<div class="opt${i===active?' active':''}" data-i="${a.iata}">${flag(a.cc)} <b>${a.iata}</b> <span>${typeIcon(a)} ${a.city}</span> <small>${a.name}</small></div>`).join('') || '<div class="opt" style="color:var(--muted)">Sin resultados</div>';
    list.hidden = false;
  };
  inp.addEventListener('focus', () => { inp.select(); active=-1; render(); });
  inp.addEventListener('input', () => { active=0; render(); });
  inp.addEventListener('keydown', e => {
    if(list.hidden) return;
    if(e.key==='ArrowDown'){ active=Math.min(items.length-1,active+1); render(); e.preventDefault(); }
    else if(e.key==='ArrowUp'){ active=Math.max(0,active-1); render(); e.preventDefault(); }
    else if(e.key==='Enter' && items[Math.max(0,active)]){ pickAirport(key, items[Math.max(0,active)].iata); inp.blur(); }
    else if(e.key==='Escape') inp.blur();
  });
  list.addEventListener('mousedown', e => { const o=e.target.closest('.opt[data-i]'); if(o){ e.preventDefault(); pickAirport(key,o.dataset.i); inp.blur(); } });
  inp.addEventListener('blur', () => setTimeout(() => { list.hidden=true; syncInputs(); }, 120));
}
function syncInputs(){
  const o=AP[S.origin], d=AP[S.dest];
  $('inOrigin').value = o ? `${o.iata} · ${o.city}` : '';
  $('inDest').value = d ? `${d.iata} · ${d.city}` : '';
}
window.pickAirport = function(key, iata){
  if(key==='divert'){ divertPreview(iata); return; }
  if(flight && flight.start) return;
  if(key==='origin' && iata===S.dest) S.dest=S.origin;
  if(key==='dest' && iata===S.origin){ toast('El destino debe ser distinto del origen'); return; }
  S[key]=iata;
  if(map) map.closePopup();
  ensureAircraft(); savePref(); syncInputs(); renderPlan(); drawRoute();
};
function ensureAircraft(){
  if(!S.dest) { if(heliOnly(AP[S.origin]) && ACF[S.ac].kind!=='heli'){ S.ac = AIRCRAFT.find(a=>a.kind==='heli' && !!a.mil===!!ACF[S.ac].mil)?.id || 'h145'; } return; }
  const o=AP[S.origin], d=AP[S.dest];
  if(!feasible(ACF[S.ac],o,d)){
    const b=bestAircraft(o,d,S.ac);
    if(b){ S.ac=b.id; toast(`${heliOnly(o)||heliOnly(d)?'Solo se puede llegar en helicóptero.':'Autonomía insuficiente.'} Asignamos un ${b.short}`); }
  }
}
function renderAircraftSelect(){
  const o=AP[S.origin], d=AP[S.dest];
  const groups=[...new Set(AIRCRAFT.map(a=>a.group))];
  $('selAc').innerHTML = groups.map(g => `<optgroup label="${g}">` + AIRCRAFT.filter(a=>a.group===g).map(a => {
    const ok = d ? feasible(a,o,d) : !(heliOnly(o) && a.kind!=='heli');
    const why = !ok ? ((heliOnly(o)||(d&&heliOnly(d))) && a.kind!=='heli' ? ' (no aterriza en helipuerto)' : ' (sin autonomía)') : '';
    return `<option value="${a.id}" ${a.id===S.ac?'selected':''} ${ok?'':'disabled'}>${a.kind==='heli'?'🚁':'✈️'} ${a.name} · ${fmtN(a.range)} km${why}</option>`;
  }).join('') + '</optgroup>').join('');
}
function renderPlan(){
  $('greet').innerHTML = `${greeting()}, <em>Comandante Supremo</em>.`;
  renderAircraftSelect();
  const o=AP[S.origin], d=AP[S.dest], ac=ACF[S.ac];
  if(!d){
    $('summary').innerHTML = `<div class="note" style="margin:0">Elija un destino en el buscador, toque un punto del mapa o pida una sugerencia según su tiempo de estudio.</div>`;
    $('btnBook').disabled = true;
  } else {
    const direct=distKm(o,d), r=planRoute(), dist=r?r.dist:direct, mins=flightMin(dist,ac), alt=cruiseAlt(direct,ac), stops=stopsFor(dist,ac);
    const blocks = Math.floor(mins/30);
    ensureWind([S.origin, S.dest]);
    $('summary').innerHTML = `
      <div class="sum-route">
        <div><div class="sum-iata">${o.iata}</div><div class="sum-city">${flag(o.cc)} ${typeIcon(o)} ${o.city}</div></div>
        <div class="sum-mid"><span>${ac.kind==='heli'?'🚁':'✈'}</span></div>
        <div style="text-align:right"><div class="sum-iata">${d.iata}</div><div class="sum-city">${d.city} ${typeIcon(d)} ${flag(d.cc)}</div></div>
      </div>
      <div class="stats">
        <div class="stat"><div class="k">Distancia</div><div class="v">${fmtN(dist)} km</div></div>
        <div class="stat"><div class="k">Tiempo vuelo</div><div class="v">${fmtHM(mins)}</div></div>
        <div class="stat"><div class="k">Crucero</div><div class="v">${ac.kind==='heli'?fmtN(alt)+' ft':'FL'+alt/100}</div></div>
      </div>
      <div class="note">${ac.name} a ${fmtN(ac.speed)} km/h${ac.unit?` · <b>${ac.unit}</b>`:''}.${stops?` <b>${stops} escala${stops>1?'s':''} técnica${stops>1?'s':''}</b> de repostaje incluida${stops>1?'s':''}.`:''} Llegada estimada a las <b>${fmtTime(Date.now()+mins*60000)}</b> si despega ahora${blocks?` · <b>${blocks} bloque${blocks>1?'s':''} de 25+5</b>`:''}.</div>
      ${r ? routeInfoHTML(r, direct) : ''}
      ${d.note?`<div class="note">${typeIcon(d)} ${d.note}</div>`:''}`;
    $('btnBook').disabled = false;
  }
  renderSuggestions();
}
function routeInfoHTML(r, direct){
  if(r.vfr) return `<div class="rt-box"><div class="rt-row"><span>🚁 Vuelo visual (VFR) directo</span></div></div>`;
  const wo=r.wind?.o, wd=r.wind?.d;
  return `<div class="rt-box">
    <div class="rt-row">${r.dep?`<span class="rw">🛫 Pista <b>${r.dep.id}</b><small>rumbo ${Math.round(r.dep.hdg)}°${wo?' · '+windTxt(wo):''}</small></span>`:`<span class="rw">🛫 Salida directa</span>`}
    ${r.arr?`<span class="rw">🛬 Pista <b>${r.arr.id}</b><small>rumbo ${Math.round(r.arr.hdg)}°${wd?' · '+windTxt(wd):''}</small></span>`:`<span class="rw">🛬 Llegada directa</span>`}</div>
    <div class="rt-str" title="${r.str}">${r.strShort}</div>
    <div class="rt-foot">${S.routeMode==='real'?`Ruta ${fmtN(r.dist)} km (directa ${fmtN(direct)} km) · ${r.pts.filter(p=>p.kind==='vor').length} radioayudas VOR`:'Ruta directa en línea recta'}${(!wo && r.dep) || (!wd && r.arr) ? ' · consultando viento real…' : ''}</div>
  </div>`;
}
function renderChips(){
  const opts=[25,45,60,90,120,180,240];
  $('chips').innerHTML = opts.map(m => `<button class="chip${S.study===m?' on':''}" data-m="${m}">${m<60?m+' min':(m/60)+' h'}</button>`).join('')
    + `<input class="chip-inp" id="studyCustom" type="number" min="5" max="1200" placeholder="min" value="${opts.includes(S.study)?'':S.study}">`;
  $('routeChips').innerHTML = [['real','🛣️ Aerovías reales'],['direct','➖ Línea recta']].map(([v,l]) => `<button class="chip${S.routeMode===v?' on':''}" data-r="${v}">${l}</button>`).join('');
  $('breakChips').innerHTML = [[0,'Sin descansos'],[25,'25 + 5 min'],[50,'50 + 10 min']].map(([v,l]) => `<button class="chip${S.breaks===v?' on':''}" data-b="${v}">${v?'☕ ':''}${l}</button>`).join('');
}
function renderSuggestions(){
  const o=AP[S.origin]; $('suggFrom').textContent = `${o.city} (${o.iata})`;
  const cur=ACF[S.ac];
  const list = AIRPORTS.filter(a => a.iata!==o.iata).map(a => {
    const ac = feasible(cur,o,a) ? cur : null;
    if(!ac) return null;
    const dist=distKm(o,a)*(S.routeMode==='real' && ac.kind!=='heli' ? 1.06 : 1); return { a, dist, mins:flightMin(dist,ac) };
  }).filter(Boolean).sort((x,y) => Math.abs(x.mins-S.study)-Math.abs(y.mins-S.study)).slice(0,6);
  $('sugg').innerHTML = list.length ? list.map(x => `<button class="sugg-item" data-i="${x.a.iata}"><span class="fl">${flag(x.a.cc)}</span><span class="nm">${typeIcon(x.a)} ${x.a.city}<small>${x.a.iata} · ${x.a.name} · ${fmtN(x.dist)} km</small></span><span class="tm">${fmtHM(x.mins)}</span></button>`).join('')
    : `<div class="note">Con el ${cur.short} no hay destinos alcanzables desde aquí. Pruebe otra aeronave.</div>`;
}

/* =================== VUELO =================== */
function createFlight(){
  const o=AP[S.origin], d=AP[S.dest], ac=ACF[S.ac];
  const route=planRoute(), direct=distKm(o,d), dist=route?route.dist:direct, mins=flightMin(dist,ac);
  const r = mulberry32((Date.now() ^ Math.floor(Math.random()*1e9)) >>> 0);
  const L3 = () => Array.from({length:3},()=>String.fromCharCode(65+Math.floor(r()*26))).join('');
  const baseT = 27 - Math.abs(d.lat)*0.38;
  const mil = !!ac.mil;
  return {
    id:'F'+Date.now(),
    flightNo: (mil?'AME ':'VP ') + (100+Math.floor(r()*9800)),
    callsign: 'SUPREMO ' + pad(1+Math.floor(r()*98)),
    reg: ac.reg ? ac.reg(r) : (ac.kind==='heli' ? 'EC-H' + L3().slice(0,2) : 'EC-' + L3()),
    from:o.iata, to:d.iata, ac:ac.id, dist, direct, mins, durMs:mins*60000, alt:cruiseAlt(direct,ac), stops:stopsFor(dist,ac),
    route: route ? packRoute(route) : null,
    crew: { captain:person(r), fo:person(r), fa:person(r,'F'), rk: mil ? { c:'Cte.', f:'Cap.', a:'Sgto.' } : null },
    catering:pick(r,CATERING), drink:pick(r,DRINKS), gate: mil||isMilAp(o) ? pick(r,GATES_MIL) : o.type==='cp' ? 'Zona de toma libre' : heliOnly(o) ? 'Plataforma del helipuerto' : pick(r,GATES),
    runway: route?.dep?.id || '', runwayArr: route?.arr?.id || '',
    meteo: { t:Math.round(baseT + (r()*8-4)), sky:pick(r,SKY), live:false },
    tzO:null, tzD:null,
    breakEvery:S.breaks, breakLen: S.breaks===25 ? 5 : 10,
    booked:Date.now(), start:null, pausedTotal:0, pausedAt:null, breakUntil:null, nextBreak:null,
    said:{}, nextMsg:0, msgs:[], msgIdx:Math.floor(r()*10),
  };
}
const elapsedMs = f => !f.start ? 0 : ((f.pausedAt || Date.now()) - f.start - f.pausedTotal);
function tierFor(hours){ let t=TIERS[0]; for(const x of TIERS) if(hours>=x.h) t=x; return t; }
function totals(){ const min=log.reduce((s,e)=>s+(e.studyMin||0),0); return { flights:log.length, hours:min/60, km:log.reduce((s,e)=>s+(e.km||0),0), dests:new Set(log.filter(e=>e.status==='ok').map(e=>e.to)).size }; }

function barcodeSVG(seed){
  const r=mulberry32(seed); let x=0, out='';
  while(x<196){ const w=1+Math.floor(r()*3.2); if(r()>.38) out+=`<rect x="${x}" y="0" width="${w}" height="58" fill="#1d1a14"/>`; x+=w+(r()>.6?1:0); }
  return `<svg viewBox="0 0 196 58" preserveAspectRatio="none">${out}</svg>`;
}
const LOGO_SVG = `<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="none" stroke="#d4af6a" stroke-width="2"/><path d="M14 36 L50 22 L46 28 L30 34 L26 44 L22 44 L24 35 Z" fill="#f1d9a4"/></svg>`;

function passHTML(f){
  const o=AP[f.from], d=AP[f.to], ac=acOf(f), mil=!!ac.mil, heli=ac.kind==='heli';
  const dep = f.start || f.booked, arr = dep + f.durMs;
  const tier = tierFor(totals().hours);
  const code = `${f.flightNo.replace(' ','')}${f.from}${f.to}${new Date(dep).getDate()}`;
  const rk = f.crew.rk || { c:'', f:'', a:'' };
  const terminal = isMilAp(o) ? 'Base militar' : o.type==='cp' ? 'Punto libre' : heliOnly(o) ? 'Helipuerto' : 'FBO Ejecutivo';
  const altTxt = heli ? fmtN(f.alt)+' ft' : 'FL'+(f.alt/100);
  return `<div class="bp${mil?' bp-mil':''}" id="bpCard">
   <div class="bp-main">
    <div class="bp-head">
      <div class="bp-brand">${LOGO_SVG}<div><div class="n">VUELO PRIVADO</div><div class="s">${mil?'REINO DE ESPAÑA · TRANSPORTE DE ESTADO':'PRIVATE AVIATION'}</div></div></div>
      <div class="bp-type">${heli?'TARJETA DE EMBARQUE · HELICÓPTERO':'TARJETA DE EMBARQUE'}<b>${mil?'STATE FLIGHT BOARDING PASS':'PRIVATE BOARDING PASS'}</b></div>
    </div>
    <div class="bp-body">
      <div class="bp-pax">
        <div><div class="bp-k">Pasajero · Passenger</div><div class="name">${PAX.name}</div><div class="alias">«${PAX.alias}» · CLUB ${tier.n.toUpperCase()}</div></div>
        <div class="bp-vip">${mil?'★ AUTORIDAD · MÁXIMA PRIORIDAD':'★ ÚNICO PASAJERO'}</div>
      </div>
      <div class="bp-route">
        <div><div class="bp-k">Desde</div><div class="iata">${o.iata}</div><div class="city">${o.city}, ${COUNTRIES[o.cc]}</div></div>
        <div class="bp-mid"><div class="ln"><span>${heli?'🚁':'✈'}</span></div><div class="d">${fmtN(f.dist)} km · ${fmtHM(f.mins)}${f.stops?` · ${f.stops} escala${f.stops>1?'s':''}`:''}</div></div>
        <div class="end"><div class="bp-k">Hacia</div><div class="iata">${d.iata}</div><div class="city">${d.city}, ${COUNTRIES[d.cc]}</div></div>
      </div>
      <div class="bp-grid">
        <div><div class="bp-k">Vuelo</div><div class="bp-v mono">${f.flightNo}</div></div>
        <div><div class="bp-k">Fecha</div><div class="bp-v mono">${fmtDate(dep)}</div></div>
        <div><div class="bp-k">Salida (local)</div><div class="bp-v mono">${fmtTimeTZ(dep,f.tzO)}</div></div>
        <div><div class="bp-k">Llegada (local)</div><div class="bp-v mono">${fmtTimeTZ(arr,f.tzD)} <small style="font-size:9px;color:#8a7f69">${fmtUTC(f.tzD)}</small></div></div>
        <div><div class="bp-k">Terminal</div><div class="bp-v">${terminal}</div></div>
        <div><div class="bp-k">Puerta</div><div class="bp-v">${f.gate}</div></div>
        <div><div class="bp-k">Asiento</div><div class="bp-v">Toda la cabina</div></div>
        <div><div class="bp-k">Clase</div><div class="bp-v">${mil?'Estado · VIP':'Privado · VIP'}</div></div>
        <div><div class="bp-k">${heli?'Helicóptero':'Aeronave'}</div><div class="bp-v">${ac.short}</div></div>
        <div><div class="bp-k">${mil?'Matrícula militar':'Matrícula'}</div><div class="bp-v mono" style="font-size:12.5px">${f.reg}</div></div>
        <div><div class="bp-k">Indicativo</div><div class="bp-v mono">${f.callsign}</div></div>
        <div><div class="bp-k">${heli?'Altitud crucero':'Nivel crucero'}</div><div class="bp-v mono">${altTxt}</div></div>
      </div>
      ${f.route ? `<div class="bp-plan">${f.route.dep?`<span><i>PISTA SALIDA</i><b>${f.route.dep.id}</b></span>`:''}${f.route.arr?`<span><i>PISTA LLEGADA</i><b>${f.route.arr.id}</b></span>`:''}<span class="pl"><i>${f.route.vfr?'PLAN DE VUELO VFR':'PLAN DE VUELO'}</i><b>${f.route.strShort||f.route.str}</b></span></div>` : ''}
      ${mil?`<div class="bp-unit">🎖️ ${ac.unit} · ${ac.cat}</div>`:''}
      <div class="bp-crew">
        <div><div class="bp-k">Comandante</div><div class="bp-v">${rk.c?rk.c+' ':''}${f.crew.captain}</div></div>
        <div><div class="bp-k">${heli?'Copiloto':'Primer oficial'}</div><div class="bp-v">${rk.f?rk.f+' ':''}${f.crew.fo}</div></div>
        <div><div class="bp-k">Azafata · TCP</div><div class="bp-v">${rk.a?rk.a+' ':''}${f.crew.fa}</div></div>
      </div>
      <div class="bp-foot">
        <div>Catering a bordo: <b>${f.catering}</b>${f.divertedFrom?`<br>↪ <b>Desviado en vuelo</b> · destino previsto: ${f.divertedFrom}`:''}</div>
        <div style="text-align:right">Meteo en ${d.city}${f.meteo.live?' (en vivo)':'*'}: <b>${f.meteo.t}°C · ${f.meteo.sky}</b></div>
      </div>
    </div>
   </div>
   <div class="bp-stub">
     <div class="bp-stub-head">VUELO PRIVADO</div>
     <div class="bp-stub-body">
       <div><div class="bp-k">Pasajero</div><div class="bp-v" style="font-size:12.5px">G. CORBACHO MARTÍNEZ</div></div>
       <div class="r2" style="${(o.iata+d.iata).length>6?'font-size:23px':''}">${o.iata} → ${d.iata}</div>
       <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
         <div><div class="bp-k">Vuelo</div><div class="bp-v mono">${f.flightNo}</div></div>
         <div><div class="bp-k">Salida</div><div class="bp-v mono">${fmtTimeTZ(dep,f.tzO)}</div></div>
         <div><div class="bp-k">Asiento</div><div class="bp-v">1A ★</div></div>
         <div><div class="bp-k">Embarque</div><div class="bp-v">A su ritmo</div></div>
       </div>
       <div class="bp-bar">${barcodeSVG(hashStr(code))}<div class="code">${code}</div></div>
     </div>
   </div>
  </div>`;
}

function openModal(id){ $(id).classList.add('open'); }
function closeModal(id){ $(id).classList.remove('open'); }
document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if(e.target===m || e.target.hasAttribute('data-close')) { if(m.id!=='mConfirm') closeModal(m.id); } }));

function showPass(f, mode){
  $('bpHolder').innerHTML = passHTML(f);
  const acts = $('mPassActions');
  if(mode==='book'){
    $('mPassTitle').textContent = 'Tarjeta de embarque emitida';
    $('mPassSub').textContent = `${f.crew.captain} y su tripulación le esperan a pie de ${acOf(f).kind==='heli'?'helicóptero':'avión'}.`;
    acts.innerHTML = `<button class="btn btn-ghost" id="pCancel">Cancelar</button><button class="btn btn-ghost" id="pDl">⬇️ Descargar</button><button class="btn btn-gold" id="pBoard">${acOf(f).kind==='heli'?'🚁':'✈️'} Embarcar y despegar</button>`;
    $('pCancel').onclick = () => { closeModal('mPass'); flight=null; saveFlight(); };
    $('pBoard').onclick = () => { closeModal('mPass'); board(); };
  } else {
    $('mPassTitle').textContent = 'Tarjeta de embarque';
    $('mPassSub').textContent = `${f.flightNo} · ${AP[f.from]?.city} → ${AP[f.to]?.city}`;
    acts.innerHTML = `<button class="btn btn-ghost" data-close>Cerrar</button><button class="btn btn-gold" id="pDl">⬇️ Descargar</button>`;
  }
  $('pDl').onclick = () => downloadPass(f);
  openModal('mPass');
}
async function downloadPass(f){
  try{
    if(!window.html2canvas) await loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js');
    const el=$('bpCard'); el.style.setProperty('--notch','#f7f2e6');
    const c = await html2canvas(el, { backgroundColor:null, scale:2, useCORS:true });
    el.style.removeProperty('--notch');
    const a=document.createElement('a'); a.href=c.toDataURL('image/png'); a.download=`tarjeta-${f.flightNo.replace(' ','')}-${f.from}-${f.to}.png`; a.click();
    toast('Tarjeta descargada');
  }catch(e){ toast('No se pudo generar la imagen. Puede hacer captura de pantalla.'); }
}

/* =================== AUDIO =================== */
let actx=null, master=null, noise=null, ambTimer=null;
let vol = LS.get('vp_vol', 0.5);
function audio(){
  try{
    if(!actx){ actx=new (window.AudioContext||window.webkitAudioContext)(); master=actx.createGain(); master.gain.value=vol; master.connect(actx.destination); }
    if(actx.state==='suspended') actx.resume();
  }catch(e){}
  return actx;
}
function setVolume(v){ vol=v; LS.set('vp_vol',v); if(master) master.gain.setTargetAtTime(v, actx.currentTime, .15); }
function tone(fq, t0, dur, peak, type='sine'){
  const c=actx, o=c.createOscillator(), g=c.createGain();
  o.type=type; o.frequency.value=fq; const t=c.currentTime+t0;
  g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(peak,t+.015); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g).connect(master); o.start(t); o.stop(t+dur+.05);
}
function chime(){ if(!audio()) return; tone(659.25,0,1.6,.10); tone(523.25,.55,1.9,.10); }
const CABIN_SOUNDS = {
  seatbelt(){ tone(1046.5,0,2.2,.045); tone(2093,0,1.2,.008); },
  call(){ tone(1318.5,0,.9,.035); tone(1318.5,.35,1.1,.035); },
  lowDing(){ tone(587.3,0,2.4,.05); },
  interphone(){ tone(880,0,.35,.03); tone(880,.18,.35,.03); tone(880,.36,.5,.03); },
  click(){
    const c=actx, len=c.sampleRate*.06, buf=c.createBuffer(1,len,c.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3);
    const src=c.createBufferSource(); src.buffer=buf; const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=1800; const g=c.createGain(); g.gain.value=.06;
    src.connect(bp).connect(g).connect(master); src.start();
  },
  radio(){ // ráfaga corta de radio (helicóptero)
    const c=actx, len=c.sampleRate*.5, buf=c.createBuffer(1,len,c.sampleRate), d=buf.getChannelData(0);
    for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*(i<len*.08?i/(len*.08):1)*(1-i/len);
    const src=c.createBufferSource(); src.buffer=buf; const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=2200; bp.Q.value=3; const g=c.createGain(); g.gain.value=.03;
    src.connect(bp).connect(g).connect(master); src.start(); setTimeout(()=>CABIN_SOUNDS.click(), 520);
  },
};
let noiseKind='jet';
function scheduleAmbient(){
  clearTimeout(ambTimer);
  ambTimer = setTimeout(() => {
    if(noise && actx && actx.state==='running' && !(flight && flight.pausedAt)){
      const keys = noiseKind==='heli' ? ['radio','click','interphone','radio'] : ['seatbelt','call','lowDing','interphone','click','seatbelt','lowDing'];
      CABIN_SOUNDS[keys[Math.floor(Math.random()*keys.length)]]();
    }
    scheduleAmbient();
  }, (75 + Math.random()*165) * 1000);
}
function brownBuffer(c, secs){
  const len=c.sampleRate*secs, buf=c.createBuffer(2,len,c.sampleRate);
  for(let ch=0;ch<2;ch++){ const d=buf.getChannelData(ch); let last=0; for(let i=0;i<len;i++){ const w=Math.random()*2-1; last=(last+0.02*w)/1.02; d[i]=last*3.2; } }
  return buf;
}
function buildJetSound(c, out){
  const buf=brownBuffer(c,8), nodes=[];
  const src=c.createBufferSource(); src.buffer=buf; src.loop=true;
  const lp=c.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=420; lp.Q.value=.4;
  const airG=c.createGain(); airG.gain.value=.55;
  const lfo=c.createOscillator(), lfoG=c.createGain(); lfo.frequency.value=.05; lfoG.gain.value=90; lfo.connect(lfoG).connect(lp.frequency);
  src.connect(lp).connect(airG).connect(out);
  const hum=c.createBiquadFilter(); hum.type='lowpass'; hum.frequency.value=160;
  const humG=c.createGain(); humG.gain.value=.05;
  const o1=c.createOscillator(), o2=c.createOscillator(), o3=c.createOscillator(), o3g=c.createGain();
  o1.type='sawtooth'; o1.frequency.value=72; o2.type='sawtooth'; o2.frequency.value=72.6; o3.type='sine'; o3.frequency.value=144.3; o3g.gain.value=.4;
  o1.connect(hum); o2.connect(hum); o3.connect(o3g).connect(hum); hum.connect(humG).connect(out);
  const src2=c.createBufferSource(); src2.buffer=buf; src2.loop=true; src2.playbackRate.value=1.7;
  const bp=c.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=2400; bp.Q.value=.6;
  const hissG=c.createGain(); hissG.gain.value=.012;
  src2.connect(bp).connect(hissG).connect(out);
  nodes.push(src,src2,lfo,o1,o2,o3); nodes.forEach(n=>n.start()); return nodes;
}
function buildHeliSound(c, out){
  const nodes=[];
  // palas del rotor: ciclo de "golpes" a ~5,6 Hz
  const per=1/5.6, n=Math.floor(c.sampleRate*per*4), rb=c.createBuffer(1,n,c.sampleRate), d=rb.getChannelData(0);
  let last=0;
  for(let i=0;i<n;i++){
    const t=(i/c.sampleRate)%per, env=Math.exp(-t/0.04)*0.95+0.10;
    const w=Math.random()*2-1; last=(last+0.06*w)/1.06; d[i]=last*7*env;
  }
  const rotor=c.createBufferSource(); rotor.buffer=rb; rotor.loop=true;
  const rlp=c.createBiquadFilter(); rlp.type='lowpass'; rlp.frequency.value=320;
  const rG=c.createGain(); rG.gain.value=.55;
  const wob=c.createOscillator(), wobG=c.createGain(); wob.frequency.value=.07; wobG.gain.value=.012; wob.connect(wobG).connect(rotor.playbackRate);
  rotor.connect(rlp).connect(rG).connect(out);
  // rumor de cabina
  const buf=brownBuffer(c,6), air=c.createBufferSource(); air.buffer=buf; air.loop=true;
  const alp=c.createBiquadFilter(); alp.type='lowpass'; alp.frequency.value=380; const aG=c.createGain(); aG.gain.value=.35;
  air.connect(alp).connect(aG).connect(out);
  // silbido de la turbina
  const t1=c.createOscillator(), t2=c.createOscillator(), tG=c.createGain(); t1.frequency.value=1870; t2.frequency.value=3745; tG.gain.value=.0045;
  const vib=c.createOscillator(), vibG=c.createGain(); vib.frequency.value=.3; vibG.gain.value=6; vib.connect(vibG).connect(t1.frequency);
  t1.connect(tG); t2.connect(tG); tG.connect(out);
  nodes.push(rotor,wob,air,t1,t2,vib); nodes.forEach(x=>x.start()); return nodes;
}
function setNoise(on, persist=true){
  const c=audio(); if(!c) return;
  const btn=$('bNoise');
  if(!on){
    if(noise){ const n=noise; n.g.gain.setTargetAtTime(0,c.currentTime,.6); setTimeout(()=>{ n.nodes.forEach(x=>{ try{x.stop();}catch(e){} }); },2500); noise=null; }
    clearTimeout(ambTimer);
    btn.classList.remove('on'); btn.textContent='🔈 Sonido de cabina'; if(persist) LS.set('vp_noise',false); return;
  }
  if(noise) return;
  noiseKind = flight ? acOf(flight).kind : ACF[S.ac].kind;
  const g=c.createGain(); g.gain.value=0; g.connect(master);
  const nodes = noiseKind==='heli' ? buildHeliSound(c,g) : buildJetSound(c,g);
  g.gain.setTargetAtTime(.9,c.currentTime,1.5);
  noise={ g, nodes }; scheduleAmbient();
  btn.classList.add('on'); btn.textContent='🔊 Sonido de cabina'; if(persist) LS.set('vp_noise',true);
}
document.addEventListener('pointerdown', () => { if(flight && flight.start && !noise && LS.get('vp_noise',true)) setNoise(true); else audio(); }, { once:true });

/* =================== MEGAFONÍA =================== */
function say(who, text, sound=true){
  if(!flight) return;
  const heli = acOf(flight).kind==='heli';
  const roles = { cap:['Comandante',flight.crew.captain], fo:[heli?'Copiloto':'Primer oficial',flight.crew.fo], fa:['Azafata',flight.crew.fa] };
  const [role,name] = roles[who];
  flight.msgs.unshift({ who:`${role} ${name.split(' ')[0]}`, text, t:Date.now() });
  flight.msgs = flight.msgs.slice(0,6);
  saveFlight(); renderPA();
  if(sound) chime();
}
function renderPA(){ if(!flight) return; $('paList').innerHTML = flight.msgs.slice(0,4).map(m => `<div class="msg"><div class="who">${m.who}<span>${fmtTime(m.t)}</span></div>${m.text}</div>`).join(''); }
function phaseIdx(p, f){ return phasesOf(f).findIndex(x => p < x.to); }
function announcements(p, el){
  const f=flight, d=AP[f.to], o=AP[f.from], ac=acOf(f), s=f.said, heli=ac.kind==='heli', mil=!!ac.mil;
  const once = (k, fn) => { if(!s[k]){ s[k]=1; fn(); } };
  const pi = phaseIdx(p,f);
  const veh = heli ? 'helicóptero' : 'avión';
  if(pi>=0) once('p0', () => say('cap', `Buenas, Comandante Supremo. Le habla ${f.crew.captain}, su comandante. Junto a ${f.crew.fo} y ${f.crew.fa} le damos la bienvenida a bordo de este ${ac.name}${mil?`, del ${ac.unit}`:''}. ${f.flightNo} a ${d.city}: ${fmtHM(f.mins)} de concentración por delante.`));
  if(pi>=1) once('p1', () => say('fo', heli ? `Rotores en régimen. ${isMilAp(o)?'Control de la base':'Torre'} nos autoriza el despegue. Allá vamos, Comandante Supremo.` : (f.runway ? `Torre de ${o.city} nos autoriza a despegar por la pista ${f.runway}${f.route?.wind?.o ? ', ' + windTxt(f.route.wind.o) : ''}. Potencia de despegue… allá vamos.` : `${o.city}: despegue autorizado. Potencia de despegue… allá vamos.`)));
  if(pi>=2) once('p2', () => say('fa', `Comandante Supremo, en cuanto nos estabilicemos le sirvo ${f.drink}. Ponga el móvil en modo avión, que aquí se viene a estudiar.`));
  if(pi>=3) once('p3', () => say('cap', heli ? `Volamos a ${fmtN(f.alt)} pies sobre el terreno. Vuelo tranquilo: momento perfecto para concentrarse.` : `Hemos alcanzado nuestro nivel de crucero, FL${f.alt/100}. Cielo tranquilo: momento perfecto para concentrarse.`));
  if(p>=.5) once('half', () => say('cap', `Hemos superado la mitad del trayecto. Lleva ${fmtHM(el/60000)} de estudio; quedan ${fmtHM((f.durMs-el)/60000)}. Excelente ritmo.`));
  if(f.stops && p>=.45) once('stop', () => say('fo', `Escala técnica de repostaje completada. Seguimos rumbo a ${d.city}.`));
  if(pi>=4) once('p4', () => say('cap', `Iniciamos el descenso hacia ${d.city}${f.runwayArr?`; control nos asigna la pista ${f.runwayArr}`:''}. En destino ${f.meteo.t}°C, ${f.meteo.sky.toLowerCase()}${f.tzD!=null?`, hora local ${fmtTimeTZ(Date.now()+(f.durMs-el),f.tzD)} a la llegada`:''}. Vaya cerrando sus apuntes.`));
  if(pi>=5) once('p5', () => say('fo', heli ? `Aproximación final a ${d.iata}. ${heliOnly(d)?'Helipuerto a la vista.':'Zona de toma despejada.'}` : (f.runwayArr ? `Establecidos en la final de la pista ${f.runwayArr} de ${d.city}. Tren abajo y blocado, pista a la vista.` : `Tren abajo y blocado. Aproximación final a ${d.iata}, pista a la vista.`)));
  // paso por radioayudas
  const rt = activeRoute();
  if(rt && !rt.vfr && pi>=2 && pi<=4 && !f.dnd){
    const seg = routeSegAt(rt, rp(p)).i, prev = rt.pts[seg-1];
    if(prev && (prev.kind==='vor' || prev.kind==='gc') && f.lastWpt !== seg-1 && el - (f.lastWptMsg||0) > 180000){
      f.lastWpt = seg-1; f.lastWptMsg = el;
      const nx = nextWaypoint(rt, rp(p));
      const what = prev.kind==='vor' ? `el ${prev.label.split(' ')[0]} de ${prev.label.split(' ').slice(1).join(' ')} (${prev.name})` : `el punto ${prev.name}`;
      say('fo', `Sobrevolando ${what}.${nx && nx.pt.name ? ` Próximo punto: ${nx.pt.kind==='faf'||nx.pt.kind==='star'?'inicio de la aproximación':nx.pt.name}, a ${fmtN(nx.km)} km.` : ''}`, false);
    }
  }
  const every = Math.min(25, Math.max(8, f.mins/6)) * 60000;
  if(pi===3){
    if(!f.nextMsg) f.nextMsg = el + every;
    if(el >= f.nextMsg && f.dnd){ f.nextMsg = el + every; }
    else if(el >= f.nextMsg){
      f.nextMsg = el + every;
      const pool = [
        ['fa', `Le traigo ${f.catering}. Coma algo, el cerebro también necesita combustible.`],
        ['fa', `¿Más agua, Comandante Supremo? La hidratación también cuenta como estudio.`],
        ['fo', `Viento de cola favorable. Usted mantenga el rumbo en sus apuntes.`],
        ['cap', `Todo en orden en cabina. Llevamos ${fmtHM(el/60000)} de ${veh} sin una sola distracción. Siga así.`],
        ['fa', `Si necesita estirar las piernas, la cabina es toda suya. Treinta segundos y de vuelta al asiento.`],
        ['fo', `Control nos autoriza ruta directa. Ni una distracción en el radar.`],
        ['fa', `Le he dejado ${pick(Math.random,DRINKS)} en la mesa auxiliar. Va de maravilla.`],
        ['cap', `Recuerde: cada minuto de vuelo es un minuto de estudio. Nos quedan ${fmtHM((f.durMs-el)/60000)}.`],
      ];
      const [w,t] = pool[(f.msgIdx++) % pool.length]; say(w,t);
    }
  }
}

/* =================== CICLO DE VUELO =================== */
let wakeLock=null;
async function keepAwake(){ try{ if('wakeLock' in navigator && flight && flight.start && !flight.pausedAt) wakeLock = await navigator.wakeLock.request('screen'); }catch(e){} }
document.addEventListener('visibilitychange', () => { if(document.visibilityState==='visible') keepAwake(); });

function book(){
  if(!S.dest) return;
  flight = createFlight(); saveFlight();
  showPass(flight,'book');
  enrichFlight(flight);
}
function board(){
  if(!flight) return;
  Object.assign(flight, { start:Date.now(), pausedTotal:0, pausedAt:null, breakUntil:null, said:{}, msgs:[], nextMsg:0 });
  flight.nextBreak = flight.breakEvery ? flight.breakEvery*60000 : null;
  saveFlight(); audio();
  if(noise) setNoise(false,false);
  if(LS.get('vp_noise',true)) setNoise(true);
  try{ if('Notification' in window && Notification.permission==='default') Notification.requestPermission(); }catch(e){}
  enterFlightMode();
}
function enterFlightMode(){
  S.origin=flight.from; S.dest=flight.to; S.ac=flight.ac;
  document.body.classList.add('flying');
  if(map){ map.removeLayer(airportLayer); historyLayer.clearLayers(); }
  const o=AP[flight.from], d=AP[flight.to], ac=acOf(flight), heli=ac.kind==='heli';
  $('hRoute').textContent = `${o.iata} ${heli?'🚁':'✈'} ${d.iata}`;
  $('hCities').textContent = `${o.city} → ${d.city}`;
  $('pFrom').textContent = `${o.iata} · ${fmtTime(flight.start)}`;
  $('pPlane').textContent = heli ? '🚁' : '✈️';
  $('pPlane').style.transform = heli ? 'translate(-50%,-55%) scaleX(-1)' : 'translate(-50%,-55%)';
  const rk = flight.crew.rk || { c:'Cmdte.', f:heli?'Copiloto':'1.er Of.', a:'TCP' };
  $('crewline').innerHTML = `${ac.name} <b>${flight.reg}</b> · ${rk.c} <b>${flight.crew.captain}</b> · ${rk.f} <b>${flight.crew.fo}</b> · ${rk.a} <b>${flight.crew.fa}</b>`;
  drawRoute(false); fitRoute(); renderPA(); keepAwake(); tick(true);
  if(window.VPV) VPV.enter();
}
function exitFlightMode(){
  if(window.VPV) VPV.exit();
  document.body.classList.remove('flying');
  if(map && !map.hasLayer(airportLayer)) airportLayer.addTo(map);
  follow=false; $('bFollow').classList.remove('on');
  if(wakeLock){ try{ wakeLock.release(); }catch(e){} wakeLock=null; }
  setNoise(false,false);
  document.title = 'Vuelo Privado · Temporizador de estudio';
}
function resumeFlight(){
  flight.pausedTotal += Date.now()-flight.pausedAt; flight.pausedAt=null; flight.breakUntil=null; keepAwake();
}
function togglePause(){
  if(!flight || !flight.start) return;
  if(flight.pausedAt){
    const wasBreak = !!flight.breakUntil;
    resumeFlight();
    say('cap', wasBreak ? 'Fin del descanso. Volvemos a la ruta, Comandante Supremo: concentración máxima.' : 'Salimos del circuito de espera. Reanudamos la ruta, Comandante Supremo.');
  } else { flight.pausedAt=Date.now(); say('cap','Control nos pone en circuito de espera. Tómese un respiro; reanudamos cuando usted diga.'); }
  saveFlight(); tick(true);
}
function startBreak(){
  flight.pausedAt=Date.now(); flight.breakUntil=Date.now()+flight.breakLen*60000;
  flight.nextBreak += flight.breakEvery*60000;
  say('fa', `Comandante Supremo, toca descanso: ${flight.breakLen} minutos. Levántese, estire las piernas y beba agua. Le aviso al terminar.`);
  CABIN_SOUNDS.seatbelt && actx && CABIN_SOUNDS.seatbelt();
  saveFlight();
}
function addLog(status){
  const f=flight, el=elapsedMs(f), p=Math.min(1,el/f.durMs);
  const entry = { id:f.id, flightNo:f.flightNo, from:f.from, to:f.to, ac:f.ac, km:Math.round(f.dist*rp(p)), dist:f.dist, mins:f.mins, studyMin:Math.round(el/60000*10)/10, date:f.start, status, f:Object.fromEntries(Object.entries({...f, msgs:[], said:{}}).filter(([k]) => k[0] !== '_')) };
  log.unshift(entry); saveLog(); updateTier();
  return entry;
}
function land(){
  const f=flight, d=AP[f.to]; const tierBefore=tierFor(totals().hours).n;
  const newCountry = !log.some(e => e.status==='ok' && AP[e.to]?.cc===d.cc);
  say('cap', `Bienvenido a ${d.city}, Comandante Supremo. Ha sido un honor ${acOf(f).kind==='heli'?'llevarle':'volar con usted'}.`);
  const e = addLog('ok');
  const tierNow = tierFor(totals().hours);
  try{ if('Notification' in window && Notification.permission==='granted') new Notification('🛬 Llegada a ' + d.city, { body:`${f.flightNo} completado: ${fmtHM(e.studyMin)} de estudio.`, icon:'icon.svg' }); }catch(err){}
  $('landTitle').textContent = `Bienvenido a ${d.city}`;
  $('landSub').innerHTML = `${f.flightNo} completado, Comandante Supremo.${f.tzD!=null?` Hora local: <b>${fmtTimeTZ(Date.now(),f.tzD)}</b> (${fmtUTC(f.tzD)}).`:''}`
    + (newCountry?`<br><b style="color:var(--gold2)">🛂 Nuevo sello en su pasaporte: ${flag(d.cc)} ${COUNTRIES[d.cc]}</b>`:'')
    + (tierBefore!==tierNow.n?`<br><b style="color:var(--gold2)">¡Ascenso al Club ${tierNow.n}!</b>`:'');
  const t=totals();
  $('landStats').innerHTML = [
    ['Tiempo estudiado', fmtHM(e.studyMin)], ['Distancia', fmtN(f.dist)+' km'], [acOf(f).kind==='heli'?'Helicóptero':'Aeronave', acOf(f).short],
    ['Meteo', `${f.meteo.t}°C ${f.meteo.sky.split(' ').pop()}`], ['Total horas', t.hours.toFixed(1)+' h'], ['Club', tierNow.n],
  ].map(([k,v]) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
  $('landNext').textContent = `✈️ Nuevo vuelo desde ${d.city}`;
  flight=null; saveFlight();
  S.origin=e.to; S.dest=null; ensureAircraft(); savePref();
  exitFlightMode(); syncInputs(); renderPlan(); drawRoute(true);
  openModal('mLand');
}
async function abort(){
  const ok = await confirmBox('¿Terminar el vuelo aquí?', 'El tiempo estudiado hasta ahora se guardará en su bitácora como vuelo interrumpido.', 'Terminar');
  if(!ok || !flight) return;
  const f=flight; addLog('ko');
  flight=null; saveFlight();
  S.origin=f.from; S.dest=f.to;
  exitFlightMode(); syncInputs(); renderPlan(); drawRoute(true);
  toast('Vuelo interrumpido. Registrado en la bitácora.');
}
async function quitFlight(){
  const ok = await confirmBox('¿Salir del vuelo?', 'Se abandona el vuelo sin guardarlo en la bitácora ni contar el tiempo. Útil si se ha equivocado de destino o aeronave.', 'Salir');
  if(!ok || !flight) return;
  const f=flight; flight=null; saveFlight();
  S.origin=f.from; S.dest=f.to; S.ac=f.ac; savePref();
  exitFlightMode(); syncInputs(); renderPlan(); drawRoute(true);
  toast('Vuelo cancelado. Puede corregir el plan y volver a despegar.');
}
function profile(p){
  const r = profileRaw(p);
  if(p > .5 && flight){ // senda de planeo: 3° en jets, ~8° en helicópteros
    const remM = flight.dist*1000*(1-rp(p)), ac = acOf(flight);
    const heli = ac.kind==='heli', cap = remM * (heli ? 0.14 : 0.0524) / 0.3048;
    const pb = phaseBounds(flight), pApp = heli ? pb[3] : pb[4];
    if(p >= pApp) r.alt = Math.max(0, Math.min(cap, profileRaw(pApp).alt));   // en final, sobre la senda
    else if(r.alt > cap) r.alt = Math.max(0, cap);
  }
  return r;
}
function profileRaw(p){ return profileRawF(flight, p); }
function profileRawF(f, p){
  const base = baseProfile(f, p);
  if(f.rr){   // tras cambiar de destino: transición suave de 6 min desde el estado real del avión
    const dt = p*f.durMs/60000 - f.rr.t;
    if(dt >= 0 && dt < 6){ const k=dt/6, e=k*k*(3-2*k); return { alt: f.rr.h + (base.alt-f.rr.h)*e, spd: f.rr.v + (base.spd-f.rr.v)*e }; }
  }
  return base;
}
function baseProfile(f, p){
  const ac=acOf(f), cr=f.alt, v=ac.speed, [b0,b1,b2,b3,b4]=phaseBounds(f);
  const T = (a,b) => Math.max(0, Math.min(1, (p-a)/(b-a)));
  if(ac.kind==='heli'){
    if(p<b0) return { alt:0, spd:0 };                                                   // arranque de rotores
    if(p<b1){ const t=T(b0,b1); return { alt:t*300, spd:t*60 }; }                      // despegue vertical
    if(p<b2){ const t=T(b1,b2); return { alt:300+t*(cr-300), spd:60+t*(v-60) }; }       // ascenso
    if(p<b3) return { alt:cr + Math.sin(Date.now()/7000)*40, spd:v + Math.sin(Date.now()/9000)*4 };
    if(p<b4){ const t=T(b3,b4); return { alt:cr-t*(cr-400), spd:v-t*(v-120) }; }       // descenso
    if(p<1){ const t=T(b4,1); return { alt:400*(1-t), spd:120*(1-t) }; }                // toma
    return { alt:0, spd:0 };
  }
  if(p<b0) return { alt:0, spd:25 };                                                     // rodaje
  if(p<b1){ const t=T(b0,b1);                                                            // carrera de despegue + ascenso inicial
    if(t<.35) return { alt:0, spd:40 + t/.35*250 };
    const u=(t-.35)/.65; return { alt:u*3000, spd:290+u*110 }; }
  if(p<b2){ const t=T(b1,b2); return { alt:3000+t*(cr-3000), spd:400+t*(v-400) }; }       // ascenso
  if(p<b3) return { alt:cr, spd:v + Math.sin(Date.now()/9000)*6 };                       // crucero
  if(p<b4){ const t=T(b3,b4); return { alt:cr-t*(cr-3000), spd:v-t*(v-330) }; }          // descenso
  if(p<1){ const t=T(b4,1); return { alt:3000*(1-t), spd:330-t*80 }; }                   // aproximación
  return { alt:0, spd:0 };
}
let lastMapUpd=0;
function tick(force){
  if(!flight || !flight.start) return;
  // fin automático del descanso
  if(flight.breakUntil && Date.now() >= flight.breakUntil){ resumeFlight(); say('cap','Fin del descanso. Volvemos a la ruta, Comandante Supremo: concentración máxima.'); saveFlight(); }
  const el=elapsedMs(flight), p=Math.min(1, el/flight.durMs), rem=flight.durMs-el;
  if(p>=1){ land(); return; }
  // descanso programado
  if(!flight.pausedAt && flight.breakEvery && flight.nextBreak && el >= flight.nextBreak){
    if(rem > 8*60000) startBreak(); else flight.nextBreak = Infinity;
  }
  const paused=!!flight.pausedAt, onBreak=!!flight.breakUntil;
  const PH=phasesOf(flight), pi=phaseIdx(p,flight), ph=PH[pi]||PH[PH.length-1], pr=profile(p), heli=acOf(flight).kind==='heli';
  $('hTimer').textContent = onBreak ? fmtClock(flight.breakUntil-Date.now()) : fmtClock(rem);
  $('hTimerLbl').textContent = onBreak ? '☕ Descanso · vuelve en' : paused ? 'En espera · pausado' : 'Tiempo restante';
  $('hud').classList.toggle('on-break', onBreak);
  $('hEl').textContent = fmtClock(el);
  const pbH = phaseBounds(flight);
  $('hAlt').textContent = paused && p>pbH[1] && p<pbH[4] ? 'Holding' : fmtN(pr.alt)+' ft';
  $('hSpd').textContent = fmtN(pr.spd)+' km/h';
  $('hKm').textContent = fmtN(flight.dist*(1-rp(p)))+' km';
  const rtH = activeRoute(), nx = rtH && !rtH.vfr ? nextWaypoint(rtH, rp(p)) : null;
  $('hPct').textContent = nx ? `${nx.pt.kind==='rwy' ? 'RWY '+nx.pt.name.split(' ').pop() : nx.pt.kind==='faf' ? 'FAF' : nx.pt.kind==='star' ? 'IAF' : nx.pt.kind==='sid' ? 'SID' : nx.pt.name} · ${fmtN(nx.km)} km` : (p*100).toFixed(1)+'%';
  const eta = Date.now()+rem;
  $('hEta').textContent = fmtTimeTZ(eta, flight.tzD) + (flight.tzD!=null?'*':'');
  $('hEta').title = flight.tzD!=null ? `Hora local en destino (${fmtUTC(flight.tzD)})` : '';
  $('pTo').textContent = `${AP[flight.to].iata} · ${fmtTime(eta)}`;
  $('pFill').style.width = (p*100)+'%';
  $('pPlane').style.left = (p*100)+'%';
  $('phase').classList.toggle('paused',paused);
  $('phaseTxt').textContent = onBreak ? '☕ Descanso programado' : paused ? '⏸ Circuito de espera' : `${ph.i} ${ph.n}`;
  $('phaseFn').textContent = `${flight.flightNo} · ${flight.callsign}`;
  $('bPause').textContent = onBreak ? '▶️ Terminar descanso' : paused ? '▶️ Reanudar' : '⏸ Pausar';
  document.title = `${onBreak?'☕':paused?'⏸':heli?'🚁':'✈️'} ${onBreak?fmtClock(flight.breakUntil-Date.now()):fmtClock(rem)} · ${flight.from}→${flight.to}`;
  if(force || Date.now()-lastMapUpd>1000){ lastMapUpd=Date.now(); updatePlane(p); }
  if(!paused) announcements(p, el);
}
setInterval(tick, 250);

/* =================== CAMBIO DE DESTINO EN VUELO =================== */
function flightState(){
  const el=elapsedMs(flight), p=Math.min(1, el/flight.durMs), pr=profile(p);
  return { el, p, tMin: el/60000, alt: pr.alt, spd: pr.spd, pb: phaseBounds(flight) };
}
/* busca la duración total para que lo que queda por volar (R km) cuadre con el perfil de velocidad */
function solveDivert(f, st, R){
  const heli = acOf(f).kind==='heli', late = heli ? [4, 1.6] : [22, 7];
  const mk = rem => {
    const k = Math.min(1, .8*rem/(late[0]+late[1]));
    const pm = [f.pm[0], f.pm[1], f.pm[2], late[0]*k, late[1]*k];
    const D = st.tMin + rem;
    return { ac:f.ac, alt:f.alt, durMs:D*60000, pm, rr:{ t:st.tMin, h:st.alt, v:st.spd, d:0 } };
  };
  const distFor = rem => {
    const fc = mk(rem), D = st.tMin + rem, N = 240; let km = 0, prev = null;
    for(let i=0;i<=N;i++){ const t = st.tMin + rem*i/N, v = Math.max(0, profileRawF(fc, t/D).spd); if(prev!=null) km += (prev+v)/2 * (rem/N)/60; prev = v; }
    return km;
  };
  let lo = .5, hi = 3000;
  for(let it=0; it<40; it++){ const mid=(lo+hi)/2; if(distFor(mid) < R) lo=mid; else hi=mid; }
  const rem = (lo+hi)/2, fc = mk(rem);
  return { rem, D: st.tMin + rem, pm: fc.pm };
}
function planDivert(code){
  const f=flight, ac=acOf(f), d=AP[code];
  if(!d) return { err:'Destino no encontrado' };
  if(code===f.to) return { err:'Ese ya es su destino actual' };
  if(heliOnly(d) && ac.kind!=='heli') return { err:'Ese aeródromo solo admite helicópteros' };
  const st = flightState(), r = activeRoute(), mode = f.routeMode || S.routeMode;
  if(st.p < st.pb[1]){   // todavía en tierra: nuevo plan completo desde el origen
    if(code===f.from) return { err:'Ya está en ese aeródromo' };
    const nr = buildRoute(f.from, code, ac, mode);
    if(stopsFor(nr.dist,ac) > maxStops(ac)) return { err:'Fuera de autonomía para ese destino' };
    const D = Math.max(flightMin(nr.dist, ac), st.tMin + 3);
    return { ground:true, route:nr, newPart:nr, D, rem: D-st.tMin, remKm: nr.dist, st };
  }
  const frac = rp(st.p), cur = routePointAt(r, frac);
  const nr = buildRoute(null, code, ac, mode, cur);
  if(nr.dist > ac.range*(1+maxStops(ac))) return { err:'Fuera de autonomía para ese destino' };
  const flown = r.pts.slice(0, cur.seg).map(q => ({ ...q }));
  const comb = recomputeRoute({ pts: flown.concat(nr.pts.map(q => ({ ...q }))), dep:r.dep, arr:nr.arr, vfr: r.vfr || nr.vfr });
  const dFlown = comb.cum[flown.length], R = comb.dist - dFlown;
  const icaoO = RUNWAYS[f.from]?.icao || f.from;
  comb.str = `${icaoO}${r.dep?'/'+r.dep.id:''} … ${nr.str}`;
  comb.strShort = `${icaoO}${r.dep?'/'+r.dep.id:''} … ${nr.strShort}`;
  comb.wind = { o: r.wind?.o || null, d: nr.wind?.d || null };
  const sol = solveDivert(f, st, R);
  return { route:comb, newPart:nr, dFlown, remKm:R, D:sol.D, rem:sol.rem, pm:sol.pm, st, cur };
}
function commitDivert(code, plan){
  const f = flight, old = f.to, d = AP[code];
  f.divertedFrom = f.divertedFrom || old;
  f.to = code; S.dest = code; savePref();
  f.route = packRoute(plan.route); f.dist = plan.route.dist; f.direct = distKm(AP[f.from], d);
  f.runwayArr = plan.route.arr?.id || ''; f.stops = 0;
  if(plan.ground){ f.rr = null; f.durMs = plan.D*60000; f.pm = phaseMinutes(f, plan.D); }
  else { f.rr = { t:plan.st.tMin, h:plan.st.alt, v:plan.st.spd, d:plan.dFlown }; f.pm = plan.pm; f.durMs = plan.D*60000; }
  f.mins = Math.round(f.durMs/60000);
  ['p4','p5','stop'].forEach(k => delete f.said[k]); f.lastWpt = null;
  delete f._pb; delete f._rpt; delete f._route;
  f.meteo = { ...f.meteo, live:false }; f.tzD = null;
  saveFlight(); enterFlightMode(); fitRoute();
  say('cap', `Comandante Supremo, cambio de destino: nos dirigimos a ${d.city}${plan.route.arr?`, pista ${plan.route.arr.id}`:''}. Quedan ${fmtN(plan.remKm)} km; nuevo tiempo estimado ${fmtHM(plan.rem)}, llegada a las ${fmtTime(Date.now()+plan.rem*60000)}.`);
  enrichFlight(f);
  toast(`🔀 Nuevo destino: ${d.city}`);
}
let dvSel = null, dvPlan = null;
function divertPreview(code){
  dvSel = code; const d = AP[code];
  $('inDivert').value = d ? `${d.iata} · ${d.city}` : '';
  dvPlan = planDivert(code);
  const box = $('dvPrev');
  if(dvPlan.err){ box.innerHTML = `<div class="note warn" style="margin-top:12px">⚠️ ${dvPlan.err}</div>`; $('dvGo').disabled = true; return; }
  const r = dvPlan.newPart, arr = dvPlan.route.arr;
  box.innerHTML = `<div class="summary" style="margin-top:14px">
    <div class="sum-route"><div><div class="sum-iata" style="font-size:26px">${dvPlan.ground ? flight.from : 'AHORA'}</div><div class="sum-city">${dvPlan.ground ? 'en tierra' : fmtN(dvPlan.st.alt)+' ft'}</div></div>
      <div class="sum-mid"><span>🔀</span></div>
      <div style="text-align:right"><div class="sum-iata" style="font-size:26px">${d.iata}</div><div class="sum-city">${d.city} ${flag(d.cc)}</div></div></div>
    <div class="stats">
      <div class="stat"><div class="k">Quedan</div><div class="v">${fmtN(dvPlan.remKm)} km</div></div>
      <div class="stat"><div class="k">Tiempo</div><div class="v">${fmtHM(dvPlan.rem)}</div></div>
      <div class="stat"><div class="k">Llegada</div><div class="v">${fmtTime(Date.now()+dvPlan.rem*60000)}</div></div>
    </div>
    ${arr ? `<div class="note">🛬 Pista <b>${arr.id}</b> (rumbo ${Math.round(arr.hdg)}°)${r.wind?.d ? ' · '+windTxt(r.wind.d) : ''}</div>` : ''}
    <div class="rt-str" style="margin-top:8px">${r.strShort}</div>
  </div>`;
  $('dvGo').disabled = false;
  $('dvGo').textContent = `🔀 Ir a ${d.city}`;
  if(RUNWAYS[code]?.rw?.length && !(WIND[code] && Date.now()-WIND[code].t < 20*60000) && !windPending.has(code)){
    windPending.add(code); fetchPlace(d).then(() => { windPending.delete(code); if(dvSel===code && $('mDivert').classList.contains('open')) divertPreview(code); });
  }
}
function openDivert(){
  if(!flight || !flight.start) return;
  dvSel = null; dvPlan = null; $('dvPrev').innerHTML = ''; $('dvGo').disabled = true; $('dvGo').textContent = '🔀 Cambiar destino'; $('inDivert').value = '';
  const st = flightState(), r = activeRoute(), ac = acOf(flight);
  const here = st.p < st.pb[1] ? AP[flight.from] : routePointAt(r, rp(st.p));
  $('dvSub').innerHTML = st.p < st.pb[1] ? `Todavía en tierra en ${AP[flight.from].city}: se recalcula el vuelo completo.`
    : `Posición actual: ${fmtN(st.alt)} ft · ${fmtN(st.spd)} km/h · a ${fmtN(flight.dist*rp(st.p))} km del despegue. La nueva ruta sale desde aquí.`;
  const near = AIRPORTS.filter(a => a.iata!==flight.to && a.iata!==flight.from && !(heliOnly(a) && ac.kind!=='heli') && a.type!=='cp')
    .map(a => ({ a, km: gcDist(here, a) })).sort((x,y) => x.km-y.km).slice(0,6);
  $('dvNear').innerHTML = near.map(x => `<button class="sugg-item" data-i="${x.a.iata}"><span class="fl">${flag(x.a.cc)}</span><span class="nm">${typeIcon(x.a)} ${x.a.city}<small>${x.a.iata} · ${x.a.name}</small></span><span class="tm">${fmtN(x.km)} km</span></button>`).join('');
  openModal('mDivert');
}

/* =================== CONFIRMACIÓN =================== */
function confirmBox(title,text,okLbl='Aceptar'){
  return new Promise(res => {
    $('cfTitle').textContent=title; $('cfText').textContent=text; $('cfYes').textContent=okLbl;
    const done=v=>{ closeModal('mConfirm'); $('cfYes').onclick=$('cfNo').onclick=null; res(v); };
    $('cfYes').onclick=()=>done(true); $('cfNo').onclick=()=>done(false);
    openModal('mConfirm');
  });
}

/* =================== BITÁCORA =================== */
function updateTier(){ const t=tierFor(totals().hours); $('tierName').textContent='Club '+t.n; $('tierDot').style.background=t.c; }
function renderLog(){
  const t=totals();
  $('lbStats').innerHTML = [[t.flights,'Vuelos'],[t.hours.toFixed(1),'Horas de estudio'],[fmtN(t.km),'Kilómetros'],[t.dests,'Destinos']].map(([v,k]) => `<div class="lb-stat"><div class="v">${v}</div><div class="k">${k}</div></div>`).join('');
  const cur=tierFor(t.hours), idx=TIERS.indexOf(cur), next=TIERS[idx+1];
  const pct = next ? Math.min(100,(t.hours-cur.h)/(next.h-cur.h)*100) : 100;
  $('tierCard').innerHTML = `<div class="tier-row"><div>Club Vuelo Privado<br><b>${cur.n}</b></div><div style="text-align:right;color:var(--muted)">${next?`Faltan <b style="font-size:16px">${(next.h-t.hours).toFixed(1)} h</b><br>para ${next.n}`:'Nivel máximo alcanzado'}</div></div><div class="tier-bar"><div style="width:${pct}%"></div></div>`;
  $('lbList').innerHTML = log.length ? log.map((e,i) => `<button class="lb-item" data-i="${i}">
      <span class="rt">${e.from} → ${e.to}</span>
      <span class="meta"><b>${AP[e.from]?.city||e.from} → ${AP[e.to]?.city||e.to}</b><br>${e.flightNo} · ${ACF[e.ac]?.short||''} · ${fmtDate(e.date)}${e.f?.divertedFrom?` · ↪ desvío (iba a ${e.f.divertedFrom})`:''}</span>
      <span class="meta hide-m" style="text-align:right"><b>${fmtHM(e.studyMin)}</b><br>${fmtN(e.km)} km</span>
      <span class="st ${e.status==='ok'?'ok':'ko'}">${e.status==='ok'?'Completado':'Interrumpido'}</span></button>`).join('')
    : `<div class="empty">Aún no hay vuelos registrados.<br>Su primer despegue le espera, Comandante Supremo.</div>`;
  $('lbClear').style.display = log.length ? '' : 'none';
}
function exportLog(){
  const data = { app:'vuelo-privado', version:3, exported:new Date().toISOString(), log, pref:S, custom:customPts };
  const blob = new Blob([JSON.stringify(data,null,1)], { type:'application/json' });
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=`vuelo-privado-bitacora-${new Date().toISOString().slice(0,10)}.json`; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  toast('Copia de seguridad descargada');
}
function importLog(file){
  const rd=new FileReader();
  rd.onload=()=>{
    try{
      const data=JSON.parse(rd.result); const inc=Array.isArray(data)?data:data.log;
      if(!Array.isArray(inc)) throw 0;
      if(Array.isArray(data.custom)) data.custom.forEach(c => { if(c && c.code && !customPts.some(p=>p.code===c.code)){ customPts.push(c); const a=indexCustom(c); if(map) addApMarker(a); } });
      LS.set('vp_custom', customPts);
      const ids=new Set(log.map(e=>e.id)); let added=0;
      inc.forEach(e=>{ if(e && e.id && e.from && e.to && !ids.has(e.id)){ log.push(e); ids.add(e.id); added++; } });
      log.sort((a,b)=>(b.date||0)-(a.date||0)); saveLog(); updateTier(); renderLog(); drawHistory();
      toast(added ? `${added} vuelo${added>1?'s':''} importado${added>1?'s':''}` : 'No había vuelos nuevos que importar');
    }catch(e){ toast('El archivo no es una copia válida de Vuelo Privado'); }
  };
  rd.readAsText(file);
}

/* =================== PASAPORTE =================== */
function renderPassport(){
  const ok = log.filter(e => e.status==='ok' && AP[e.to]);
  const byCountry = {};
  ok.slice().reverse().forEach(e => { const a=AP[e.to]; (byCountry[a.cc] ||= { first:e.date, n:0, places:new Set() }); byCountry[a.cc].n++; byCountry[a.cc].places.add(a.city); });
  const bases = [...new Set(ok.filter(e => isMilAp(AP[e.to])).map(e => e.to))];
  const helis = [...new Set(ok.filter(e => AP[e.to].type==='hp').map(e => e.to))];
  const cc = Object.keys(byCountry);
  $('ppStats').innerHTML = [[cc.length,'Países'],[new Set(ok.map(e=>e.to)).size,'Destinos'],[bases.length,'Bases militares'],[helis.length,'Helipuertos']].map(([v,k]) => `<div class="lb-stat"><div class="v">${v}</div><div class="k">${k}</div></div>`).join('');
  $('ppStamps').innerHTML = cc.length ? cc.map(c => {
    const r=mulberry32(hashStr(c)), ink=pick(r,STAMP_INKS), rot=Math.round(r()*24-12), shape=r()<.5?'round':'rect';
    const x=byCountry[c];
    return `<div class="stamp ${shape}" style="--ink:${ink};transform:rotate(${rot}deg)">
      <div class="st-flag">${flag(c)}</div><div class="st-name">${COUNTRIES[c].toUpperCase()}</div>
      <div class="st-date">${fmtDate(x.first)}</div><div class="st-n">${x.n} vuelo${x.n>1?'s':''} · ${[...x.places].slice(0,2).join(', ')}</div></div>`;
  }).join('') : `<div class="empty" style="grid-column:1/-1">Su pasaporte está esperando el primer sello.<br>Complete un vuelo para estrenarlo.</div>`;
  $('ppBases').innerHTML = bases.length ? `<div class="h-sec" style="margin-top:18px">🎖️ Bases militares visitadas</div><div class="chips">${bases.map(b=>`<span class="chip on">${flag(AP[b].cc)} ${AP[b].name}</span>`).join('')}</div>` : '';
}

/* =================== EVENTOS =================== */
setupCombo($('inOrigin'), $('lsOrigin'), 'origin');
setupCombo($('inDest'), $('lsDest'), 'dest');
$('btnSwap').onclick = () => { if(!S.dest) return; [S.origin,S.dest]=[S.dest,S.origin]; ensureAircraft(); savePref(); syncInputs(); renderPlan(); drawRoute(); };
$('selAc').onchange = e => { S.ac=e.target.value; savePref(); renderPlan(); drawRoute(false); };
$('btnBook').onclick = book;
$('btnRandom').onclick = () => {
  const o=AP[S.origin], cur=ACF[S.ac];
  const all = AIRPORTS.filter(a => a.iata!==o.iata && feasible(cur,o,a)).map(a => ({ a, m:flightMin(distKm(o,a),cur) }));
  const near = all.filter(x => Math.abs(x.m-S.study) <= Math.max(15, S.study*.35));
  const pool = near.length ? near : all;
  if(!pool.length){ toast('No hay destinos alcanzables con esta aeronave'); return; }
  const x = pool[Math.floor(Math.random()*pool.length)];
  S.dest = x.a.iata; savePref(); syncInputs(); renderPlan(); drawRoute(); toast(`Destino sorpresa: ${x.a.city} ${flag(x.a.cc)}`);
};
$('chips').addEventListener('click', e => { const c=e.target.closest('.chip'); if(!c) return; S.study=+c.dataset.m; savePref(); renderChips(); renderSuggestions(); });
$('chips').addEventListener('change', e => { if(e.target.id==='studyCustom'){ S.study=Math.max(5,Math.min(1200,+e.target.value||60)); savePref(); renderChips(); renderSuggestions(); } });
$('routeChips').addEventListener('click', e => { const c=e.target.closest('.chip'); if(!c) return; S.routeMode=c.dataset.r; savePref(); planCache=null; renderChips(); renderPlan(); drawRoute(); });
$('breakChips').addEventListener('click', e => { const c=e.target.closest('.chip'); if(!c) return; S.breaks=+c.dataset.b; savePref(); renderChips(); });
$('sugg').addEventListener('click', e => { const b=e.target.closest('.sugg-item'); if(!b) return; S.dest=b.dataset.i; ensureAircraft(); savePref(); syncInputs(); renderPlan(); drawRoute(); });
$('bPause').onclick = togglePause;
$('bNoise').onclick = () => setNoise(!noise);
$('vol').value = vol;
$('vol').oninput = e => { audio(); setVolume(+e.target.value); };
$('bFollow').onclick = () => { follow=!follow; $('bFollow').classList.toggle('on',follow); if(follow){ map && map.setZoom(Math.max(map.getZoom(), acOf(flight).kind==='heli'?9:6)); tick(true); } else fitRoute(); };
$('bPass').onclick = () => flight && showPass(flight,'view');
$('bFull').onclick = () => { try{ document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); }catch(e){} };
$('bAbort').onclick = abort;
$('bDivert').onclick = openDivert;
$('dvNear').addEventListener('click', e => { const b=e.target.closest('.sugg-item'); if(b) divertPreview(b.dataset.i); });
$('dvGo').onclick = () => { if(!dvSel || !dvPlan || dvPlan.err) return; const code=dvSel, plan=planDivert(code); if(plan.err){ toast(plan.err); return; } closeModal('mDivert'); commitDivert(code, plan); };
setupCombo($('inDivert'), $('lsDivert'), 'divert');
$('bQuit').onclick = quitFlight;
$('paHead').onclick = () => { $('pa').classList.toggle('collapsed'); $('paToggle').textContent = $('pa').classList.contains('collapsed') ? '+' : '–'; };
$('btnLog').onclick = $('btnClub').onclick = () => { renderLog(); openModal('mLog'); };
$('btnPassport').onclick = () => { renderPassport(); openModal('mPassport'); };
$('lbList').addEventListener('click', e => { const b=e.target.closest('.lb-item'); if(!b) return; const en=log[+b.dataset.i]; if(en.f) showPass(en.f,'view'); });
$('lbClear').onclick = async () => { closeModal('mLog'); if(await confirmBox('¿Borrar la bitácora?','Se eliminarán todos los vuelos y horas registradas. Le recomendamos exportar una copia antes. No se puede deshacer.','Borrar')){ log=[]; saveLog(); updateTier(); drawHistory(); toast('Bitácora borrada'); } };
$('lbExport').onclick = exportLog;
$('lbImport').onclick = () => $('importFile').click();
$('importFile').onchange = e => { const f=e.target.files[0]; if(f) importLog(f); e.target.value=''; };
$('landNext').onclick = () => { closeModal('mLand'); $('inDest').focus(); };
$('landLog').onclick = () => { closeModal('mLand'); renderPassport(); openModal('mPassport'); };
document.addEventListener('keydown', e => {
  if(e.key==='Escape') document.querySelectorAll('.modal.open').forEach(m => { if(m.id!=='mConfirm') closeModal(m.id); });
  if(e.code==='Space' && flight && flight.start && !document.querySelector('.modal.open') && document.activeElement.tagName!=='INPUT'){ e.preventDefault(); togglePause(); }
});
window.addEventListener('resize', () => { if(routeA && !follow) fitRoute(); });
window.addEventListener('online', () => toast('Conexión recuperada'));
window.addEventListener('offline', () => toast('Sin conexión: el vuelo continúa con normalidad'));

/* =================== INICIO =================== */
if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(()=>{});
initMap();
updateTier();
renderChips();
syncInputs();
if(flight && flight.start){
  if(!ACF[flight.ac]) flight.ac='g700';
  if(flight.alt==null) flight.alt = (flight.fl||430)*100;
  enterFlightMode(); toast('Vuelo en curso recuperado');
} else {
  if(flight && !flight.start){ flight=null; saveFlight(); }
  ensureAircraft(); renderPlan(); drawRoute();
}
ensureWind([S.origin, S.dest]);
