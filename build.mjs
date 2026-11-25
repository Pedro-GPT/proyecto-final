// npm install && npm run build  ->  index.html (juego + personaje + Three.js; las preguntas van en preguntas.js)
import { build } from 'esbuild'; import fs from 'fs';
const r = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, write: false, format: 'iife', charset: 'utf8', loader: { '.glb': 'binary' } });
const js = r.outputFiles[0].text.replaceAll('</script', '<\\/script');
fs.writeFileSync('index.html', fs.readFileSync('src/plantilla.html', 'utf8').replace('/*JUEGO*/', () => js));
