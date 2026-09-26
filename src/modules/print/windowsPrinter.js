import { execFile } from 'node:child_process';
import { writeFile, unlink, mkdtemp, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'rawPrint.ps1');

function runScript(args) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT_PATH, ...args],
      { maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error((stderr || stdout || error.message).trim()));
          return;
        }
        resolve(stdout.trim());
      },
    );
  });
}

export async function listWindowsPrinters() {
  const output = await runScript(['-Action', 'list']);
  if (!output) return [];
  try {
    const parsed = JSON.parse(output);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }
}

export async function resolveWindowsPrinterName(configuredName) {
  const printers = await listWindowsPrinters();

  if (configuredName) {
    const match = printers.find((name) => name.toLowerCase() === configuredName.toLowerCase());
    if (!match) {
      throw new Error(
        `Impressora "${configuredName}" não encontrada no Windows. Disponíveis: ${printers.join(', ') || 'nenhuma'}`,
      );
    }
    return match;
  }

  const auto = printers.find((name) => name.toLowerCase().includes('elgin'));
  if (!auto) {
    throw new Error(
      `Nenhuma impressora com nome contendo "Elgin" foi encontrada. Configure PRINTER_NAME. Disponíveis: ${printers.join(', ') || 'nenhuma'}`,
    );
  }
  return auto;
}

export async function sendRawBufferToWindowsPrinter(buffer, printerName) {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'sistemaclinica-print-'));
  const tempFile = path.join(tempDir, 'recibo.bin');
  try {
    await writeFile(tempFile, buffer);
    await runScript(['-Action', 'send', '-PrinterName', printerName, '-FilePath', tempFile]);
  } finally {
    await unlink(tempFile).catch(() => {});
    await rmdir(tempDir).catch(() => {});
  }
}