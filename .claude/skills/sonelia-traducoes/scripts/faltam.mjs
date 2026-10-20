// Lista os textos tr('...') do frontend que ainda não têm tradução em src/i18n/en/.
// Uso: node faltam.mjs <pasta-do-frontend> [arquivos...]   (sem arquivos = todo o src)
import fs from 'node:fs'
import path from 'node:path'

const raiz = path.resolve(process.argv[2] ?? '.')
let arquivos = process.argv.slice(3)
if (arquivos.length === 0) {
  const andar = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name)
    if (e.isDirectory()) return p.includes(`${path.sep}i18n`) ? [] : andar(p)
    return /\.jsx?$/.test(e.name) ? [p] : []
  })
  arquivos = andar(path.join(raiz, 'src'))
}

const en = {}
for (const f of fs.readdirSync(path.join(raiz, 'src/i18n/en'))) {
  if (f !== 'index.js') Object.assign(en, (await import(path.join(raiz, 'src/i18n/en', f))).default)
}

const chaves = new Map()
for (const a of arquivos) {
  for (const m of fs.readFileSync(a, 'utf8').matchAll(/\btr\(\s*'((?:[^'\\]|\\.)*)'/g)) {
    const chave = m[1].replace(/\\'/g, "'").replace(/\\n/g, '\n').replace(/\\"/g, '"')
    if (!chaves.has(chave)) chaves.set(chave, path.relative(raiz, a))
  }
}
const faltam = [...chaves].filter(([k]) => !(k in en))
console.log(`textos: ${chaves.size} | faltam: ${faltam.length}`)
for (const [k, arquivo] of faltam) console.log(JSON.stringify(k), '|', arquivo)
