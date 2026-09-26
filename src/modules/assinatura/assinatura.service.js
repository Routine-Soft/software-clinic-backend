import { PreApproval } from 'mercadopago'
import { getMpClient } from '../../config/mercadopago.js'
import AssinaturaModel from './assinatura.model.js'
import PlanoModel from '../plano/plano.model.js'
import UserModel from '../user/user.model.js'
import AppError from '../../errors/AppError.js'

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
        const assinatura = await AssinaturaModel.findOne({ tenantId }).sort({ createdAt: -1 }).populate('planoId')
        if (!assinatura) {
            throw new AppError('Assinatura não encontrada', 404)
        }
        return assinatura
    },

    async iniciarCheckoutPago(tenantId) {
        const planoPago = await PlanoModel.findOne({ tipo: 'pago', ativo: true })
        if (!planoPago) {
            throw new AppError('Plano pago não configurado', 500)
        }

        const admin = await UserModel.findById(tenantId)
        if (!admin) {
            throw new AppError('Clínica não encontrada', 404)
        }

        const assinatura = await this.obterAssinaturaAtual(tenantId)

        const preapproval = new PreApproval(getMpClient())

        const result = await preapproval.create({
            body: {
                reason: `Assinatura Sistema Clínica - ${planoPago.nome}`,
                external_reference: assinatura._id.toString(),
                payer_email: admin.email,
                auto_recurring: {
                    frequency: 1,
                    frequency_type: 'months',
                    transaction_amount: planoPago.preco,
                    currency_id: 'BRL',
                },
                back_url: `${process.env.APP_URL}/assinatura/sucesso`,
            },
        })

        assinatura.planoId = planoPago._id
        assinatura.status = 'pendente'
        assinatura.mercadoPagoPreapprovalId = result.id
        await assinatura.save()

        return { url: result.init_point }
    },

    async processarWebhookPreapproval(preapprovalId) {
        const response = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
            headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
        })
        const preapproval = await response.json()

        const assinatura = await AssinaturaModel.findOne({ mercadoPagoPreapprovalId: preapprovalId })
        if (!assinatura) return

        if (preapproval.status === 'authorized') {
            assinatura.status = 'ativa'
        } else if (preapproval.status === 'cancelled') {
            assinatura.status = 'cancelada'
        } else if (preapproval.status === 'paused') {
            assinatura.status = 'inadimplente'
        }

        await assinatura.save()
    },

    async processarWebhookPayment(paymentId) {
        const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
            headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
        })
        const payment = await response.json()

        if (!payment.external_reference) return

        const assinatura = await AssinaturaModel.findById(payment.external_reference)
        if (!assinatura) return

        if (payment.status === 'approved') {
            assinatura.status = 'ativa'
            const proxima = new Date()
            proxima.setMonth(proxima.getMonth() + 1)
            assinatura.proximaCobranca = proxima
        } else if (['rejected', 'cancelled'].includes(payment.status)) {
            assinatura.status = 'inadimplente'
        }

        await assinatura.save()
    },
}