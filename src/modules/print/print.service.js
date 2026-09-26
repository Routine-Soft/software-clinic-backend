import { ThermalPrinter, PrinterTypes } from 'node-thermal-printer';
import os from 'os';
import AgendaModel from '../agenda/agenda.model.js';
import { getLogoEscPosBuffer } from './logo.js';
import { resolveWindowsPrinterName, sendRawBufferToWindowsPrinter } from './windowsPrinter.js';

const PRINTER_MODE = (process.env.PRINTER_MODE || 'usb').toLowerCase();
const PRINTER_INTERFACE = process.env.PRINTER_INTERFACE || 'usb';
const WINDOWS_PRINTER_NAME = process.env.PRINTER_NAME || null;

function createPrinter() {
  return new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: PRINTER_INTERFACE,
    width: 42,
  });
}

function logStep(logs, mensagem, extra = {}) {
  const entry = { timestamp: new Date().toISOString(), mensagem, ...extra };
  logs.push(entry);
  console.log('[PRINT]', JSON.stringify(entry));
  return entry;
}

async function ensureUsbPrinterConnected(printer, logs) {
  logStep(logs, 'Verificando conexão com a impressora', {
    interface: PRINTER_INTERFACE,
    plataforma: os.platform(),
    arquitetura: os.arch(),
    versaoNode: process.version,
  });

  let isConnected;
  try {
    isConnected = await printer.isPrinterConnected();
  } catch (err) {
    logStep(logs, 'Erro ao consultar a impressora', { erro: err.message, stack: err.stack });
    const erro = new Error(`Falha ao consultar a impressora: ${err.message}`);
    erro.statusCode = 503;
    erro.logs = logs;
    throw erro;
  }

  logStep(logs, 'Resultado da verificação de conexão', { conectada: isConnected });

  if (!isConnected) {
    logStep(logs, 'Impressora não encontrada na interface configurada');
    const erro = new Error('Impressora térmica não conectada');
    erro.statusCode = 503;
    erro.logs = logs;
    throw erro;
  }
}

async function ensureWindowsPrinterReady(logs) {
  logStep(logs, 'Verificando impressora na fila do Windows', {
    printerName: WINDOWS_PRINTER_NAME ?? 'auto (procurando por "Elgin")',
    plataforma: os.platform(),
  });

  let resolvedName;
  try {
    resolvedName = await resolveWindowsPrinterName(WINDOWS_PRINTER_NAME);
  } catch (err) {
    logStep(logs, 'Erro ao localizar impressora no Windows', { erro: err.message });
    const erro = new Error(err.message);
    erro.statusCode = 503;
    erro.logs = logs;
    throw erro;
  }

  logStep(logs, 'Impressora encontrada na fila do Windows', { impressora: resolvedName });
  return resolvedName;
}

async function ensurePrinterReady(printer, logs) {
  if (PRINTER_MODE === 'windows') {
    return ensureWindowsPrinterReady(logs);
  }
  await ensureUsbPrinterConnected(printer, logs);
  return null;
}

async function sendToPrinter(printer, logs, windowsPrinterName) {
  if (PRINTER_MODE === 'windows') {
    logStep(logs, 'Enviando dados para a fila de impressão do Windows', { impressora: windowsPrinterName });
    try {
      await sendRawBufferToWindowsPrinter(printer.getBuffer(), windowsPrinterName);
    } catch (err) {
      logStep(logs, 'Erro ao enviar dados para a fila do Windows', { erro: err.message });
      const erro = new Error(`Falha ao imprimir via fila do Windows: ${err.message}`);
      erro.statusCode = 503;
      erro.logs = logs;
      throw erro;
    }
    return;
  }
  await printer.execute();
}

async function printLogo(printer, logs) {
  try {
    const logoBuffer = await getLogoEscPosBuffer();
    printer.add(logoBuffer);
    printer.newLine();
  } catch (err) {
    logStep(logs, 'Não foi possível montar o logo, seguindo sem ele', { erro: err.message });
  }
}

