import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database';
import type { ManipulatedRow, RankingRow } from './ranking';

export interface Player {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
}

/** The player's manipulation, as the manipular Edge Function reports it. */
export type Manipulation =
  | { status: 'none' }
  | { status: 'paid' }
  | { status: 'pending'; brCode: string; qrCode: string; expiresAt: string };

/** Everything the views ask of the backend. Authorization is the database's job, not this layer's. */
export interface Api {
  requestCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;
  /** Calls back with the session's email, or null when signed out — once on subscribe, then on every change. */
  onSessionChange(callback: (email: string | null) => void): void;
  players(): Promise<Player[]>;
  addPlayer(name: string, email: string): Promise<void>;
  removePlayer(id: string): Promise<void>;
  /** The ratings the signed-in player has given, by rated player id. */
  myRatings(): Promise<Map<string, number>>;
  rate(raterId: string, ratedId: string, value: number): Promise<void>;
  /** Deletes the rating, so it no longer counts toward the rated player's average. */
  clearRating(raterId: string, ratedId: string): Promise<void>;
  ranking(): Promise<RankingRow[]>;
  /** Opens the signed-in player's R$ 2,00 Pix, or returns the one still pending. */
  manipulate(): Promise<Manipulation>;
  /** Asks AbacatePay, through the backend, whether the pending Pix was paid. */
  checkManipulation(): Promise<Manipulation>;
  /** Whether the signed-in player has a paid manipulation. */
  isManipulated(): Promise<boolean>;
  manipulatedRanking(): Promise<ManipulatedRow[]>;
}

interface ErrorLike {
  message: string;
  status?: number | undefined;
  code?: string | undefined;
}

/** What the player reads when asking for an access code fails. */
export function requestCodeError(error: ErrorLike): string {
  if (error.status === 429) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
  // The allowlist trigger aborts account creation, which Supabase reports as a database error.
  if (/database error/i.test(error.message)) {
    return 'Este email não está cadastrado. Peça a um admin para cadastrar você.';
  }
  return `Não foi possível enviar o código: ${error.message}`;
}

/** What an admin reads when registering a player fails. */
export function addPlayerError(error: ErrorLike): string {
  if (error.code === '23505') return 'Já existe um jogador com este email.';
  if (error.code === '42501') return 'Só admins podem cadastrar jogadores.';
  return `Não foi possível cadastrar: ${error.message}`;
}

const PNG_DATA_URL = 'data:image/png;base64,';

/** Reads the manipular function's reply; the QR code becomes an img src, so only a PNG data URL passes. */
export function parseManipulation(data: unknown): Manipulation {
  const reply = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;
  if (reply.status === 'none' || reply.status === 'paid') return { status: reply.status };
  const { brCode, qrCode, expiresAt } = reply;
  if (
    reply.status === 'pending' &&
    typeof brCode === 'string' &&
    typeof qrCode === 'string' &&
    qrCode.startsWith(PNG_DATA_URL) &&
    typeof expiresAt === 'string'
  ) {
    return { status: 'pending', brCode, qrCode, expiresAt };
  }
  throw new Error('Resposta inesperada do servidor de pagamento.');
}

function check(error: ErrorLike | null, describe: (e: ErrorLike) => string = (e) => e.message): void {
  if (error) throw new Error(describe(error));
}

export function supabaseApi(client: SupabaseClient<Database>): Api {
  async function manipular(action: 'start' | 'check', failure: string): Promise<Manipulation> {
    const reply: { data: unknown; error: unknown } = await client.functions.invoke<unknown>('manipular', { body: { action } });
    if (reply.error) throw new Error(failure);
    return parseManipulation(reply.data);
  }

  return {
    async requestCode(email) {
      const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      check(error, requestCodeError);
    },
    async verifyCode(email, code) {
      const { error } = await client.auth.verifyOtp({ email, token: code, type: 'email' });
      check(error, () => 'Código inválido ou expirado.');
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      check(error);
    },
    onSessionChange(callback) {
      client.auth.onAuthStateChange((_event, session) => {
        // Deferred: supabase-js deadlocks if its own calls run inside this callback.
        setTimeout(() => {
          callback(session?.user.email ?? null);
        }, 0);
      });
    },
    async players() {
      const { data, error } = await client.from('players').select('id, name, email, is_admin').order('name');
      check(error);
      return data ?? [];
    },
    async addPlayer(name, email) {
      const { error } = await client.from('players').insert({ name, email });
      check(error, addPlayerError);
    },
    async removePlayer(id) {
      const { error } = await client.from('players').delete().eq('id', id);
      check(error);
    },
    async myRatings() {
      const { data, error } = await client.from('ratings').select('rated_id, value');
      check(error);
      return new Map((data ?? []).map((r) => [r.rated_id, r.value]));
    },
    async rate(raterId, ratedId, value) {
      const { error } = await client
        .from('ratings')
        .upsert({ rater_id: raterId, rated_id: ratedId, value }, { onConflict: 'rater_id,rated_id' });
      check(error);
    },
    async clearRating(raterId, ratedId) {
      const { error } = await client.from('ratings').delete().eq('rater_id', raterId).eq('rated_id', ratedId);
      check(error);
    },
    async ranking() {
      const { data, error } = await client.rpc('ranking');
      check(error);
      return data ?? [];
    },
    manipulate() {
      return manipular('start', 'Não foi possível gerar o Pix. Tente de novo.');
    },
    checkManipulation() {
      return manipular('check', 'Não foi possível verificar o pagamento.');
    },
    async isManipulated() {
      const { data, error } = await client.from('manipulations').select('id').eq('status', 'paid').limit(1);
      check(error);
      return (data ?? []).length > 0;
    },
    async manipulatedRanking() {
      const { data, error } = await client.rpc('manipulated_ranking');
      check(error);
      return data ?? [];
    },
  };
}
