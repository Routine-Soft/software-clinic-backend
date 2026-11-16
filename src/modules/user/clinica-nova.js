import EspecialidadeModel from '../especialidade/especialidade.model.js'
import ServicoModel from '../servico/servico.model.js'
import SalaModel from '../sala/sala.model.js'
import ConvenioModel from '../convenio/convenio.model.js'
import ProfissionalModel from '../profissional/profissional.model.js'

// Área de atuação escolhida no cadastro da clínica (fica no dono, em `area`). Decide o que a clínica nova já recebe
// pronto e quais avaliações aparecem no menu (ver `clinicaVeAvaliacoes` no site).
// especialidade: nome em pt/en/es; registro: conselho profissional no Brasil.
export const AREAS = {
    clinica_medica: { especialidade: ['Clínica médica', 'General practice', 'Medicina general'], registro: 'CRM' },
    psicologia: { especialidade: ['Psicologia', 'Psychology', 'Psicología'], registro: 'CRP' },
    psiquiatria: { especialidade: ['Psiquiatria', 'Psychiatry', 'Psiquiatría'], registro: 'CRM' },
    neuropsicologia: { especialidade: ['Neuropsicologia', 'Neuropsychology', 'Neuropsicología'], registro: 'CRP' },
    terapias: { especialidade: ['Terapia ocupacional', 'Occupational therapy', 'Terapia ocupacional'], registro: 'CREFITO' },
    fisioterapia: { especialidade: ['Fisioterapia', 'Physical therapy', 'Fisioterapia'], registro: 'CREFITO' },
    fonoaudiologia: { especialidade: ['Fonoaudiologia', 'Speech therapy', 'Fonoaudiología'], registro: 'CRFa' },
    nutricao: { especialidade: ['Nutrição', 'Nutrition', 'Nutrición'], registro: 'CRN' },
    odontologia: { especialidade: ['Odontologia', 'Dentistry', 'Odontología'], registro: 'CRO' },
    estetica: { especialidade: ['Estética', 'Aesthetics', 'Estética'], registro: 'Registro' },
    saude_trabalho: { especialidade: ['Saúde do trabalho', 'Occupational health', 'Salud ocupacional'], registro: 'CRM' },
    outra: { especialidade: ['Atendimento', 'Appointments', 'Atención'], registro: 'Registro' },
}

export function areaValida(area) {
    return Object.hasOwn(AREAS, area) ? area : null
}

const TEXTOS = {
    pt: { consulta: 'Consulta', sala: 'Consultório 1', particular: 'Particular', aInformar: 'A informar', registro: 'Registro' },
    en: { consulta: 'Consultation', sala: 'Room 1', particular: 'Private', aInformar: 'To be informed', registro: 'License' },
    es: { consulta: 'Consulta', sala: 'Consultorio 1', particular: 'Particular', aInformar: 'Por informar', registro: 'Registro' },
}

// Deixa a clínica nova pronta para o primeiro agendamento: especialidade da área, o dono como profissional,
// o serviço "Consulta", a sala "Consultório 1" e o convênio "Particular". Tudo pode ser editado depois no Painel Admin.
// Uma falha aqui não impede o cadastro: a clínica só fica sem os itens prontos.
export async function prepararClinicaNova(dono, idioma = 'pt', log = console) {
    try {
        const area = AREAS[dono.area] ?? AREAS.outra
        const indice = { pt: 0, en: 1, es: 2 }[idioma] ?? 0
        const textos = TEXTOS[idioma] ?? TEXTOS.pt
        const tenantId = dono.tenantId

        const especialidade = await EspecialidadeModel.create({ nome: area.especialidade[indice], tenantId })
        await Promise.all([
            ProfissionalModel.create({
                nome: dono.nomeCompleto,
                tipoRegistro: dono.pais === 'BR' ? area.registro : textos.registro,
                numeroRegistro: textos.aInformar,
                especialidadeIds: [especialidade._id],
                usuarioId: dono._id,
                tenantId,
            }),
            ServicoModel.create({ nome: textos.consulta, tipo: 'consulta', preco: 0, tenantId }),
            SalaModel.create({ nome: textos.sala, tenantId }),
            ConvenioModel.create({ nome: textos.particular, quemPaga: 'paciente', tenantId }),
        ])
    } catch (erro) {
        log.error?.(erro, 'Falha ao preparar a clínica nova')
    }
}
