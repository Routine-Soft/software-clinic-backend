const CAMPOS_TEXTO = [
    'solicitante', 'finalidade', 'demanda', 'informantes', 'procedimento', 'analise',
    'hipoteseDiagnostica', 'cid', 'conclusao', 'encaminhamentos', 'referencias', 'devolutivaObservacoes',
]
const CAMPOS_ANAMNESE = [
    'gestacaoParto', 'desenvolvimento', 'escolaridade', 'historicoMedico', 'medicamentos',
    'historicoFamiliar', 'aspectosEmocionais', 'rotinaSono', 'relacoesSociais',
]

const texto = (valor) => String(valor ?? '').trim()
const numeroOuNulo = (valor) => (valor === '' || valor === null || valor === undefined || Number.isNaN(Number(valor)) ? null : Number(valor))
const dataOuNula = (valor) => (valor ? new Date(valor) : null)

// Só o que a pessoa preenche; autor, paciente, situação e datas de controle ficam com o servidor.
export function camposEditaveis(body = {}) {
    const dto = {}
    for (const campo of CAMPOS_TEXTO) if (campo in body) dto[campo] = texto(body[campo])
    if ('servicoId' in body) dto.servicoId = body.servicoId || null
    if ('devolutivaEm' in body) dto.devolutivaEm = dataOuNula(body.devolutivaEm)
    if (body.anamnese && typeof body.anamnese === 'object') {
        for (const campo of CAMPOS_ANAMNESE) {
            if (campo in body.anamnese) dto[`anamnese.${campo}`] = texto(body.anamnese[campo])
        }
    }
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
