// The two AbacatePay calls the manipulation flow needs. Plain TypeScript, no Deno or npm
// imports, so Vitest runs it in Node. https://docs.abacatepay.com/pages/transparents/create

export const ABACATEPAY_URL = 'https://api.abacatepay.com/v2';

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface NewPix {
  /** Our manipulation id, so the charge can be traced back from AbacatePay's dashboard. */
  externalId: string;
  /** In centavos. */
  amount: number;
  description: string;
  expiresIn: number;
}

export interface Pix {
  id: string;
  brCode: string;
  /** A `data:image/png;base64,` URL of the QR code. */
  qrCode: string;
  expiresAt: string;
}

/** `PENDING`, `PAID`, `EXPIRED`, `CANCELLED`, and the rarer refund and dispute states. */
export type ChargeStatus = string;

export interface Gateway {
  createPix(pix: NewPix): Promise<Pix>;
  checkPix(id: string): Promise<ChargeStatus>;
}

interface Envelope {
  data?: unknown;
  success?: boolean;
  error?: unknown;
}

function field(data: unknown, key: string): string {
  const value = typeof data === 'object' && data !== null ? (data as Record<string, unknown>)[key] : undefined;
  if (typeof value !== 'string' || value === '') throw new Error(`AbacatePay: response without ${key}`);
  return value;
}

export function abacatePay(apiKey: string, fetchFn: Fetch = fetch): Gateway {
  async function call(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await fetchFn(`${ABACATEPAY_URL}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    });
    const body = (await response.json().catch(() => ({}))) as Envelope;
    if (!response.ok || body.success === false || body.error) {
      const reason = typeof body.error === 'string' ? body.error : `HTTP ${String(response.status)}`;
      throw new Error(`AbacatePay: ${reason}`);
    }
    return body.data;
  }

  return {
    async createPix({ externalId, amount, description, expiresIn }) {
      const data = await call('/transparents/create', {
        method: 'POST',
        body: JSON.stringify({ method: 'PIX', data: { amount, description, expiresIn, externalId } }),
      });
      const qrCode = field(data, 'brCodeBase64');
      if (!qrCode.startsWith('data:image/png;base64,')) throw new Error('AbacatePay: QR code is not a PNG data URL');
      return { id: field(data, 'id'), brCode: field(data, 'brCode'), qrCode, expiresAt: field(data, 'expiresAt') };
    },
    async checkPix(id) {
      const data = await call(`/transparents/check?id=${encodeURIComponent(id)}`);
      return field(data, 'status');
    },
  };
}
