/**
 * Génère les images de démonstration (produits, logos des fournisseurs, icônes de l'application) avec Chromium.
 * Les images produites sont versionnées : ce script ne sert qu'à les refaire.
 *
 *   cd frontend && node ../backend/database/seeders/demo-images/generate.cjs
 */
const path = require('path')
const { createRequire } = require('module')
const fs = require('fs')

const frontend = path.resolve(__dirname, '../../../../frontend')
const { chromium } = createRequire(path.join(frontend, 'package.json'))('@playwright/test')

const OUT = __dirname
const PALETTES = {
  emballage: ['#ffecd2', '#fcb69f'],
  logistique: ['#fde2c8', '#f6a880'],
  btp: ['#f6d365', '#fda085'],
  informatique: ['#a1c4fd', '#c2e9fb'],
  bureau: ['#d4fc79', '#96e6a1'],
  agro: ['#fff1a8', '#f9c27c'],
  textile: ['#fbc2eb', '#a6c1ee'],
  services: ['#e0c3fc', '#8ec5fc'],
  industrie: ['#cfd9df', '#a8c0d6'],
  electricite: ['#fff6b7', '#f6d26b'],
}

// [fichier, emoji, palette] — le seeder associe chaque produit à son fichier.
const PRODUCTS = [
  ['cartons-ondules', '📦', 'emballage'], ['boites-pliantes', '🎁', 'emballage'], ['film-etirable', '🧻', 'emballage'],
  ['palettisation', '🏭', 'logistique'], ['palettes-bois', '🪵', 'logistique'], ['sacs-kraft', '🛍️', 'emballage'],
  ['palettes-plastique', '🗃️', 'logistique'], ['transport-palettes', '🚚', 'logistique'], ['huile-olive', '🫒', 'agro'],
  ['fromage-frais', '🧀', 'agro'], ['maintenance-informatique', '🧰', 'informatique'], ['application-metier', '📱', 'informatique'],
  ['serveur-rack', '🖥️', 'informatique'], ['cables-electriques', '🔌', 'electricite'], ['tableau-electrique', '⚡', 'electricite'],
  ['etiqueteuse', '🏷️', 'industrie'], ['maintenance-lignes', '🔧', 'industrie'],
  ['ciment', '🏗️', 'btp'], ['rond-a-beton', '🔩', 'btp'], ['tubes-ppr', '🚰', 'btp'], ['beton-pret', '🚧', 'btp'],
  ['ordinateur-portable', '💻', 'informatique'], ['imprimante-laser', '🖨️', 'informatique'], ['switch-reseau', '🌐', 'informatique'],
  ['ramette-papier', '📄', 'bureau'], ['fauteuil-bureau', '🪑', 'bureau'], ['toner', '🖋️', 'bureau'], ['classeurs', '🗂️', 'bureau'],
  ['dattes', '🌴', 'agro'], ['semoule', '🌾', 'agro'],
  ['gilets-haute-visibilite', '🦺', 'textile'], ['tenue-travail', '👷', 'textile'], ['tissu-coton', '🧵', 'textile'],
  ['audit-comptable', '📊', 'services'], ['contrats-commerciaux', '⚖️', 'services'], ['formation-securite', '🎓', 'services'],
  ['nettoyage-bureaux', '🧽', 'services'], ['gardiennage', '🛡️', 'services'],
  ['roulements', '⚙️', 'industrie'], ['compresseur', '🛠️', 'industrie'],
  ['stockage-entrepot', '🏬', 'logistique'], ['chariot-elevateur', '🚜', 'logistique'],
]

