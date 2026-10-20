import AppError from '../../errors/AppError.js'

// Formato de uma ficha de anamnese, usado pelos modelos da clínica, pelas anamneses do prontuário e pela
// avaliação neuropsicológica:
//   secoes: [{ id, titulo, descricao, perguntas: [{ id, tipo, rotulo, dica, opcoes, outro, auto }] }]
//   respostas: { [idDaPergunta]: valor }
// Tipos de pergunta e o valor guardado na resposta:
//   curto / longo -> texto;  data -> 'AAAA-MM-DD';
//   marcar (várias opções) -> { marcadas: [opção], outro: texto };  escolha (uma opção) -> { valor, outro }
// `auto` preenche a resposta ao abrir uma ficha nova (nome do paciente, data de hoje...), e dá para mudar depois.

export const TIPOS = ['curto', 'longo', 'data', 'marcar', 'escolha']
export const AUTOS = ['pacienteNome', 'pacienteNascimento', 'pacienteIdade', 'pacienteContato', 'profissionalNome', 'hoje']

const LIMITES = { secoes: 60, perguntas: 80, opcoes: 60, texto: 300, descricao: 2000, resposta: 20000 }
const ID = /^[A-Za-z0-9_-]{1,40}$/

const texto = (valor, max) => String(valor ?? '').replace(/\r\n/g, '\n').trim().slice(0, max)

// Limpa as seções que vêm do editor de modelos (ou de um modelo padrão). Ids repetidos ou faltando são refeitos.
export function sanitizarSecoes(secoes) {
    if (!Array.isArray(secoes) || secoes.length === 0) throw new AppError('O modelo precisa de pelo menos uma seção', 400)
    if (secoes.length > LIMITES.secoes) throw new AppError(`O modelo pode ter no máximo ${LIMITES.secoes} seções`, 400)

    const usados = new Set()
    const idUnico = (sugerido, prefixo) => {
        let id = ID.test(String(sugerido ?? '')) ? String(sugerido) : ''
        if (!id || usados.has(id)) {
            let n = usados.size + 1
            do { id = `${prefixo}${n++}` } while (usados.has(id))
        }
        usados.add(id)
        return id
    }

    const limpas = secoes.map((secao) => {
        const perguntas = Array.isArray(secao?.perguntas) ? secao.perguntas : []
        if (perguntas.length > LIMITES.perguntas) throw new AppError(`Uma seção pode ter no máximo ${LIMITES.perguntas} perguntas`, 400)
        return {
            id: idUnico(secao?.id, 's'),
            titulo: texto(secao?.titulo, LIMITES.texto),
            descricao: texto(secao?.descricao, LIMITES.descricao),
            perguntas: perguntas.map((p) => {
                const tipo = TIPOS.includes(p?.tipo) ? p.tipo : 'longo'
                const comOpcoes = tipo === 'marcar' || tipo === 'escolha'
                const opcoes = comOpcoes
                    ? [...new Set((Array.isArray(p?.opcoes) ? p.opcoes : []).map((o) => texto(o, LIMITES.texto)).filter(Boolean))].slice(0, LIMITES.opcoes)
                    : []
                return {
                    id: idUnico(p?.id, 'p'),
                    tipo,
                    rotulo: texto(p?.rotulo, LIMITES.texto),
                    dica: texto(p?.dica, LIMITES.texto),
                    opcoes,
                    outro: comOpcoes && p?.outro === true,
                    auto: AUTOS.includes(p?.auto) ? p.auto : null,
                }
            }),
        }
    })

    if (limpas.some((s) => !s.titulo)) throw new AppError('Dê um título para cada seção', 400)
    if (limpas.some((s) => s.perguntas.some((p) => !p.rotulo))) throw new AppError('Escreva o texto de cada pergunta', 400)
    if (limpas.some((s) => s.perguntas.some((p) => (p.tipo === 'marcar' || p.tipo === 'escolha') && p.opcoes.length === 0 && !p.outro))) {
        throw new AppError('Perguntas de marcar ou de escolha precisam de opções', 400)
    }
    return limpas
}

// Guarda só respostas de perguntas que existem na ficha, no formato do tipo de cada uma.
export function sanitizarRespostas(secoes, respostas) {
    const entrada = respostas && typeof respostas === 'object' ? respostas : {}
    const limpas = {}
    for (const pergunta of (secoes ?? []).flatMap((s) => s.perguntas ?? [])) {
        if (!(pergunta.id in entrada)) continue
        const valor = entrada[pergunta.id]
        if (pergunta.tipo === 'marcar') {
            const opcoes = new Set(pergunta.opcoes)
            limpas[pergunta.id] = {
                marcadas: (Array.isArray(valor?.marcadas) ? valor.marcadas : []).filter((o) => opcoes.has(o)),
                outro: pergunta.outro ? texto(valor?.outro, LIMITES.texto) : '',
            }
        } else if (pergunta.tipo === 'escolha') {
            limpas[pergunta.id] = {
                valor: pergunta.opcoes.includes(valor?.valor) ? valor.valor : '',
                outro: pergunta.outro ? texto(valor?.outro, LIMITES.texto) : '',
            }
        } else if (pergunta.tipo === 'data') {
            limpas[pergunta.id] = /^\d{4}-\d{2}-\d{2}$/.test(String(valor ?? '')) ? String(valor) : ''
        } else {
            limpas[pergunta.id] = texto(valor, LIMITES.resposta)
        }
    }
    return limpas
}

// Quantas perguntas têm resposta (para mostrar o andamento: "12 de 80 respondidas").
export function contarRespondidas(secoes, respostas) {
    let total = 0
    let respondidas = 0
    for (const pergunta of (secoes ?? []).flatMap((s) => s.perguntas ?? [])) {
        total++
        const valor = respostas?.[pergunta.id]
        if (valor && (typeof valor === 'string' ? valor.trim() : (valor.marcadas?.length || valor.valor || valor.outro))) respondidas++
    }
    return { total, respondidas }
}
