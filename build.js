// ============ Сборка автономного одного файла DRIFT-ARENA.html ============
// Запуск: npm run build:app
// Результат: DRIFT-ARENA.html — игра целиком в одном файле, работает по двойному
// клику (file://), без Node.js и без интернета.
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

(async ()=>{
  const t0 = Date.now();
  const result = await esbuild.build({
    entryPoints: ['js/main.js'],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['edge100', 'chrome100', 'firefox100', 'safari15'],
    charset: 'utf8',
    legalComments: 'none',
    write: false,
    logLevel: 'warning',
  });
  const js = result.outputFiles[0].text;

  const css = fs.readFileSync('css/style.css', 'utf8');
  let html = fs.readFileSync('index.html', 'utf8');

  // вырезаем ссылку на css и модуль — всё инлайнится
  html = html.replace(/\s*<link rel="stylesheet" href="\.\/css\/style\.css">/, '');
  html = html.replace(/\s*<link rel="manifest" href="\.\/manifest\.webmanifest">/, '');
  html = html.replace(/\s*<link rel="icon"[^>]*>/, '');
  html = html.replace(/\s*<script type="module" src="\.\/js\/main\.js"><\/script>/, '');
  html = html.replace(/\s*<script>[\s\S]*?serviceWorker[\s\S]*?<\/script>/, '');

  // ВАЖНО: только функции-заменители — иначе $-последовательности в бандле
  // (esbuild их оставляет) интерпретируются String.replace и ломают код.
  const style = '\n<style>\n' + css + '\n</style>';
  const script = '\n<script>\n' + js + '\n</script>';
  html = html.replace('</head>', ()=>style + '\n</head>');
  html = html.replace('</body>', ()=>script + '\n</body>');

  const out = path.join(process.cwd(), 'DRIFT-ARENA.html');
  fs.writeFileSync(out, html);
  const kb = (fs.statSync(out).size/1024).toFixed(0);
  console.log(`DRIFT-ARENA.html собран за ${Date.now()-t0} мс (${kb} КБ) — автономный, работает по двойному клику`);
})().catch(e=>{ console.error(e); process.exit(1); });
