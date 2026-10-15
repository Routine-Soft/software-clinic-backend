import PainelTvModel from './painel-tv.model.js'
import { hashDaChave } from './painel-tv.service.js'
import AppError from '../../errors/AppError.js'

// A TV se identifica com "Authorization: Painel <chave>". Chave desconhecida (TV desconectada na clínica): 401,
// e a TV volta para a tela do código.
export async function autenticarPainel(req) {
    const [tipo, chave] = String(req.headers.authorization ?? '').split(' ')
    if (tipo !== 'Painel' || !/^[0-9a-f]{64}$/.test(chave ?? '')) throw new AppError('TV não conectada', 401)

    const painel = await PainelTvModel.findOne({ chaveHash: hashDaChave(chave) })
    if (!painel) throw new AppError('Esta TV foi desconectada da clínica', 401)
    req.painel = painel
}
