import qrcode from 'qrcode-generator';

/** A QR code of `text` as an image data URL, drawn without a canvas. */
export function qrDataUrl(text: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createDataURL(5, 4);
}
