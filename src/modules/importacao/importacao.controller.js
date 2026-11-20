import { ImportacaoService } from './importacao.service.js'
import { idiomaDaRequisicao, traduzirMensagem } from '../shared/utils/idioma.js'

export const ImportacaoController = {
    async importar(req, reply) {
        const { tipo } = req.params
        const resultado = await ImportacaoService.importar(tipo, req.body?.linhas, {
            tenantId: req.user.tenantId,
            usuario: req.user,
            acesso: req.acesso ?? null,
            ip: req.ip,
        })
        // Os motivos de cada linha vão dentro de `data`, fora do `message` que o onSend traduz: traduz aqui.
        const idioma = idiomaDaRequisicao(req)
        for (const lista of [resultado.erros, resultado.ignorados, resultado.avisos]) {
            for (const item of lista) item.motivo = traduzirMensagem(item.motivo, idioma)
        }
        return reply.send({ data: resultado, message: 'Importação concluída' })
    },
}
