import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Esqueleto } from './systems/esqueleto.js';
import { Animador } from './systems/animador.js';
import { CATALOGO, claves } from './animations/catalogo.js';
import GLB from './soldado.glb';
const $ = s => document.querySelector(s), { sin, min, max, PI } = Math, lim = (x, a, b) => max(a, min(b, x)), suave = x => (x = lim(x, 0, 1), x * x * (3 - 2 * x));
const P = window.PREGUNTAS, ANCHO = 5, LARGO = 26, PX = 1.25, TEMA = [0x5cc8ff, 0xffb347, 0xc58bff];

// ---- Animaciones nuevas sobre el personaje de Mar de Plomo ----
CATALOGO.abrir = { torso: 1, dur: .9, f: t => claves([[0, { torso: [0, 0, 0], manoD: [-.25, .95, .1] }], [.35, { torso: [5, 0, 0], manoD: [-.2, 1.12, .5] }], [.9, { torso: [10, 6, 0], manoD: [-.2, 1.15, .56] }]], t) };
CATALOGO.susto = { f: t => ({ torso: [-6, 0, sin(t * 17) * 5], cabeza: [35, 0, 0], brazoI: [1, -.1 + sin(t * 15) * .3, .1], brazoD: [-1, -.1 - sin(t * 15) * .3, .1] }) };
CATALOGO.caer = { f: t => { const k = suave(t / 1.3), a = t * 9; return { raiz: [-70 * k, t * 35, sin(t * 2) * 14], alto: 1, pieLibre: .7, cabeza: [-10 * k, sin(t * 3) * 15, 0],
  brazoI: [1, .5 + sin(a) * .6, .3], anteI: [.7, .7 + sin(a) * .5, .4], brazoD: [-1, .5 - sin(a + 1) * .6, .3], anteD: [-.7, .7 - sin(a + 1) * .5, .4],
  musloI: [.3, -.8, .45 + sin(a * .8) * .4], piernaI: [.1, -.8, -.5], musloD: [-.3, -.8, .45 - sin(a * .8) * .4], piernaD: [-.1, -.8, -.5] }; } };

