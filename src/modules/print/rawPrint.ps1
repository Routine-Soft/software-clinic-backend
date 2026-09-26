param(
    [Parameter(Mandatory = $true)][ValidateSet('list', 'send')][string]$Action,
    [string]$PrinterName,
    [string]$FilePath
)

$ErrorActionPreference = 'Stop'

if ($Action -eq 'list') {
    Get-Printer | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress
    exit 0
}

if (-not $PrinterName -or -not $FilePath) {
    Write-Error 'PrinterName e FilePath sao obrigatorios para a acao send'
    exit 1
}

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static void SendBytesToPrinter(string printerName, byte[] data)
    {
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "Recibo Lolita Bronze";
        di.pDataType = "RAW";

        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero))
            throw new Exception("Nao foi possivel abrir a impressora: " + printerName);

        try
        {
            if (!StartDocPrinter(hPrinter, 1, di))
                throw new Exception("Falha ao iniciar o documento de impressao");

            if (!StartPagePrinter(hPrinter))
                throw new Exception("Falha ao iniciar a pagina de impressao");

            IntPtr pUnmanagedBytes = Marshal.AllocHGlobal(data.Length);
            try
            {
                Marshal.Copy(data, 0, pUnmanagedBytes, data.Length);
                int written;
                if (!WritePrinter(hPrinter, pUnmanagedBytes, data.Length, out written) || written != data.Length)
                    throw new Exception("Falha ao enviar os dados para a impressora");
            }
            finally
            {
                Marshal.FreeHGlobal(pUnmanagedBytes);
            }

            EndPagePrinter(hPrinter);
            EndDocPrinter(hPrinter);
        }
        finally
        {
            ClosePrinter(hPrinter);
        }
    }
}
"@

try {
    $bytes = [System.IO.File]::ReadAllBytes($FilePath)
    [RawPrinterHelper]::SendBytesToPrinter($PrinterName, $bytes)
    Write-Output 'OK'
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
