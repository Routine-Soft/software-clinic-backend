// Planos com WhatsApp (2026-11): o campo `individual` vira `nivel` (basic/pro/rede), nasce o plano Rede (R$ 690,
// até 100 profissionais) e os preços em reais sobem: Basic R$ 129 e Pro R$ 249. Quem já assina continua com o preço
// antigo (o updatePlano grava o `precoTravado` dessas assinaturas). Planos em dólar ficam como estão.
// Rodar NO SERVIDOR, depois do deploy:
//   docker exec <container> node scripts/planosRedeENivel.js           -> só mostra o que vai mudar
//   docker exec <container> node scripts/planosRedeENivel.js --aplicar -> grava
import 'dotenv/config'
import mongoose from 'mongoose'
import db from '../src/db/db.js'
import PlanoModel from '../src/modules/plano/plano.model.js'
import { PlanoService } from '../src/modules/plano/plano.service.js'

const APLICAR = process.argv.includes('--aplicar')
const PRECOS_BRL = { basic: 129, pro: 249 }

await db()
const colecao = mongoose.connection.db.collection('planos')

// 1. individual -> nivel (direto na coleção: o modelo já não conhece `individual`).
for (const p of await colecao.find({ tipo: 'pago' }).toArray()) {
    const nivel = p.nivel ?? (p.individual ? 'basic' : 'pro')
    console.log(`${p.nome} (${p.moeda ?? 'BRL'}): nivel = ${nivel}`)
    if (APLICAR) await colecao.updateOne({ _id: p._id }, { $set: { nivel }, $unset: { individual: '' } })
}

// 2. Preços novos em reais (só sobe; o aumento trava o preço antigo de quem já assina).
for (const [nivel, preco] of Object.entries(PRECOS_BRL)) {
    // Na simulação o `nivel` ainda não foi gravado: acha pelo `individual` antigo.
    const plano = await colecao.findOne({
        tipo: 'pago', ativo: true, moeda: { $ne: 'USD' },
        $or: [{ nivel }, { nivel: { $exists: false }, individual: nivel === 'basic' ? true : { $ne: true } }],
    })
    if (!plano) { console.log(`Sem plano ${nivel} em reais`); continue }
    console.log(`${plano.nome}: R$ ${plano.preco} -> R$ ${preco}`)
    if (APLICAR && preco > plano.preco) await PlanoService.updatePlano(plano._id, { preco })
}

// 3. Plano Rede em reais.
if (await PlanoModel.exists({ tipo: 'pago', nivel: 'rede', moeda: { $ne: 'USD' } })) {
    console.log('Plano Rede já existe')
} else {
    console.log('Criar: Rede, R$ 690, até 100 profissionais')
    if (APLICAR) {
        await PlanoService.createPlano({ nome: 'Rede', tipo: 'pago', preco: 690, nivel: 'rede', moeda: 'BRL', descricao: 'Para redes e clínicas grandes, com implantação assistida' })
    }
}

if (APLICAR) {
    const travadas = await mongoose.connection.db.collection('assinaturas').find({ precoTravado: { $ne: null } }, { projection: { tenantId: 1, precoTravado: 1 } }).toArray()
    console.log(`Assinaturas com preço travado: ${travadas.map((a) => `${a.tenantId} (R$ ${a.precoTravado.valor})`).join(', ') || 'nenhuma'}`)
}
console.log(APLICAR ? '\nPlanos atualizados.' : '\nNada foi gravado. Rode com --aplicar para gravar.')
await mongoose.disconnect()
