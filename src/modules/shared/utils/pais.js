// O país da clínica decide como ela paga:
//  - Brasil: Mercado Pago (cartão e Pix), planos em reais
//  - outros países: Stripe (cartão internacional), planos em dólar

export function paisValido(valor) {
    const pais = String(valor ?? '').trim().toUpperCase()
    return /^[A-Z]{2}$/.test(pais) ? pais : null
}

export function ehBrasil(pais) {
    return (paisValido(pais) ?? 'BR') === 'BR'
}

export function moedaDoPais(pais) {
    return ehBrasil(pais) ? 'BRL' : 'USD'
}

export function gatewayDoPais(pais) {
    return ehBrasil(pais) ? 'mercadopago' : 'stripe'
}
