// ================= Сборка DRIFT ARENA =================
// Запуск: npm run build:app
//
// Результат:
//  1) DRIFT-ARENA.html — вся игра в одном файле, работает по двойному
//     клику (file://) без Node.js и без интернета.
//  2) app/ — готовая папка для установки на Windows (INSTALL.bat):
//     index.html с инлайном CSS+JS (никакого npm install и node_modules),
//     свой server.js, service worker, иконки, лаунчеры и деинсталлятор.
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const { startBat, startVbs, uninstallBat, shortcutsVbs } = require('./tools/launchers.js');

(async () => {
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
  const source = fs.readFileSync('index.html', 'utf8');

  // html с инлайном CSS и JS.
  // pwa=true — оставляем манифест, иконки и регистрацию service worker
  //            (нужно для установки как приложение и офлайн-режима);
  // pwa=false — чистый одиночный файл, работающий с file://.
  function inline(html, pwa) {
    html = html.replace(/\s*<link rel="stylesheet" href="\.\/css\/style\.css">/, '');
    html = html.replace(/\s*<script type="module" src="\.\/js\/main\.js"><\/script>/, '');
    html = html.replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, '');
    if (!pwa) {
      html = html.replace(/\s*<link rel="manifest"[^>]*>/, '');
      html = html.replace(/\s*<link rel="icon"[^>]*>/, '');
      html = html.replace(/\s*<script>[\s\S]*?serviceWorker[\s\S]*?<\/script>/, '');
    }
    // ВАЖНО: только функции-заменители — иначе $-последовательности в бандле
    // (esbuild их оставляет) интерпретируются String.replace и ломают код.
    const style = '\n<style>\n' + css + '\n</style>';
    const script = '\n<script>\n' + js + '\n</script>';
    html = html.replace('</head>', () => style + '\n</head>');
    html = html.replace('</body>', () => script + '\n</body>');
    return html;
  }

  // ---------- 1. Один файл ----------
  const solo = path.join(process.cwd(), 'DRIFT-ARENA.html');
  fs.writeFileSync(solo, inline(source, false));
  const soloKb = (fs.statSync(solo).size / 1024).toFixed(0);

  // ---------- 2. Папка app/ для установщика ----------
  const app = path.join(process.cwd(), 'app');
  fs.rmSync(app, { recursive: true, force: true });
  fs.mkdirSync(app, { recursive: true });

  fs.writeFileSync(path.join(app, 'index.html'), inline(source, true));
  for (const f of ['manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable.png', 'server.js']) {
    fs.copyFileSync(f, path.join(app, f));
  }
  // service worker установленной версии: всё уже в одном index.html,
  // поэтому в кэш идёт только он сам, манифест и иконки.
  fs.writeFileSync(path.join(app, 'sw.js'),
    '// Service Worker DRIFT ARENA (установленная версия): офлайн-кэш.\n' +
    "const CACHE = 'drift-arena-app-v1';\n" +
    "const ASSETS = ['./', './index.html', './manifest.webmanifest'," +
    " './icon-192.png', './icon-512.png', './icon-maskable.png'];\n\n" +
    "self.addEventListener('install', (e)=>{\n" +
    '  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS).catch(()=>{})));\n' +
    '  self.skipWaiting();\n' +
    '});\n\n' +
    "self.addEventListener('activate', (e)=>{\n" +
    '  e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))));\n' +
    '  self.clients.claim();\n' +
    '});\n\n' +
    "self.addEventListener('fetch', (e)=>{\n" +
    '  const req = e.request;\n' +
    "  if(req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;\n" +
    '  e.respondWith(\n' +
    '    caches.match(req).then(hit=>{\n' +
    '      if(hit) return hit;\n' +
    '      return fetch(req).then(res=>{\n' +
    "        if(res && res.ok && res.type === 'basic'){\n" +
    '          const copy = res.clone();\n' +
    '          caches.open(CACHE).then(c=>c.put(req, copy));\n' +
    '        }\n' +
    '        return res;\n' +
    "      }).catch(()=>caches.match('./index.html'));\n" +
    '    })\n' +
    '  );\n' +
    '});\n');

  // лаунчеры: если Node.js нет — открываем тот же index.html напрямую
  fs.writeFileSync(path.join(app, 'START.bat'), startBat('index.html'));
  fs.writeFileSync(path.join(app, 'START.vbs'), startVbs('index.html'));
  fs.writeFileSync(path.join(app, 'UNINSTALL.bat'), uninstallBat());
  fs.writeFileSync(path.join(app, 'SHORTCUTS.vbs'), shortcutsVbs());

  const files = fs.readdirSync(app).sort();
  const appKb = files.reduce((s, f) => s + fs.statSync(path.join(app, f)).size, 0) / 1024;

  console.log(`DRIFT-ARENA.html собран за ${Date.now() - t0} мс (${soloKb} КБ) — автономный, работает по двойному клику`);
  console.log(`app/ собран (${appKb.toFixed(0)} КБ) для INSTALL.bat: ${files.join(', ')}`);
})().catch(e => { console.error(e); process.exit(1); });
