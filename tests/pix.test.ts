import { describe, expect, it } from 'vitest';
import { crc16, manipulationTxid, pixCode } from '../src/pix';

// The example in the Banco Central's BR Code manual: a static Pix with no amount.
const BCB_EXAMPLE =
  '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D';

describe('crc16', () => {
  it('is CRC-16/CCITT-FALSE, as four upper-case hex digits', () => {
    expect(crc16('123456789')).toBe('29B1');
    expect(crc16('')).toBe('FFFF');
  });
});

describe('pixCode', () => {
  const receiver = { key: '123e4567-e12b-12d1-a456-426655440000', name: 'Fulano de Tal', city: 'BRASILIA' };

  it('reproduces the Banco Central example byte for byte', () => {
    expect(pixCode(receiver, { txid: '***' })).toBe(BCB_EXAMPLE);
  });

  it('R1.2 carries the amount of R$ 2,00 and the manipulation code', () => {
    const code = pixCode(receiver, { amount: 200, txid: 'MANIP3F2A9C1E' });
    expect(code).toContain('54042.00');
    expect(code).toContain('62170513MANIP3F2A9C1E');
    expect(code.slice(-4)).toBe(crc16(code.slice(0, -4)));
    expect(code.slice(-8, -4)).toBe('6304');
  });

  it('writes amounts in reais with two decimals', () => {
    expect(pixCode(receiver, { amount: 1050, txid: '***' })).toContain('540510.50');
    expect(pixCode(receiver, { amount: 5, txid: '***' })).toContain('54040.05');
  });

  it('strips accents and cuts the name to 25 and the city to 15 characters', () => {
    const code = pixCode(
      { key: 'ana@acme.com', name: 'João da Conceição Gonçalves Araújo', city: 'São José dos Campos' },
      { txid: '***' },
    );
    expect(code).toContain('5925Joao da Conceicao Goncalv');
    expect(code).toContain('6015Sao Jose dos Ca');
  });

  it('refuses a key that does not fit the field, and a txid that is not alphanumeric', () => {
    expect(() => pixCode({ ...receiver, key: '' }, { txid: '***' })).toThrow(/Pix key/);
    expect(() => pixCode({ ...receiver, key: 'x'.repeat(78) }, { txid: '***' })).toThrow(/Pix key/);
    expect(() => pixCode(receiver, { txid: 'MANIP-1' })).toThrow(/txid/);
    expect(() => pixCode(receiver, { txid: 'A'.repeat(26) })).toThrow(/txid/);
  });

  it('refuses an amount that is not a positive whole number of centavos', () => {
    expect(() => pixCode(receiver, { amount: 0, txid: '***' })).toThrow(/amount/);
    expect(() => pixCode(receiver, { amount: 2.5, txid: '***' })).toThrow(/amount/);
  });
});

describe('manipulationTxid', () => {
  it('R1.2 is MANIP and the first 8 hex digits of the manipulation id, upper-case', () => {
    expect(manipulationTxid('3f2a9c1e-77d0-4b8e-9a51-0c6e2d4f8b13')).toBe('MANIP3F2A9C1E');
  });
});
