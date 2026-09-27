import mongoose from 'mongoose'
import { randomUUID } from 'node:crypto'
import { PreApproval } from 'mercadopago'
import { getMpClient } from '../../config/mercadopago.js'
import AssinaturaModel from './assinatura.model.js'
import PagamentoModel from './pagamento.model.js'
import { interpretarDocumento } from './documento.js'
import PlanoModel from '../plano/plano.model.js'
import UserModel from '../user/user.model.js'
import AppError from '../../errors/AppError.js'

// MP_API_URL existe só para apontar os testes automatizados para um Mercado Pago falso.
const MP_API = process.env.MP_API_URL || 'https://api.mercadopago.com'

// Frontend usa HashRouter: a rota de retorno fica depois do "#".
// O Mercado Pago acrescenta "?preapproval_id=..." ao final dessa URL.
// Atenção: ele recusa "localhost" como back_url, mas aceita 127.0.0.1 (por isso o padrão de desenvolvimento).
function urlDeRetorno() {
    const base = (process.env.APP_URL || 'http://127.0.0.1:5173').replace(/\/+$/, '')
    return `${base}/#/assinatura/retorno`
}

// Erros do Mercado Pago chegam com mensagens técnicas em inglês; troca as mais comuns por algo acionável.
function traduzirErroMercadoPago(error, acao = 'iniciar o pagamento') {
    const mensagem = error?.message ?? ''

    // A assinatura foi criada por outra conta do Mercado Pago (ex.: criada com credenciais de teste e o servidor agora usa as de produção).
    if (mensagem.includes('not authorized')) {
        return new AppError('O Mercado Pago não autorizou esta operação: a assinatura pertence a outra conta (credenciais diferentes das atuais). Fale com o suporte.', 502)
    }

    if (mensagem.includes('payer and collector must be real or test users')) {
        const dica = process.env.NODE_ENV === 'production'
            ? ''
            : ' No ambiente de teste, defina MP_TEST_PAYER_EMAIL no .env com o e-mail de um usuário comprador de teste.'
        return new AppError(`O e-mail do pagador não corresponde a uma conta do Mercado Pago.${dica}`, 400)
    }

    if (mensagem.includes('back_url')) {
        return new AppError('URL de retorno do Mercado Pago inválida. Confira a variável APP_URL no .env.', 500)
    }

    return new AppError(`Não foi possível ${acao} no Mercado Pago: ${mensagem || 'erro desconhecido'}`, 502)
}

async function buscarNoMercadoPago(caminho) {
    const response = await fetch(`${MP_API}${caminho}`, {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    })

    if (!response.ok) {
        throw new AppError(`Não foi possível consultar o Mercado Pago (${response.status})`, 502)
    }

    return await response.json()
}

// Chamada com corpo/idempotência (criar e cancelar pagamentos). Em caso de erro, a mensagem inclui o detalhe que o Mercado Pago envia.
async function chamarMercadoPago(metodo, caminho, { corpo, idempotencyKey } = {}) {
    const resposta = await fetch(`${MP_API}${caminho}`, {
        method: metodo,
        headers: {
            Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
            ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
        },
        body: corpo ? JSON.stringify(corpo) : undefined,
        signal: AbortSignal.timeout(15000),
    })

    const dados = await resposta.json().catch(() => ({}))
    if (!resposta.ok) {
        const detalhes = Array.isArray(dados.cause) ? dados.cause.map((c) => c.description).filter(Boolean) : []
        const erro = new Error([dados.message, ...detalhes].filter(Boolean).join(' — ') || `HTTP ${resposta.status}`)
        erro.status = resposta.status
        throw erro
    }

    return dados
}

// Pix avulso: quanto tempo o QR Code vale e quantos dias de acesso cada pagamento libera.
export const PIX_VALIDADE_MINUTOS = 60
export const PIX_DIAS_DE_ACESSO = 30

