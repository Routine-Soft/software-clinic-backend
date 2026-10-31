import mongoose from 'mongoose'

const formaPagamentoSchema = new mongoose.Schema({
    tipo: { type: String, required: true },
    valor: { type: Number, required: true },
}, { _id: false })

const agendaSchema = new mongoose.Schema({
    data: { type: Date, required: true },
    horaInicio: { type: String, required: true },
    horaFim: { type: String, required: true },

    salaId: { type: mongoose.Schema.Types.ObjectId, ref: 'salas', required: true },
    pacienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'pacientes', required: true },
    profissionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'profissionais', required: true },
    servicoId: { type: mongoose.Schema.Types.ObjectId, ref: 'servicos', required: true },
    convenioId: { type: mongoose.Schema.Types.ObjectId, ref: 'convenios', default: null },

    status: { type: String, enum: ['aguardando', 'realizado', 'faltou', 'cancelado'], default: 'aguardando' },
    realizadoEm: { type: Date, default: null },
    // Quando o profissional finalizou o atendimento. Na clínica em que a recepção confirma, isso só avisa: a consulta
    // continua "aguardando" até a recepção ou a dona confirmar.
    finalizadoEm: { type: Date, default: null },

    // Sala de espera: quando o paciente chegou (marcado pela recepção) e a última vez em que foi chamado na TV.
    chegouEm: { type: Date, default: null },
    chamadoEm: { type: Date, default: null },

    // Comissão do profissional por este atendimento, calculada no momento em que ele é marcado como realizado,
    // pela regra do serviço para o convênio do atendimento (mudar a regra depois não altera o que já foi feito).
    // percentual: preenchido quando a regra era percentual (valor = percentual do valor cobrado).
    // pagamentoId nulo = pendente; preenchido = já paga naquele pagamento.
    comissao: {
        valor: { type: Number, default: 0 },
        percentual: { type: Number, default: null },
        pagamentoId: { type: mongoose.Schema.Types.ObjectId, ref: 'comissaopagamentos', default: null },
    },

    grupoRecorrenciaId: { type: mongoose.Schema.Types.ObjectId, default: null },

    // Lembrete pelo WhatsApp, enviado no dia anterior (ver lembrete-whatsapp). Trocar o dia, o horário ou o paciente
    // zera o registro, para o novo horário ganhar o próprio lembrete.
    // situacao acompanha o que a Meta informa; resposta é o botão que o paciente apertou.
    lembrete: {
        enviadoEm: { type: Date, default: null },
        mensagemId: { type: String, default: null },
        situacao: { type: String, enum: ['enviando', 'enviado', 'entregue', 'lido', 'falhou', null], default: null },
        erro: { type: String, default: null },
        resposta: { type: String, enum: ['confirmado', 'desmarcado', null], default: null },
        respondidoEm: { type: Date, default: null },
    },

    financeiro: {
        valor: { type: Number, required: true },
        vencimento: { type: Date, required: true },
        parcelamento: { type: Number, default: 1 },
        formasPagamento: { type: [formaPagamentoSchema], default: [] },
        // Quando o paciente pagou este agendamento. Nas sessões à vista ou parceladas, quem manda é a cobrança.
        pagoEm: { type: Date, default: null },
        // Parte do paciente no atendimento pelo plano, guardada como estava no convênio ao agendar.
        coparticipacao: { type: Number, default: 0 },
    },
    cobrancaId: { type: mongoose.Schema.Types.ObjectId, ref: 'cobrancas', default: null },

    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true, index: true },

}, { timestamps: true });

agendaSchema.index({ tenantId: 1, profissionalId: 1, data: 1 })
agendaSchema.index({ tenantId: 1, salaId: 1, data: 1 })
agendaSchema.index({ 'lembrete.mensagemId': 1 }, { sparse: true })

const AgendaModel = mongoose.models.agendas || mongoose.model('agendas', agendaSchema);

export default AgendaModel;