export const PrintService = {
  async testPrinter(texto) {
    const logs = [];
    const printer = createPrinter();

    try {
      const windowsPrinterName = await ensurePrinterReady(printer, logs);

      logStep(logs, 'Montando conteúdo do teste de impressão');
      printer.clear();
      printer.alignCenter();
      await printLogo(printer, logs);
      printer.bold(true);
      printer.println('TESTE DE IMPRESSÃO');
      printer.bold(false);
      printer.println('--------------------------------');
      printer.alignLeft();
      printer.println(texto || 'Impressora funcionando corretamente.');
      printer.println(`Data: ${new Date().toLocaleString('pt-BR')}`);
      printer.cut();

      logStep(logs, 'Enviando comando de impressão');
      await sendToPrinter(printer, logs, windowsPrinterName);
      logStep(logs, 'Impressão enviada com sucesso');

      return { message: 'Teste impresso com sucesso', logs };
    } catch (err) {
      if (!err.logs) {
        logStep(logs, 'Erro inesperado durante a impressão de teste', { erro: err.message, stack: err.stack });
        err.logs = logs;
      }
      throw err;
    }
  },

  async printAgendamento(agendaId, tenantId) {
    const logs = [];
    const printer = createPrinter();

    try {
      logStep(logs, 'Buscando agendamento no banco', { agendaId });

      const agenda = await AgendaModel.findOne({ _id: agendaId, tenantId })
        .populate('pacienteId')
        .populate({ path: 'profissionalId', populate: { path: 'especialidadeIds' } })
        .populate('salaId')
        .populate('servicoId')
        .populate('convenioId');

      if (!agenda) {
        logStep(logs, 'Agendamento não encontrado');
        const erro = new Error('Agendamento não encontrado');
        erro.statusCode = 404;
        erro.logs = logs;
        throw erro;
      }

      const windowsPrinterName = await ensurePrinterReady(printer, logs);

      logStep(logs, 'Montando comprovante do agendamento');
      printer.clear();
      printer.alignCenter();
      await printLogo(printer, logs);
      printer.bold(true);
      printer.println('COMPROVANTE DE AGENDAMENTO');
      printer.bold(false);
      printer.println('--------------------------------');

      printer.alignLeft();
      printer.println(`Paciente: ${agenda.pacienteId?.nome ?? '-'}`);
      printer.println(`Telefone: ${agenda.pacienteId?.telefone ?? '-'}`);
      printer.println(`Profissional: ${agenda.profissionalId?.nome ?? '-'}`);
      printer.println(`Especialidade: ${agenda.profissionalId?.especialidadeIds?.map((e) => e.nome).join(', ') || '-'}`);
      printer.println(`Sala: ${agenda.salaId?.nome ?? '-'}`);
      printer.println(`Serviço: ${agenda.servicoId?.nome ?? '-'}`);
      printer.println(`Convênio: ${agenda.convenioId?.nome ?? 'Particular'}`);
      printer.println('--------------------------------');
      printer.println(`Data: ${new Date(agenda.data).toLocaleDateString('pt-BR')}`);
      printer.println(`Horário: ${agenda.horaInicio} às ${agenda.horaFim}`);
      printer.println(`Status: ${agenda.status}`);
      printer.println('--------------------------------');

      printer.alignRight();
      printer.bold(true);
      printer.println(`VALOR: R$ ${agenda.financeiro.valor.toFixed(2)}`);
      printer.bold(false);
      printer.alignLeft();
      printer.println(`Vencimento: ${new Date(agenda.financeiro.vencimento).toLocaleDateString('pt-BR')}`);

      if (agenda.financeiro.formasPagamento?.length > 0) {
        const formasTexto = agenda.financeiro.formasPagamento
          .map((f) => `${f.tipo}: R$ ${f.valor.toFixed(2)}`)
          .join(' + ');
        printer.println(`Forma de pagamento: ${formasTexto}`);
      }

      printer.newLine();
      printer.alignCenter();
      printer.println('Obrigado pela preferência!');
      printer.cut();

      logStep(logs, 'Enviando comando de impressão');
      await sendToPrinter(printer, logs, windowsPrinterName);
      logStep(logs, 'Comprovante impresso com sucesso');

      return { message: 'Impresso com sucesso', logs };
    } catch (err) {
      if (!err.logs) {
        logStep(logs, 'Erro inesperado durante a impressão do comprovante', { erro: err.message, stack: err.stack });
        err.logs = logs;
      }
      throw err;
    }
  },
};