// Lista os textos tr('...') do frontend que ainda não têm tradução em src/i18n/en/ e src/i18n/es/.
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

// es/planos.js é a tabela dos textos dos planos, não um dicionário do tr().
async function dicionario(idioma) {
  const tudo = {}
  for (const f of fs.readdirSync(path.join(raiz, 'src/i18n', idioma))) {
    if (!['index.js', 'planos.js'].includes(f)) Object.assign(tudo, (await import(path.join(raiz, 'src/i18n', idioma, f))).default)
  }
  return tudo
}

const chaves = new Map()
for (const a of arquivos) {
  for (const m of fs.readFileSync(a, 'utf8').matchAll(/\btr\(\s*'((?:[^'\\]|\\.)*)'/g)) {
    const chave = m[1].replace(/\\'/g, "'").replace(/\\n/g, '\n').replace(/\\"/g, '"')
    if (!chaves.has(chave)) chaves.set(chave, path.relative(raiz, a))
  }
}
for (const idioma of ['en', 'es']) {
  const dic = await dicionario(idioma)
  const faltam = [...chaves].filter(([k]) => !(k in dic))
  console.log(`[${idioma}] textos: ${chaves.size} | faltam: ${faltam.length}`)
  for (const [k, arquivo] of faltam) console.log(JSON.stringify(k), '|', arquivo)
}
