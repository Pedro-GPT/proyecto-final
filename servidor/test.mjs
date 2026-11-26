// Pruebas con el motor real de Workers y una base D1 local en memoria: npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';

const ORIGEN = 'https://pedro-gpt.github.io';
let mf;
const tiempo = (n, ms, origen = ORIGEN) => mf.dispatchFetch('http://w.test/tiempo', { method: 'POST', headers: { 'Content-Type': 'text/plain', Origin: origen }, body: JSON.stringify({ n, ms }) });
const ver = async (n = '') => (await mf.dispatchFetch('http://w.test/ranking?n=' + encodeURIComponent(n), { headers: { Origin: ORIGEN } })).json();

before(async () => {
  mf = new Miniflare({ modules: true, scriptPath: 'src/index.js', compatibilityDate: '2026-07-01', d1Databases: ['DB'], bindings: { ALLOWED_ORIGINS: ORIGEN } });
  await (await mf.getD1Database('DB')).exec(readFileSync('schema.sql', 'utf8').replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim());
});
after(() => mf.dispose());

test('dos personas en dispositivos distintos comparten ranking', async () => {
  assert.equal((await tiempo('Hermano', 60000)).status, 200);
  const r = await (await tiempo('Pedro', 45000)).json();
  assert.deepEqual(r.ranking.map(x => x.nombre), ['Pedro', 'Hermano']);
  assert.deepEqual([r.yo.puesto, r.total], [1, 2]);
  assert.equal((await ver('hermano')).yo.puesto, 2);
});
test('el mismo nombre se queda con su mejor tiempo', async () => {
  await tiempo('PEDRO', 90000);
  let r = await ver('Pedro'); assert.deepEqual([r.yo.ms, r.yo.nombre, r.total], [45000, 'Pedro', 2]);
  await tiempo('pedro', 30000);
  r = await ver('Pedro'); assert.deepEqual([r.yo.ms, r.yo.nombre], [30000, 'pedro']);
});
test('rechaza datos raros y otros orígenes', async () => {
  for (const [n, ms] of [['', 50000], ['x'.repeat(17), 50000], ['Ana', 500], ['Ana', 'abc'], ['Ana', 9e9]]) assert.equal((await tiempo(n, ms)).status, 400);
  assert.equal((await tiempo('Ana', 50000, 'https://otro.com')).status, 403);
  assert.equal((await ver()).total, 2);
});
test('solo enseña los 10 mejores', async () => {
  for (let i = 0; i < 12; i++) await tiempo('Jugador ' + i, 100000 + i);
  const r = await ver('Jugador 11'); assert.equal(r.ranking.length, 10); assert.deepEqual([r.yo.puesto, r.total], [14, 14]);
});