// [fichier, initiales, couleur 1, couleur 2]
const LOGOS = [
  ['atlas', 'AE', '#5b4bdb', '#8b7cf0'], ['djerba-pack', 'DP', '#0a8fd6', '#45b8f0'], ['palettesplus', 'P+', '#12a06b', '#3fcf95'],
  ['oliveraie', 'OS', '#6b8e23', '#a4c639'], ['technova', 'TN', '#14142b', '#4a4a7a'], ['electrosud', 'ES', '#f58a3d', '#f7b267'],
  ['mecapro', 'MP', '#5f6078', '#9a9bb5'], ['batisud', 'BS', '#c2410c', '#f97316'], ['infostore', 'IS', '#1d4ed8', '#60a5fa'],
  ['bureauplus', 'B+', '#0f766e', '#2dd4bf'], ['oasis', 'OD', '#b45309', '#fbbf24'], ['textilpro', 'TP', '#be185d', '#f472b6'],
  ['fidus', 'FC', '#4338ca', '#818cf8'], ['pronet', 'PN', '#0369a1', '#38bdf8'],
]

const page = (body, w, h) => `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;font-family:'Segoe UI',Inter,Arial,sans-serif}
</style></head><body>${body}</body></html>`

function productHtml(emoji, [from, to]) {
  return page(`
    <div style="position:relative;width:800px;height:600px;background:linear-gradient(135deg,${from},${to})">
      <div style="position:absolute;width:420px;height:420px;border-radius:50%;background:rgba(255,255,255,.35);left:190px;top:90px"></div>
      <div style="position:absolute;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.25);left:40px;top:380px"></div>
      <div style="position:absolute;width:110px;height:110px;border-radius:50%;background:rgba(255,255,255,.3);left:640px;top:50px"></div>
      <div style="position:absolute;inset:0;display:grid;place-items:center;font-size:250px;line-height:1;
        font-family:'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif;filter:drop-shadow(0 24px 30px rgba(20,20,43,.25))">${emoji}</div>
    </div>`, 800, 600)
}

function logoHtml(initials, from, to) {
  return page(`
    <div style="width:256px;height:256px;border-radius:56px;background:linear-gradient(135deg,${from},${to});display:grid;place-items:center;
      color:#fff;font-weight:800;font-size:104px;letter-spacing:-4px">${initials}</div>`, 256, 256)
}

function iconHtml(size, padded) {
  const svg = fs.readFileSync(path.join(frontend, 'public/favicon.svg'), 'utf8')
  const inner = padded ? Math.round(size * 0.7) : size
  return page(`
    <div style="width:${size}px;height:${size}px;display:grid;place-items:center;background:${padded ? '#5b4bdb' : 'transparent'}">
      <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div>
    </div>`, size, size)
}

;(async () => {
  const browser = await chromium.launch()
  const shot = async (html, w, h, file, type = 'png') => {
    const p = await browser.newPage({ viewport: { width: w, height: h } })
    await p.setContent(html)
    await p.screenshot({ path: file, type, ...(type === 'jpeg' ? { quality: 82 } : { omitBackground: true }) })
    await p.close()
  }

  fs.mkdirSync(path.join(OUT, 'products'), { recursive: true })
  fs.mkdirSync(path.join(OUT, 'logos'), { recursive: true })

  for (const [file, emoji, palette] of PRODUCTS) {
    await shot(productHtml(emoji, PALETTES[palette]), 800, 600, path.join(OUT, 'products', `${file}.jpg`), 'jpeg')
  }
  for (const [file, initials, from, to] of LOGOS) {
    await shot(logoHtml(initials, from, to), 256, 256, path.join(OUT, 'logos', `${file}.png`))
  }

  const icons = path.join(frontend, 'public/icons')
  await shot(iconHtml(192, false), 192, 192, path.join(icons, 'icon-192.png'))
  await shot(iconHtml(512, false), 512, 512, path.join(icons, 'icon-512.png'))
  await shot(iconHtml(512, true), 512, 512, path.join(icons, 'maskable-512.png'))
  await shot(iconHtml(180, true), 180, 180, path.join(icons, 'apple-touch-icon.png'))

  await browser.close()
  console.log(`${PRODUCTS.length} produits, ${LOGOS.length} logos, 4 icônes générés.`)
})()
