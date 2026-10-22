import { describe, expect, it } from 'vitest';
import { qrDataUrl } from '../src/qr';

describe('qrDataUrl', () => {
  it('R1.2 draws the Pix code as an image data URL, a different one per code', () => {
    const a = qrDataUrl('00020126580014br.gov.bcb.pix0111123456789015204000053039865404 2.005802BR');
    const b = qrDataUrl('another code');
    expect(a).toMatch(/^data:image\/gif;base64,[A-Za-z0-9+/=]+$/);
    expect(a).not.toBe(b);
    expect(qrDataUrl('another code')).toBe(b);
  });
});
