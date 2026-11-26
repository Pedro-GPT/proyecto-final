// Ranking compartido de "Las dos puertas" (Cloudflare Worker + D1).
// POST /tiempo {n: nombre, ms}  -> guarda y devuelve el ranking
// GET  /ranking?n=nombre        -> devuelve el ranking
// Un nombre (sin distinguir mayúsculas) = una persona; se queda con su mejor tiempo.
const TOP = 10, MIN_MS = 20000, MAX_MS = 3600000, MAX_CUERPO = 200;

const GUARDAR = `
  INSERT INTO tiempos (clave, nombre, ms, fecha) VALUES (?1, ?2, ?3, ?4)
  ON CONFLICT(clave) DO UPDATE SET
    nombre = CASE WHEN ?3 < ms THEN ?2 ELSE nombre END,
    fecha  = CASE WHEN ?3 < ms THEN ?4 ELSE fecha END,
    ms     = MIN(ms, ?3)`;

export function limpiarNombre(n) {
  if (typeof n !== 'string') return null;
  const t = n.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  return t && [...t].length <= 16 ? t : null;
}
const clave = n => n.toLowerCase();

function origenPermitido(request, env) {
  const o = request.headers.get('Origin');
  return o && (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).includes(o) ? o : null;
}
function responder(cuerpo, estado, origen) {
  const h = { 'Cache-Control': 'no-store', Vary: 'Origin', 'Content-Type': 'application/json' };
  if (origen) h['Access-Control-Allow-Origin'] = origen;
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: h });
}

async function ranking(env, nombre, origen) {
  const db = env.DB, { results } = await db.prepare('SELECT nombre, ms FROM tiempos ORDER BY ms, fecha LIMIT ?1').bind(TOP).all();
  const total = (await db.prepare('SELECT COUNT(*) AS n FROM tiempos').first()).n;
  let yo = null;
  if (nombre) {
    const f = await db.prepare('SELECT nombre, ms, fecha FROM tiempos WHERE clave = ?1').bind(clave(nombre)).first();
    if (f) yo = { nombre: f.nombre, ms: f.ms, puesto: (await db.prepare('SELECT COUNT(*) AS n FROM tiempos WHERE ms < ?1 OR (ms = ?1 AND fecha < ?2)').bind(f.ms, f.fecha).first()).n + 1 };
  }
  return responder({ ranking: results, total, yo }, 200, origen);
}

async function guardar(request, env, origen) {
  const texto = await request.text();
  if (texto.length > MAX_CUERPO) return responder({ error: 'demasiado grande' }, 413, origen);
  let e; try { e = JSON.parse(texto); } catch { return responder({ error: 'json' }, 400, origen); }
  const nombre = limpiarNombre(e && e.n), ms = Math.round(Number(e && e.ms));
  if (!nombre || !(ms >= MIN_MS && ms <= MAX_MS)) return responder({ error: 'datos' }, 400, origen);
  await env.DB.prepare(GUARDAR).bind(clave(nombre), nombre, ms, Date.now()).run();
  return ranking(env, nombre, origen);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url), origen = origenPermitido(request, env);
    if (!origen) return responder({ error: 'origen' }, 403, null);
    if (request.method === 'POST' && url.pathname === '/tiempo') return guardar(request, env, origen);
    if (request.method === 'GET' && url.pathname === '/ranking') return ranking(env, limpiarNombre(url.searchParams.get('n')), origen);
    return responder({ error: 'no existe' }, 404, origen);
  }
};
