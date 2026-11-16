// Planos do freemium (2026-11): o "Individual" vira "Basic" (R$ 99, até 5 profissionais, sem recepção nem repasses),
// a lista de recursos dos planos fica completa e o teste grátis passa a ter 14 dias (depois dele, plano Grátis).
// Rodar NO SERVIDOR (o plano em dólar renomeia o produto no Stripe, e a chave do Stripe só existe lá):
//   docker exec sonelia node scripts/planosBasicEGratis.js           -> só mostra o que vai mudar
//   docker exec sonelia node scripts/planosBasicEGratis.js --aplicar -> grava
import 'dotenv/config'
import mongoose from 'mongoose'
import db from '../src/db/db.js'
import PlanoModel from '../src/modules/plano/plano.model.js'
import { PlanoService } from '../src/modules/plano/plano.service.js'

const APLICAR = process.argv.includes('--aplicar')

const RECURSOS_BRL = {
    comuns: [
        'Agenda',
        'Pacientes (cadastro sem limite)',
        'Prontuário eletrônico com a Jornada do paciente',
        'Anamneses',
        'Termo de consentimento (TCLE) com assinatura digital',
        'Convênios',
        'Avaliação neuropsicológica e NR-01',
        'Lista de espera',
        'Chamada de pacientes na TV da sala de espera',
        'Agenda de reuniões',
    ],
    basic: ['Até 5 profissionais'],
    pro: [
        'Cadastro de profissionais sem limite',
        'Recepção com login próprio',
        'Repasse financeiro para os colaboradores',
        'Lembrete de consulta pelo WhatsApp (em breve)',
    ],
}

const RECURSOS_USD = {
    comuns: [
        'Scheduling',
        'Patients (unlimited)',
        'Electronic health records with the patient journey',
        'Intake forms',
        'Informed consent forms (e-signature)',
        'Insurance plans',
        'Neuropsychological assessment',
        'Waiting list',
        'Waiting room TV calling',
        'Meetings schedule',
    ],
    basic: ['Up to 5 practitioners'],
    pro: [
        'Unlimited practitioners',
        'Front desk with its own login',
        'Payouts for team members',
        'WhatsApp appointment reminders (coming soon)',
    ],
}

async function alterar(plano, mudancas) {
    const antes = Object.fromEntries(Object.keys(mudancas).map((k) => [k, plano[k]]))
    console.log(`\n${plano.nome} (${plano.moeda ?? 'BRL'}, ${plano._id})`)
    console.log('  antes: ', JSON.stringify(antes))
    console.log('  depois:', JSON.stringify(mudancas))
    if (APLICAR) await PlanoService.updatePlano(plano._id, mudancas)
}

async function rodar() {
    await db()
    const planos = await PlanoModel.find({ ativo: true })

    for (const plano of planos) {
        const usd = plano.moeda === 'USD'
        const R = usd ? RECURSOS_USD : RECURSOS_BRL
        if (plano.tipo === 'gratis') {
            await alterar(plano, { duracaoDiasTrial: 14 })
        } else if (plano.individual) {
            await alterar(plano, {
                nome: 'Basic',
                ...(usd ? {} : { preco: 99 }),
                descricao: usd ? 'For solo practitioners and small teams' : 'Para quem atende sozinho ou com uma equipe pequena',
                recursos: [...R.comuns, ...R.basic],
            })
        } else {
            await alterar(plano, {
                descricao: usd ? 'For clinics with a front desk and a team' : 'Para clínicas com recepção e equipe',
                recursos: [...R.comuns, ...R.pro],
            })
        }
    }

    console.log(APLICAR ? '\nPlanos atualizados.' : '\nNada foi gravado. Rode com --aplicar para gravar.')
    await mongoose.disconnect()
}

rodar().catch(async (erro) => {
    console.error(erro)
    await mongoose.disconnect()
    process.exit(1)
})