// O Mercado Pago quer a expiração com fuso, no formato 2026-09-28T10:00:00.000-03:00 (horário de Brasília).
function expiracaoComFuso(data) {
    return new Date(data.getTime() - 3 * 60 * 60 * 1000).toISOString().replace('Z', '-03:00')
}

function dataBR(data) {
    return new Date(data).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

// Situação do Pix no Mercado Pago -> situação interna. QR Code vencido chega como "cancelled" com detalhe "expired".
function situacaoDoPix(payment) {
    switch (payment.status) {
        case 'approved':
            return 'aprovado'
        case 'rejected':
            return 'rejeitado'
        case 'cancelled':
            return payment.status_detail === 'expired' ? 'expirado' : 'cancelado'
        default:
            return 'pendente'
    }
}

function pagamentoParaDTO(pagamento) {
    if (!pagamento) return null
    return {
        id: pagamento._id,
        status: pagamento.status,
        valor: pagamento.valor,
        qrCode: pagamento.qrCode,
        qrCodeBase64: pagamento.qrCodeBase64,
        expiraEm: pagamento.expiraEm,
        aprovadoEm: pagamento.aprovadoEm,
        planoId: pagamento.planoId,
    }
}

// Dias de tolerância para quem está com o pagamento em atraso antes de perder o acesso.
export const DIAS_DE_TOLERANCIA_INADIMPLENTE = 5

const DIA_EM_MS = 24 * 60 * 60 * 1000

// Regra de bloqueio do sistema. Só olha datas e status, sem gravar nada.
//  - trial: acesso até o fim do teste
//  - pendente: quem clicou em "assinar" durante o teste continua no teste até ele acabar
//  - ativa: acesso liberado (se foi paga por Pix, só até o fim do período pago)
//  - cancelada: acesso até o fim do período que já foi pago (proximaCobranca)
//  - inadimplente: tolerância de alguns dias a partir do atraso
//  - expirada: bloqueado
export function avaliarAcesso(assinatura, agora = new Date()) {
    if (!assinatura) {
        return { liberado: false, motivo: 'Esta clínica não possui assinatura. Entre em contato com o suporte.', ate: null }
    }

    const noFuturo = (data) => !!data && new Date(data) > agora

    switch (assinatura.status) {
        case 'ativa':
            // Pix não renova sozinho: vale até proximaCobranca, depois disso é preciso pagar de novo.
            if (assinatura.cobranca === 'pix') {
                return noFuturo(assinatura.proximaCobranca)
                    ? { liberado: true, motivo: null, ate: assinatura.proximaCobranca }
                    : { liberado: false, motivo: 'O período pago por Pix terminou. Renove o pagamento para continuar usando o sistema.', ate: null }
            }
            return { liberado: true, motivo: null, ate: null }

        case 'trial':
            return noFuturo(assinatura.dataFimTrial)
                ? { liberado: true, motivo: null, ate: assinatura.dataFimTrial }
                : { liberado: false, motivo: 'O período de teste terminou. Assine um plano para continuar usando o sistema.', ate: null }

        case 'pendente':
            return noFuturo(assinatura.dataFimTrial)
                ? { liberado: true, motivo: null, ate: assinatura.dataFimTrial }
                : { liberado: false, motivo: 'Estamos aguardando a confirmação do seu pagamento. O acesso é liberado assim que ele for aprovado.', ate: null }

        case 'cancelada':
            return noFuturo(assinatura.proximaCobranca)
                ? { liberado: true, motivo: null, ate: assinatura.proximaCobranca }
                : { liberado: false, motivo: 'A assinatura foi cancelada. Assine novamente para voltar a usar o sistema.', ate: null }

        case 'inadimplente': {
            const desde = assinatura.inadimplenteDesde ?? assinatura.updatedAt ?? agora
            const limite = new Date(new Date(desde).getTime() + DIAS_DE_TOLERANCIA_INADIMPLENTE * DIA_EM_MS)
            return limite > agora
                ? { liberado: true, motivo: null, ate: limite }
                : { liberado: false, motivo: 'Não conseguimos processar o pagamento da assinatura. Regularize para voltar a usar o sistema.', ate: null }
        }

        default:
            return { liberado: false, motivo: 'A assinatura está inativa. Assine um plano para continuar usando o sistema.', ate: null }
    }
}

// Traduz o estado da assinatura recorrente do Mercado Pago para o estado interno.
// "pending" (aguardando o pagador concluir) mantém "pendente".
export function aplicarStatusPreapproval(assinatura, preapproval) {
    if (preapproval.status === 'authorized') {
        assinatura.status = 'ativa'
        assinatura.cobranca = 'recorrente'
        assinatura.inadimplenteDesde = null
        if (preapproval.next_payment_date) assinatura.proximaCobranca = new Date(preapproval.next_payment_date)
    } else if (preapproval.status === 'cancelled') {
        // Mantém proximaCobranca: é até quando o cliente já pagou e ainda tem acesso.
        assinatura.status = 'cancelada'
    } else if (preapproval.status === 'paused') {
        if (assinatura.status !== 'inadimplente') assinatura.inadimplenteDesde = new Date()
        assinatura.status = 'inadimplente'
    }

    return assinatura
}

export const AssinaturaService = {

    async criarAssinaturaTrial(tenantId) {
        const planoGratis = await PlanoModel.findOne({ tipo: 'gratis', ativo: true })
        if (!planoGratis) {
            throw new AppError('Plano gratuito não configurado', 500)
        }

        const dataInicio = new Date()
        const dataFimTrial = new Date(dataInicio)
        dataFimTrial.setDate(dataFimTrial.getDate() + (planoGratis.duracaoDiasTrial || 15))

        return await AssinaturaModel.create({
            tenantId,
            planoId: planoGratis._id,
            status: 'trial',
            dataInicio,
            dataFimTrial,
        })
    },

    async obterAssinaturaAtual(tenantId) {
        let assinatura = await AssinaturaModel.findOne({ tenantId }).sort({ createdAt: -1 }).populate('planoId')

        // Clínica sem registro de assinatura (apagado à mão, ou conta anterior ao plano gratuito): recria como "expirada",
        // sem conceder um novo período de teste, para que ela consiga escolher um plano e assinar.
        if (!assinatura) {
            const planoGratis = await PlanoModel.findOne({ tipo: 'gratis', ativo: true })
            if (!planoGratis) {
                throw new AppError('Plano gratuito não configurado', 500)
            }

            const agora = new Date()
            await AssinaturaModel.findOneAndUpdate(
                { tenantId },
                { $setOnInsert: { planoId: planoGratis._id, status: 'expirada', dataInicio: agora, dataFimTrial: agora } },
                { upsert: true }
            )
            assinatura = await AssinaturaModel.findOne({ tenantId }).sort({ createdAt: -1 }).populate('planoId')
        }

        // Teste ou período pago por Pix que passou do prazo vira "expirada" na primeira consulta depois do vencimento.
        const vencidoTrial = assinatura.status === 'trial' && assinatura.dataFimTrial && assinatura.dataFimTrial < new Date()
        const vencidoPix = assinatura.status === 'ativa' && assinatura.cobranca === 'pix' && assinatura.proximaCobranca && assinatura.proximaCobranca < new Date()
        if (vencidoTrial || vencidoPix) {
            assinatura.status = 'expirada'
            await assinatura.save()
        }

        return assinatura
    },

    async verificarAcesso(tenantId) {
        const assinatura = await AssinaturaModel.findOne({ tenantId }).sort({ createdAt: -1 })
        return avaliarAcesso(assinatura)
    },

    // Cancela a cobrança recorrente no Mercado Pago. O cliente mantém o acesso até o fim do período já pago.
    // Se ainda não tinha pago nada (checkout pendente), volta ao teste em vez de ficar sem nada.
    async cancelarAssinatura(tenantId) {
        const assinatura = await AssinaturaModel.findOne({ tenantId }).sort({ createdAt: -1 })
        if (assinatura?.status === 'ativa' && assinatura.cobranca === 'pix') {
            throw new AppError(`Assinaturas pagas por Pix não renovam sozinhas, então não há o que cancelar. O acesso continua até ${dataBR(assinatura.proximaCobranca)}.`, 400)
        }
        if (!assinatura || !['ativa', 'pendente', 'inadimplente'].includes(assinatura.status) || !assinatura.mercadoPagoPreapprovalId) {
            throw new AppError('Não há uma assinatura paga para cancelar', 400)
        }

        try {
            await new PreApproval(getMpClient()).update({ id: assinatura.mercadoPagoPreapprovalId, body: { status: 'cancelled' } })
        } catch (error) {
            throw traduzirErroMercadoPago(error, 'cancelar a assinatura')
        }

        if (assinatura.status === 'pendente') {
            const planoGratis = await PlanoModel.findOne({ tipo: 'gratis', ativo: true })
            const testeVigente = assinatura.dataFimTrial && assinatura.dataFimTrial > new Date()
            assinatura.status = testeVigente ? 'trial' : 'expirada'
            if (planoGratis) assinatura.planoId = planoGratis._id
            assinatura.mercadoPagoPreapprovalId = null
        } else {
            assinatura.status = 'cancelada'
            assinatura.inadimplenteDesde = null
        }

        await assinatura.save()
        return await this.obterAssinaturaAtual(tenantId)
    },

    // Plano escolhido pelo cliente; sem escolha, mantém o plano pago que a assinatura já tem (ex.: "refazer pagamento")
    // ou, na falta dele, o plano pago ativo mais barato.
    async escolherPlanoPago(assinatura, planoId) {
        if (planoId) {
            const plano = mongoose.isValidObjectId(planoId)
                ? await PlanoModel.findOne({ _id: planoId, tipo: 'pago', ativo: true })
                : null
            if (!plano) {
                throw new AppError('Plano não encontrado ou indisponível para assinatura', 404)
            }
            return plano
        }

        const atual = assinatura.planoId
        if (atual?.tipo === 'pago' && atual.ativo) return atual

        const plano = await PlanoModel.findOne({ tipo: 'pago', ativo: true }).sort({ preco: 1 })
        if (!plano) {
            throw new AppError('Plano pago não configurado', 500)
        }
        return plano
    },

    async iniciarCheckoutPago(tenantId, planoId) {
        const admin = await UserModel.findById(tenantId)
        if (!admin) {
            throw new AppError('Clínica não encontrada', 404)
        }

        const assinatura = await this.obterAssinaturaAtual(tenantId)
        if (assinatura.status === 'ativa') {
            if (assinatura.cobranca === 'pix') {
                throw new AppError(`Seu período pago por Pix está ativo até ${dataBR(assinatura.proximaCobranca)}. Quando ele terminar, você poderá assinar no cartão ou renovar por Pix.`, 409)
            }
            throw new AppError('Esta clínica já possui uma assinatura ativa. Para trocar de plano, cancele a assinatura atual antes.', 409)
        }

        const planoPago = await this.escolherPlanoPago(assinatura, planoId)

        const body = {
            reason: `Assinatura SoftwareClinic - ${planoPago.nome}`,
            external_reference: assinatura._id.toString(),
            // No ambiente de teste do Mercado Pago o pagador precisa ser um usuário de teste (comprador).
            // MP_TEST_PAYER_EMAIL permite testar sem mudar o e-mail da clínica; em produção fica vazio.
            payer_email: process.env.MP_TEST_PAYER_EMAIL || admin.email,
            auto_recurring: {
                frequency: 1,
                frequency_type: 'months',
                transaction_amount: planoPago.preco,
                currency_id: 'BRL',
            },
            back_url: urlDeRetorno(),
        }

        // Só há como o Mercado Pago avisar (webhook) se o backend estiver em uma URL pública.
        if (process.env.APP_URL_BACKEND) {
            body.notification_url = `${process.env.APP_URL_BACKEND.replace(/\/+$/, '')}/api/assinaturas/webhook`
        }

        let result
        try {
            result = await new PreApproval(getMpClient()).create({ body })
        } catch (error) {
            throw traduzirErroMercadoPago(error)
        }

        // Quem estava inadimplente ainda tem uma cobrança recorrente pausada no Mercado Pago; ela é encerrada
        // para não ficar uma assinatura antiga viva ao lado da nova (falhas aqui não impedem a nova assinatura).
        if (assinatura.status === 'inadimplente' && assinatura.mercadoPagoPreapprovalId) {
            await new PreApproval(getMpClient())
                .update({ id: assinatura.mercadoPagoPreapprovalId, body: { status: 'cancelled' } })
                .catch(() => null)
        }

        assinatura.planoId = planoPago._id
        assinatura.status = 'pendente'
        assinatura.inadimplenteDesde = null
        assinatura.mercadoPagoPreapprovalId = result.id
        await assinatura.save()

        return { url: result.init_point }
    },

    // Consulta o Mercado Pago e atualiza o status. Usa o id guardado no banco (nunca um id vindo do cliente),
    // então serve tanto para a volta do checkout quanto para o botão "verificar pagamento".
    async sincronizarAssinatura(tenantId) {
        const assinatura = await AssinaturaModel.findOne({ tenantId }).sort({ createdAt: -1 })
        if (!assinatura) {
            throw new AppError('Assinatura não encontrada', 404)
        }

        if (assinatura.mercadoPagoPreapprovalId) {
            const preapproval = await buscarNoMercadoPago(`/preapproval/${assinatura.mercadoPagoPreapprovalId}`)
            aplicarStatusPreapproval(assinatura, preapproval)
            await assinatura.save()
        }

        return await this.obterAssinaturaAtual(tenantId)
    },

    // Gera um Pix (QR Code + "copia e cola") para pagar um período de acesso do plano escolhido.
    async iniciarPagamentoPix(tenantId, planoId, documento) {
        const admin = await UserModel.findById(tenantId)
        if (!admin) {
            throw new AppError('Clínica não encontrada', 404)
        }

        const pagador = interpretarDocumento(documento)
        if (!pagador) {
            throw new AppError('Informe um CPF ou CNPJ válido de quem vai pagar o Pix', 400)
        }

        // Se um Pix anterior foi pago e ainda não foi confirmado, confirma antes de gerar outro.
        await this.confirmarPixPendente(tenantId).catch(() => null)
        const assinatura = await this.obterAssinaturaAtual(tenantId)

        if (assinatura.status === 'ativa' && assinatura.cobranca !== 'pix') {
            throw new AppError('Sua assinatura no cartão está ativa e renova sozinha. Para pagar por Pix, cancele a assinatura no cartão antes.', 409)
        }
        if (assinatura.status === 'pendente') {
            throw new AppError('Há um pagamento no cartão aguardando confirmação. Conclua ou desista dele antes de pagar por Pix.', 409)
        }

        const plano = await this.escolherPlanoPago(assinatura, planoId)
        if (assinatura.status === 'ativa' && String(assinatura.planoId?._id ?? assinatura.planoId) !== String(plano._id)) {
            throw new AppError('Para trocar de plano, aguarde o fim do período já pago. Por enquanto você pode renovar o plano atual.', 409)
        }

        // Só um Pix pendente por clínica: os anteriores são cancelados.
        const antigos = await PagamentoModel.find({ tenantId, status: 'pendente' })
        for (const antigo of antigos) {
            await chamarMercadoPago('PUT', `/v1/payments/${antigo.mercadoPagoPaymentId}`, { corpo: { status: 'cancelled' } }).catch(() => null)
            antigo.status = 'cancelado'
            await antigo.save()
        }

        const expiraEm = new Date(Date.now() + PIX_VALIDADE_MINUTOS * 60 * 1000)
        const corpo = {
            transaction_amount: plano.preco,
            description: `Assinatura SoftwareClinic - ${plano.nome} (${PIX_DIAS_DE_ACESSO} dias)`,
            payment_method_id: 'pix',
            date_of_expiration: expiracaoComFuso(expiraEm),
            external_reference: assinatura._id.toString(),
            // No ambiente de teste o pagador precisa ser um usuário de teste; em produção MP_TEST_PAYER_EMAIL fica vazio.
            payer: {
                email: process.env.MP_TEST_PAYER_EMAIL || admin.email,
                identification: { type: pagador.tipo, number: pagador.numero },
            },
        }
        if (process.env.APP_URL_BACKEND) {
            corpo.notification_url = `${process.env.APP_URL_BACKEND.replace(/\/+$/, '')}/api/assinaturas/webhook`
        }

        let payment
        try {
            payment = await chamarMercadoPago('POST', '/v1/payments', { corpo, idempotencyKey: randomUUID() })
        } catch (error) {
            throw traduzirErroMercadoPago(error, 'gerar o Pix')
        }

        const dados = payment.point_of_interaction?.transaction_data
        if (!dados?.qr_code) {
            await chamarMercadoPago('PUT', `/v1/payments/${payment.id}`, { corpo: { status: 'cancelled' } }).catch(() => null)
            throw new AppError('O Mercado Pago não devolveu o QR Code do Pix. Verifique se a conta tem uma chave Pix cadastrada.', 502)
        }

        const pagamento = await PagamentoModel.create({
            tenantId,
            assinaturaId: assinatura._id,
            planoId: plano._id,
            mercadoPagoPaymentId: String(payment.id),
            valor: plano.preco,
            qrCode: dados.qr_code,
            qrCodeBase64: dados.qr_code_base64 ?? null,
            ticketUrl: dados.ticket_url ?? null,
            expiraEm: payment.date_of_expiration ? new Date(payment.date_of_expiration) : expiraEm,
        })

        return pagamentoParaDTO(pagamento)
    },

    // Pergunta ao Mercado Pago pelo Pix pendente da clínica (o id vem do banco, nunca do cliente).
    // É chamada pela janela do Pix, ao abrir a assinatura e ao gerar outro Pix: assim quem paga depois de fechar a janela
    // é liberado mesmo que o aviso (webhook) do Mercado Pago não chegue.
    async confirmarPixPendente(tenantId) {
        const pendente = await PagamentoModel.findOne({ tenantId, status: 'pendente' }).sort({ createdAt: -1 })
        if (!pendente) return

        const payment = await buscarNoMercadoPago(`/v1/payments/${pendente.mercadoPagoPaymentId}`)
        await this.aplicarPagamentoPix(pendente, payment)

        // Se o Mercado Pago ainda não marcou como vencido, o prazo local decide.
        const atualizado = await PagamentoModel.findById(pendente._id)
        if (atualizado.status === 'pendente' && atualizado.expiraEm && atualizado.expiraEm < new Date()) {
            atualizado.status = 'expirado'
            await atualizado.save()
        }
    },

    // Confirma o Pix pendente e devolve o pagamento mais recente com a assinatura atualizada.
    async sincronizarPix(tenantId) {
        await this.confirmarPixPendente(tenantId)

        const ultimo = await PagamentoModel.findOne({ tenantId }).sort({ createdAt: -1 })
        const assinatura = await this.obterAssinaturaAtual(tenantId)
        return { pagamento: pagamentoParaDTO(ultimo), assinatura }
    },

    // Aplica o que o Mercado Pago informou sobre o Pix. Serve para o webhook e para a consulta da tela.
    async aplicarPagamentoPix(pagamento, payment) {
        const situacao = situacaoDoPix(payment)

        if (situacao !== 'aprovado') {
            if (pagamento.status === 'pendente' && situacao !== 'pendente') {
                pagamento.status = situacao
                await pagamento.save()
            }
            return pagamento
        }

        // Só libera se o valor pago é o valor cobrado.
        if (Math.abs(Number(payment.transaction_amount) - pagamento.valor) > 0.005) return pagamento

        // Atômico: mesmo que webhook e consulta cheguem juntos, só um deles consegue marcar como aprovado (e estender o acesso).
        const aprovado = await PagamentoModel.findOneAndUpdate(
            { _id: pagamento._id, status: { $ne: 'aprovado' } },
            { $set: { status: 'aprovado', aprovadoEm: new Date() } },
            { new: true }
        )
        if (!aprovado) return pagamento

        await this.liberarAcessoPix(aprovado)
        return aprovado
    },

    // Estende o acesso em PIX_DIAS_DE_ACESSO dias, somando ao que ainda restar do período já pago.
    async liberarAcessoPix(pagamento) {
        const assinatura = await AssinaturaModel.findById(pagamento.assinaturaId)
        if (!assinatura) return

        const agora = new Date()
        const temPeriodoPago = (assinatura.status === 'ativa' && assinatura.cobranca === 'pix') || assinatura.status === 'cancelada'
        const base = temPeriodoPago && assinatura.proximaCobranca && assinatura.proximaCobranca > agora ? assinatura.proximaCobranca : agora

        // Cobrança recorrente antiga (em atraso, pausada no Mercado Pago) é encerrada para não continuar cobrando ao lado do Pix.
        if (assinatura.status === 'inadimplente' && assinatura.mercadoPagoPreapprovalId) {
            await new PreApproval(getMpClient())
                .update({ id: assinatura.mercadoPagoPreapprovalId, body: { status: 'cancelled' } })
                .catch(() => null)
        }
        if (['inadimplente', 'cancelada'].includes(assinatura.status)) {
            assinatura.mercadoPagoPreapprovalId = null
        }

        assinatura.planoId = pagamento.planoId
        assinatura.status = 'ativa'
        assinatura.cobranca = 'pix'
        assinatura.inadimplenteDesde = null
        assinatura.proximaCobranca = new Date(base.getTime() + PIX_DIAS_DE_ACESSO * DIA_EM_MS)
        await assinatura.save()
    },

    async processarWebhookPreapproval(preapprovalId) {
        const assinatura = await AssinaturaModel.findOne({ mercadoPagoPreapprovalId: preapprovalId })
        if (!assinatura) return

        const preapproval = await buscarNoMercadoPago(`/preapproval/${preapprovalId}`)
        aplicarStatusPreapproval(assinatura, preapproval)
        await assinatura.save()
    },

    async processarWebhookPayment(paymentId) {
        const payment = await buscarNoMercadoPago(`/v1/payments/${paymentId}`)

        // Pix avulso: identificado pelo id do pagamento que guardamos ao gerar o QR Code.
        if (payment.payment_method_id === 'pix') {
            const pagamento = await PagamentoModel.findOne({ mercadoPagoPaymentId: String(payment.id) })
            if (pagamento) await this.aplicarPagamentoPix(pagamento, payment)
            return
        }

        if (!payment.external_reference || !mongoose.isValidObjectId(payment.external_reference)) return

        const assinatura = await AssinaturaModel.findById(payment.external_reference)
        if (!assinatura) return

        if (payment.status === 'approved') {
            assinatura.status = 'ativa'
            assinatura.cobranca = 'recorrente'
            assinatura.inadimplenteDesde = null
            const proxima = new Date()
            proxima.setMonth(proxima.getMonth() + 1)
            assinatura.proximaCobranca = proxima
        } else if (['rejected', 'cancelled'].includes(payment.status)) {
            if (assinatura.status !== 'inadimplente') assinatura.inadimplenteDesde = new Date()
            assinatura.status = 'inadimplente'
        }

        await assinatura.save()
    },
}
