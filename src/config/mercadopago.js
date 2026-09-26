import { MercadoPagoConfig } from 'mercadopago'

let _mpClient = null

export function getMpClient() {
  if (!_mpClient) {
    _mpClient = new MercadoPagoConfig({
      accessToken: process.env.MP_ACCESS_TOKEN,
      options: { timeout: 5000 },
    })
  }
  return _mpClient
}