// ---- Sonido sintetizado ----
let ac;
const tono = (f0, f1, d, v, tipo = 'sine', ret = 0) => {
  if (!ac) return;
  const t = ac.currentTime + ret, o = ac.createOscillator(), g = ac.createGain();
  o.type = tipo; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d);
};
const ruido = (d, v, f0, f1) => {
  if (!ac) return;
  const n = ac.sampleRate * d | 0, b = ac.createBuffer(1, n, ac.sampleRate), x = b.getChannelData(0); for (let i = 0; i < n; i++) x[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(), q = ac.createBiquadFilter(), g = ac.createGain(), t = ac.currentTime;
  s.buffer = b; q.type = 'bandpass'; q.frequency.setValueAtTime(f0, t); q.frequency.exponentialRampToValueAtTime(f1, t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0005, t + d); s.connect(q).connect(g).connect(ac.destination); s.start();
};
const SON = {
  paso: () => ruido(.08, .14, 500, 200), leer: () => tono(500, 700, .12, .08),
  puerta: () => { tono(95, 170, .9, .06, 'sawtooth'); tono(140, 90, .5, .04, 'sawtooth', .6); },
  trampa: () => { ruido(.4, .7, 300, 80); tono(90, 35, .5, .4, 'square'); },
  caida: () => { ruido(6, .5, 300, 1600); tono(620, 60, 5, .07); },
  bien: () => [523, 659, 784, 1047].forEach((f, i) => tono(f, f, .5, .13, 'triangle', i * .12)),
};

// ---- Escena ----
const ren = new THREE.WebGLRenderer({ canvas: $('#c'), antialias: true });
ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap; ren.toneMapping = THREE.ACESFilmicToneMapping; ren.toneMappingExposure = 1.15; ren.setPixelRatio(min(devicePixelRatio, 2));
const esc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(58, 1, .05, 400);
esc.background = new THREE.Color(0x070b18); esc.fog = new THREE.FogExp2(0x070b18, .02);
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, ...o });
const caja = (w, h, d, m, x, y, z, padre = esc) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; padre.add(o); return o; };
const hemi = new THREE.HemisphereLight(0xbcd2ff, 0x2a2430, 1.1); esc.add(hemi);
const sol = new THREE.DirectionalLight(0xfff0d8, 2.2);
sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048); sol.shadow.bias = -.0005; sol.shadow.normalBias = .03;
Object.assign(sol.shadow.camera, { left: -8, right: 8, top: 10, bottom: -8, near: 1, far: 30 }); esc.add(sol, sol.target);
{ // estrellas
  const n = 900, p = new Float32Array(n * 3), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) v.randomDirection().multiplyScalar(150 + Math.random() * 100).toArray(p, i * 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  esc.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 1.6, sizeAttenuation: false, fog: false })));
}
const textura = (fn, w = 256, h = 256) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
// Plataforma de 5 m de ancho con bordes luminosos del color del nivel
const losa = textura((g, w) => {
  g.fillStyle = '#8e95a3'; g.fillRect(0, 0, w, w);
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},.06)`; g.fillRect(Math.random() * w, Math.random() * w, 2, 2); }
  g.strokeStyle = '#4b515e'; g.lineWidth = 6; g.strokeRect(0, 0, w, w);
});
losa.wrapS = losa.wrapT = THREE.RepeatWrapping; losa.repeat.set(4, LARGO / 1.25);
const luzM = new THREE.MeshBasicMaterial();
caja(ANCHO, .5, LARGO + 3, mat(0xffffff, { map: losa }), 0, -.25, LARGO / 2 + 1.5);
for (const s of [-1, 1]) caja(.1, .1, LARGO + 3, luzM, s * (ANCHO / 2 - .05), .03, LARGO / 2 + 1.5);
// Muro con dos huecos de puerta (1,1 x 2,3 m)
const muroM = mat(0x3a4254), PW = 1.1, PH = 2.3;
for (const [x, w] of [[-2.15, .7], [0, 1.4], [2.15, .7]]) caja(w, 3.6, .25, muroM, x, 1.8, 0);
for (const s of [-1, 1]) {
  caja(PW, 3.6 - PH, .25, muroM, s * PX, PH + (3.6 - PH) / 2, 0); caja(PW + .14, .07, .33, luzM, s * PX, PH + .035, 0);
  for (const l of [-1, 1]) caja(.07, PH, .33, luzM, s * PX + l * (PW / 2 + .035), PH / 2, 0);
}
caja(ANCHO + .2, .2, .5, luzM, 0, 3.7, 0);
const madera = textura((g, w, h) => {
  g.fillStyle = '#6b4426'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? '30,14,4' : '150,100,60'},.16)`; g.fillRect(Math.random() * w, 0, 1 + Math.random() * 3, h); }
  g.strokeStyle = '#341d0d'; g.lineWidth = 7; for (const y of [30, 270]) g.strokeRect(40, y, w - 80, 210);
}, 256, 512);
const maderaM = mat(0xffffff, { map: madera }), laton = mat(0xd9b45a, { metalness: .8, roughness: .3 });
const puertas = [-1, 1].map((s, i) => {
  const b = new THREE.Group(); b.position.set(s * PX - PW / 2, 0, 0); esc.add(b); caja(PW, PH, .08, maderaM, PW / 2, PH / 2, 0, b);
  for (const l of [-1, 1]) caja(.05, .22, .06, laton, PW - .12, 1.08, l * .07, b);
  const map = textura((g, w) => { g.fillStyle = '#f5efe0'; g.beginPath(); g.arc(w / 2, w / 2, w / 2, 0, 7); g.fill(); g.fillStyle = '#3a2512'; g.font = 'bold 170px Segoe UI,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('AB'[i], w / 2, w / 2 + 10); });
  const placa = new THREE.Mesh(new THREE.PlaneGeometry(.42, .42), new THREE.MeshBasicMaterial({ transparent: true, map })); placa.position.set(PW / 2, 1.62, .05); b.add(placa);
  return { b, x: s * PX, letra: 'AB'[i], buena: false };
});
// Habitación: se coloca tras la puerta elegida. Parte del suelo son dos trampillas.
const sala = new THREE.Group(), FONDO = 8, AN = 2.5, paredM = mat(0x55463c), suelo = madera.clone(), sueloM = mat(0xffffff, { map: suelo }); esc.add(sala); sala.visible = false;
for (const s of [-1, 1]) caja(.2, 3.4, FONDO, paredM, s * (AN / 2 + .1), 1.7, -FONDO / 2 - .12, sala);
caja(AN + .4, .2, FONDO, paredM, 0, 3.5, -FONDO / 2 - .12, sala); caja(AN + .4, 3.4, .2, paredM, 0, 1.7, -FONDO - .2, sala);
caja(AN, .2, 1.4, sueloM, 0, -.1, -.6, sala); caja(AN, .2, 3, sueloM, 0, -.1, -6.7, sala);
const hojas = [-1, 1].map(s => { const b = new THREE.Group(); b.position.set(s * AN / 2, -.05, -3.25); sala.add(b); caja(AN / 2, .1, 3.9, sueloM, -s * AN / 4, 0, 0, b); return { b, s }; });
const lamp = new THREE.PointLight(0xffd9a0, 14, 14, 1.6); lamp.position.set(0, 3, -4.3); lamp.castShadow = true; lamp.shadow.bias = -.004; sala.add(lamp);
// Pozo infinito
const pozo = new THREE.Group(), anM = new THREE.MeshBasicMaterial({ color: 0xff3b30 }); sala.add(pozo);
{
  const t = new THREE.Mesh(new THREE.BoxGeometry(AN, 220, 3.9), mat(0x1b1216, { side: THREE.BackSide })); t.position.set(0, -110.2, -3.25); pozo.add(t);
  for (let i = 1; i < 45; i++) for (const s of [-1, 1]) { const a = caja(.05, .05, 3.9, anM, s * (AN / 2 - .03), -i * 4, -3.25, pozo), c = caja(AN, .05, .05, anM, 0, -i * 4, -3.25 + s * 1.92, pozo); a.castShadow = c.castShadow = false; }
}
const foco = new THREE.PointLight(0xffe0c8, 0, 12, 1.2); esc.add(foco);

// ---- Estado ----
const J = { x: 0, y: 0, z: LARGO, th: PI, vel: 0, ritmo: 1 }, tecla = new Set();
let per, nivel = 0, caidas = 0, estado = 'menu', cerca = null, leida = null, t = 0, vy = 0, elegida = null, plano = '', hecho = {};
function ponNivel(n) {
  nivel = n; const d = P[n], c = TEMA[n % TEMA.length], lado = Math.random() < .5 ? 0 : 1;
  luzM.color.set(c); document.documentElement.style.setProperty('--c', '#' + c.toString(16).padStart(6, '0'));
  puertas.forEach((p, i) => { p.buena = i === lado; p.texto = p.buena ? d.buena : d.mala; p.b.rotation.y = 0; });
  Object.assign(J, { x: 0, y: 0, z: LARGO, th: PI, vel: 0 });
  sala.visible = false; hojas.forEach(h => h.b.rotation.z = 0); lamp.color.set(0xffd9a0); foco.intensity = 0; sol.intensity = 2.2; hemi.intensity = 1.1;
  elegida = leida = cerca = null; plano = ''; tecla.clear();
  $('#pregunta small').textContent = `PREGUNTA ${n + 1} DE ${P.length}`; $('#pregunta span').textContent = d.pregunta; $('#pregunta').hidden = false; $('#respuesta').hidden = true;
  $('#letrero').textContent = ''; document.body.classList.remove('cine'); $('#velo').style.opacity = 0;
  per.anim.ponTorso(null); per.anim.pon('quieto', .01); estado = 'juego'; camara(1, true);
}
// ---- Nombre, tiempo y ranking ----
// Ranking compartido por todos los jugadores (servidor en servidor/). Sin conexión, se usa el de este dispositivo.
const SERVIDOR = 'https://proyecto-final-ranking.crazy-arcade-visitas.workers.dev', CLAVE = 'puertas_ranking'; let nombre = '', inicio = 0, tiempo = 0;
const texto = ms => { const d = Math.floor(ms / 100); return Math.floor(d / 600) + ':' + String(Math.floor(d / 10) % 60).padStart(2, '0') + ',' + d % 10; };
const mismo = (a, b) => a.toLowerCase() === b.toLowerCase();
function local(n, ms) { // un mismo nombre solo aparece una vez, con su mejor tiempo
  let r = []; try { r = JSON.parse(localStorage.getItem(CLAVE)) || []; } catch { }
  r = r.map(x => ({ nombre: x.nombre ?? x.n, ms: x.ms })); const ya = r.find(x => mismo(x.nombre, n));
  if (!ya) r.push({ nombre: n, ms }); else if (ms < ya.ms) Object.assign(ya, { nombre: n, ms });
  r.sort((a, b) => a.ms - b.ms); try { localStorage.setItem(CLAVE, JSON.stringify(r)); } catch { }
  return { ranking: r, total: r.length, yo: { puesto: r.findIndex(x => mismo(x.nombre, n)) + 1 }, local: true };
}
async function apunta(n, ms) {
  try {
    const c = new AbortController(), t = setTimeout(() => c.abort(), 8000);
    const r = await fetch(SERVIDOR + '/tiempo', { method: 'POST', body: JSON.stringify({ n, ms: Math.round(ms) }), signal: c.signal }); clearTimeout(t);
    if (r.ok) return await r.json();
  } catch { }
  return local(n, ms);
}
const nodo = (clase, txt = '', et = 'div') => { const e = document.createElement(et); e.className = clase; e.textContent = txt; return e; };
function podio(r) {
  const p = nodo('podio');
  for (const i of [1, 0, 2]) {
    const x = r[i], c = nodo(x && mismo(x.nombre, nombre) ? 'yo' : ''), e = nodo('esc', i + 1);
    e.style.height = [110, 76, 50][i] + 'px'; e.style.background = ['#f5c542', '#c9d1da', '#cd8a52'][i];
    c.append(nodo('med', x ? ['🥇', '🥈', '🥉'][i] : ''), nodo('nom', x ? x.nombre : '—'), nodo('tie', x ? texto(x.ms) : ''), e); p.append(c);
  }
  return p;
}
function empieza() {
  nombre = $('#nombre').value.trim().replace(/[ ]+/g, ' '); if (!nombre) { $('#nombre').focus(); return; }
  $('#portada').hidden = true; $('#nombre').blur(); $('#etiqueta').textContent = nombre; caidas = 0;
  ac ||= new (window.AudioContext || window.webkitAudioContext)(); ac.resume(); inicio = performance.now(); ponNivel(0);
}
// F: a partir de aquí no se puede hacer nada hasta que acabe la escena
function abre(p) {
  elegida = p; estado = 'abre'; t = 0; hecho = {}; J.vel = 0; tecla.clear(); plano = 'dentro';
  sala.position.x = p.x; sala.visible = true; pozo.visible = !p.buena; sol.intensity = .5; hemi.intensity = .45;
  for (const s of ['#pregunta', '#respuesta', '#aviso']) $(s).hidden = true; document.body.classList.add('cine');
}
const una = (k, f) => { if (!hecho[k]) { hecho[k] = 1; f(); } };
function tras(ms, f) { $('#velo').style.opacity = 1; estado = 'espera'; setTimeout(f, ms); }
function cine(dt) {
  t += dt; const a = per.anim, p = elegida;
  if (estado === 'cae') {
    vy += (9.8 - vy * .7) * dt; J.y -= vy * dt; const q = t - hecho.cae;
    if (q > .6) plano = 'arriba';
    foco.intensity = 16; foco.position.set(J.x, J.y + 2.2, J.z);
    if (q > 5.6) $('#letrero').textContent = 'Respuesta incorrecta';
    if (q > 8) { caidas++; tras(800, () => ponNivel(nivel)); }
    return;
  }
  p.b.rotation.y = 1.75 * suave((t - 1.1) / 1.1);
  if (t < .8) { const k = 1 - Math.exp(-dt * 6); J.x += (p.x - J.x) * k; J.z += (.85 - J.z) * k; J.th += Math.atan2(sin(PI - J.th), Math.cos(PI - J.th)) * k; a.pon('andar'); J.ritmo = .7; return; }
  J.x = p.x; J.th = PI;
  if (t < 2) { una('abre', () => { a.pon('quieto'); a.ponTorso('abrir'); }); if (t > 1.1) una('son', SON.puerta); return; }
  una('entra', () => a.ponTorso(null, .3));
  if (p.buena || J.z > -3.2) {
    J.z -= 1.5 * dt; a.pon('andar'); J.ritmo = .9;
    if (p.buena && J.z < -3.6) una('bien', () => { SON.bien(); lamp.color.set(0x7dff9a); });
    if (J.z < -5.6) { tiempo = performance.now() - inicio; tras(700, () => nivel + 1 < P.length ? ponNivel(nivel + 1) : final()); }
    return;
  }
  una('para', () => { a.pon('quieto'); hecho.t = t; }); const q = t - hecho.t;
  if (q > .55) { una('trampa', () => { SON.trampa(); a.pon('susto', .12); lamp.color.set(0xff5040); }); hojas.forEach(h => h.b.rotation.z = h.s * 1.5 * suave((q - .55) / .3)); }
  if (q > .85) { estado = 'cae'; hecho.cae = t; vy = 0; a.pon('caer', .3); SON.caida(); }
}
// Solo hacia delante (y a los lados para elegir puerta): no existe el retroceso
function juega(dt) {
  const pul = (...k) => k.some(x => tecla.has(x)) ? 1 : 0, w = pul('KeyW', 'ArrowUp'), l = pul('KeyD', 'ArrowRight') - pul('KeyA', 'ArrowLeft'), hay = w || l, n = Math.hypot(w, l) || 1;
  J.vel += ((hay ? pul('ShiftLeft', 'ShiftRight') ? 5.2 : 2.6 : 0) - J.vel) * (1 - Math.exp(-dt * 9));
  if (hay) { const r = PI - Math.atan2(l, w); J.th += Math.atan2(sin(r - J.th), Math.cos(r - J.th)) * (1 - Math.exp(-dt * 11)); }
  J.x = lim(J.x + l / n * J.vel * dt, -2.15, 2.15); J.z = max(.75, J.z - w / n * J.vel * dt);
  if (J.vel > 3.2) { per.anim.pon('correr'); J.ritmo = J.vel / 3.6; } else if (J.vel > .25) { per.anim.pon('andar'); J.ritmo = J.vel / 1.65; } else per.anim.pon('quieto', .28);
  const c = puertas.find(p => Math.abs(J.x - p.x) < .95 && J.z < 2.6) || null;
  if (c === cerca) return;
  cerca = c; $('#aviso').hidden = !c; if (c) $('#aviso').innerHTML = `Puerta ${c.letra} &nbsp; <kbd>E</kbd> leer &nbsp; <kbd>F</kbd> abrir`;
  $('#respuesta').hidden = true;
}
function acciona(k) {
  if (estado !== 'juego' || !cerca) return;
  if (k === 'KeyE') { $('#respuesta b').textContent = 'PUERTA ' + cerca.letra; $('#respuesta span').textContent = cerca.texto; $('#respuesta').hidden = false; SON.leer(); }
  if (k === 'KeyF') abre(cerca);
}
const mira = new THREE.Vector3(), meta = new THREE.Vector3();
function camara(dt, ya) {
  cam.up.set(0, 1, 0);
  if (plano === 'dentro') { const k = min(t, 4); cam.position.set(elegida.x + .75, 2.1 - k * .04, -7.2 + k * .1); cam.lookAt(elegida.x, estado === 'cae' ? max(-.2, 1 + J.y * .4) : 1.05, -1); }
  else if (plano === 'arriba') { cam.up.set(0, 0, -1); cam.position.set(elegida.x, 3.1, -3.2); cam.lookAt(elegida.x, -50, -3.25); }
  else { const k = ya ? 1 : 1 - Math.exp(-dt * 6); mira.lerp(meta.set(J.x * .6, 1.5, J.z - 4), k); cam.position.lerp(meta.set(J.x * .6, 2.5, J.z + 4), k); cam.lookAt(mira); }
}
async function final() {
  estado = 'final'; document.body.classList.remove('cine'); $('#velo').style.opacity = 0;
  const f = $('#final'); f.hidden = false; f.innerHTML = '<h1></h1><p></p><p>Cargando el ranking…</p>';
  f.children[0].textContent = `¡Lo has conseguido, ${nombre}!`;
  const sub = `Tu tiempo: ${texto(tiempo)} · ${caidas ? `${caidas} ${caidas > 1 ? 'caídas' : 'caída'}` : 'sin caídas'}`; f.children[1].textContent = sub;
  const r = await apunta(nombre, tiempo); if (estado !== 'final') return;
  f.children[1].textContent = sub + (r.yo ? ` · Puesto ${r.yo.puesto} de ${r.total}` : '');
  f.children[2].replaceWith(podio(r.ranking));
  if (r.local) f.append(nodo('r', 'Sin conexión: este ranking es solo de este dispositivo.', 'p'));
  for (const d of P) f.append(nodo('r', d.buena, 'p'));
  const b = nodo('', 'Jugar otra vez', 'button'); b.onclick = () => { f.hidden = true; $('#pregunta').hidden = true; $('#portada').hidden = false; $('#nombre').value = ''; $('#nombre').focus(); estado = 'menu'; plano = ''; }; f.append(b);
}
addEventListener('keydown', e => { if (e.target.id === 'nombre') { if (e.key === 'Enter' && !$('#jugar').disabled) empieza(); return; } if (/^Arrow|Space/.test(e.code)) e.preventDefault(); if (e.repeat) return; tecla.add(e.code); acciona(e.code); });
addEventListener('keyup', e => tecla.delete(e.code)); addEventListener('blur', () => tecla.clear());
if (matchMedia('(pointer:coarse)').matches) document.body.classList.add('tactil');
for (const d of document.querySelectorAll('#tactil div')) {
  d.onpointerdown = e => { e.preventDefault(); tecla.add(d.dataset.k); acciona(d.dataset.k); };
  d.onpointerup = d.onpointercancel = d.onpointerleave = () => tecla.delete(d.dataset.k);
}
const ajusta = () => { ren.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.fov = cam.aspect < 1 ? 75 : 58; cam.updateProjectionMatrix(); };
addEventListener('resize', ajusta); ajusta();
function tic(dt) {
  if (estado === 'juego') juega(dt); else if (estado === 'abre' || estado === 'cae') cine(dt);
  const f0 = per.anim.fase; per.anim.paso(dt, J.ritmo);
  if (/andar|correr/.test(per.anim.cuerpo) && /juego|abre/.test(estado) && Math.floor(f0 * 2) !== Math.floor(per.anim.fase * 2)) SON.paso();
  per.esq.raiz.position.set(J.x, J.y, J.z); per.esq.raiz.rotation.y = J.th;
  sol.position.set(J.x + 4, 9, J.z + 5); sol.target.position.set(J.x, 0, J.z - 1);
  camara(dt); ren.render(esc, cam);
  const jug = estado === 'juego', et = $('#etiqueta'), cr = $('#crono'); et.hidden = cr.hidden = !jug;
  if (jug) { cr.textContent = '⏱ ' + texto(performance.now() - inicio); meta.set(J.x, 0, J.z).project(cam); et.style.left = (meta.x + 1) * innerWidth / 2 + 'px'; et.style.bottom = max(4, (meta.y + 1) * innerHeight / 2 - 34) + 'px'; }
}
new GLTFLoader().parse(GLB.buffer.slice(GLB.byteOffset, GLB.byteOffset + GLB.byteLength), '', g => {
  g.scene.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.frustumCulled = false; } });
  const esq = new Esqueleto(g.scene), anim = new Animador(esq, g.animations); per = { esq, anim }; esc.add(esq.raiz); camara(1, true);
  const b = $('#jugar'); b.disabled = false; b.textContent = 'Jugar';
  b.onclick = () => { b.blur(); empieza(); }; $('#nombre').focus();
  let ult = performance.now(); const bucle = n => { const d = (n - ult) / 1000; ult = n; if (!window.__T.pausa) tic(lim(d, 0, .05)); requestAnimationFrame(bucle); }; requestAnimationFrame(bucle);
}, e => { $('#jugar').textContent = 'Error al cargar el personaje'; console.error(e); });
window.__T = { local, J, puertas, tecla, acciona, tic, pausa: false, get estado() { return estado; }, get nivel() { return nivel; }, get plano() { return plano; } };
