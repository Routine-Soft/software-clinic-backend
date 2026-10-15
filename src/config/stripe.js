import Stripe from 'stripe'

// Stripe: cobrança no cartão das clínicas de fora do Brasil (em dólar). Sem STRIPE_SECRET_KEY fica desligado.
let _stripe = null

export function stripeConfigurado() {
    return !!process.env.STRIPE_SECRET_KEY
}

export function getStripe() {
    if (!_stripe) {
        _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2, timeout: 15000 })
    }
    return _stripe
}
