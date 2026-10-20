const CAMPOS_TEXTO = [
    'solicitante', 'finalidade', 'demanda', 'informantes', 'procedimento', 'analise',
    'hipoteseDiagnostica', 'cid', 'conclusao', 'encaminhamentos', 'referencias', 'devolutivaObservacoes',
]

const texto = (valor) => String(valor ?? '').trim()
const numeroOuNulo = (valor) => (valor === '' || valor === null || valor === undefined || Number.isNaN(Number(valor)) ? null : Number(valor))
const dataOuNula = (valor) => (valor ? new Date(valor) : null)

// Só o que a pessoa preenche; autor, paciente, situação e datas de controle ficam com o servidor.
// A anamnese é tratada no serviço (depende do modelo guardado na avaliação).
export function camposEditaveis(body = {}) {
    const dto = {}
    for (const campo of CAMPOS_TEXTO) if (campo in body) dto[campo] = texto(body[campo])
    if ('servicoId' in body) dto.servicoId = body.servicoId || null
    if ('devolutivaEm' in body) dto.devolutivaEm = dataOuNula(body.devolutivaEm)
    if (Array.isArray(body.sessoes)) {
        dto.sessoes = body.sessoes.map((s) => ({
            data: dataOuNula(s?.data),
            duracaoMin: numeroOuNulo(s?.duracaoMin),
            descricao: texto(s?.descricao),
        }))
    }
    if (Array.isArray(body.instrumentos)) {
        dto.instrumentos = body.instrumentos
            .filter((i) => texto(i?.nome))
            .map((i) => ({
                nome: texto(i.nome),
                dominio: texto(i.dominio),
                escoreBruto: texto(i.escoreBruto),
                escorePadrao: texto(i.escorePadrao),
                percentil: numeroOuNulo(i.percentil),
                classificacao: texto(i.classificacao),
                observacao: texto(i.observacao),
            }))
    }
    return dto
}
