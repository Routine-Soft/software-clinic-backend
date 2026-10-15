import { getStripe, stripeConfigurado } from '../../config/stripe.js'
import AppError from '../../errors/AppError.js'

// Plano em dólar salvo no painel: cria (ou atualiza) o produto e o preço mensal no Stripe. Preço no Stripe não
// muda de valor; quando o preço do plano muda, cria um preço novo e desativa o antigo (quem já assina continua
// no valor antigo até trocar de plano, como manda o Stripe).
export async function sincronizarPlanoNoStripe(plano) {
    if (plano.moeda !== 'USD' || plano.tipo !== 'pago') return plano
    if (!stripeConfigurado()) return plano

    const stripe = getStripe()
    const centavos = Math.round(Number(plano.preco) * 100)
    try {
        if (!plano.stripeProductId) {
            const produto = await stripe.products.create({ name: `Sonelia ${plano.nome}`, metadata: { planoId: String(plano._id) } })
            plano.stripeProductId = produto.id
        } else {
            await stripe.products.update(plano.stripeProductId, { name: `Sonelia ${plano.nome}`, active: plano.ativo !== false })
        }

        const atual = plano.stripePriceId ? await stripe.prices.retrieve(plano.stripePriceId).catch(() => null) : null
        const precoCerto = atual && atual.active && atual.unit_amount === centavos && atual.currency === 'usd' && atual.product === plano.stripeProductId
        if (!precoCerto) {
            const novo = await stripe.prices.create({
                product: plano.stripeProductId,
                currency: 'usd',
                unit_amount: centavos,
                recurring: { interval: 'month' },
                metadata: { planoId: String(plano._id) },
            })
            if (atual?.active) await stripe.prices.update(atual.id, { active: false }).catch(() => null)
            plano.stripePriceId = novo.id
        }
        await plano.save()
        return plano
    } catch (error) {
        throw new AppError(`Não foi possível criar o preço no Stripe: ${error.message}`, 502)
    }
}
