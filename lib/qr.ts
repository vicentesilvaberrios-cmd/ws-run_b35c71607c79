/**
 * QR code utilities — generado 100% local (librería 'qrcode', sin llamadas a terceros).
 */
import QRCode from 'qrcode';

export async function getQrDataUrl(url: string, size = 200): Promise<string> {
  return QRCode.toDataURL(url, { width: size, margin: 1 });
}

export async function downloadQr(url: string, filename = 'qr-reservas.png'): Promise<void> {
  const dataUrl = await QRCode.toDataURL(url, { width: 512, margin: 1 });
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
