// The static Pix BR Code: EMV fields per the Banco Central's BR Code manual, closed by
// a CRC. specs/manipulados/design.md; adr:0003.

export interface PixReceiver {
  key: string;
  name: string;
  city: string;
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), four upper-case hex digits. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(payload)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function field(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

// Name and city travel as plain ASCII; banks reject or garble accents.
function plain(text: string, max: number): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '').trim().slice(0, max);
}

/**
 * The copy-and-paste code of a static Pix to `receiver`, for `amount` centavos (any
 * amount when absent), carrying `txid` (alphanumeric, ≤ 25; `***` for none).
 */
export function pixCode(receiver: PixReceiver, charge: { amount?: number; txid: string }): string {
  const key = receiver.key.trim();
  // The account field holds the GUI (18 characters) and the key in at most 99.
  // Field lengths count bytes; a key outside printable ASCII would miscount them.
  if (!/^[\x20-\x7e]{1,77}$/.test(key)) throw new Error('Pix key must have 1 to 77 plain ASCII characters');
  if (charge.txid !== '***' && !/^[A-Za-z0-9]{1,25}$/.test(charge.txid)) {
    throw new Error('txid must be 1 to 25 letters or digits');
  }
  const { amount } = charge;
  if (amount !== undefined && (!Number.isInteger(amount) || amount <= 0)) {
    throw new Error('amount must be a positive whole number of centavos');
  }
  const name = plain(receiver.name, 25);
  const city = plain(receiver.city, 15);
  if (name === '') throw new Error('Pix name has no letters left once accents and symbols are removed');
  if (city === '') throw new Error('Pix city has no letters left once accents and symbols are removed');
  const payload = [
    field('00', '01'),
    field('26', field('00', 'br.gov.bcb.pix') + field('01', key)),
    field('52', '0000'),
    field('53', '986'),
    amount === undefined ? '' : field('54', (amount / 100).toFixed(2)),
    field('58', 'BR'),
    field('59', name),
    field('60', city),
    field('62', field('05', charge.txid)),
    '6304',
  ].join('');
  return payload + crc16(payload);
}

/** The code an admin matches in the statement: MANIP and the id's first 8 hex digits. */
export function manipulationTxid(id: string): string {
  return `MANIP${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}
