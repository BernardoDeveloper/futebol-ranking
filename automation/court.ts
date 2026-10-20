/** A calendar day, without a time zone: the court is booked by date only. */
export interface Day {
  day: number;
  month: number;
  year: number;
}

export interface Booking {
  phone: string;
  message: string;
  url: string;
}

const DAY_PATTERN = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/;

const two = (n: number): string => String(n).padStart(2, '0');

const isCalendarDate = ({ day, month, year }: Day): boolean => {
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

const before = (a: Day, b: Day): boolean =>
  a.year !== b.year ? a.year < b.year : a.month !== b.month ? a.month < b.month : a.day < b.day;

/**
 * Reads `DD/MM` or `DD/MM/AAAA` (R1.3). `DD/MM` is its next occurrence from today,
 * today included. Returns why the day cannot be used instead of throwing (R1.4).
 */
export function parseDay(input: string, today: Day): Day | { error: string } {
  const match = DAY_PATTERN.exec(input.trim());
  if (!match) return { error: `"${input}" não é um dia. Use DD/MM ou DD/MM/AAAA, por exemplo 24/10.` };
  const day = Number(match[1]);
  const month = Number(match[2]);
  if (match[3] === undefined) {
    // Eight years always reach a 29/02.
    for (let year = today.year; year <= today.year + 8; year++) {
      const candidate = { day, month, year };
      if (isCalendarDate(candidate) && !before(candidate, today)) return candidate;
    }
    return { error: `${input} não existe no calendário.` };
  }
  const full = { day, month, year: Number(match[3]) };
  if (!isCalendarDate(full)) return { error: `${input} não existe no calendário.` };
  if (before(full, today)) return { error: `${input} já passou.` };
  return full;
}

/** The court booking message (R1.2). */
export function courtMessage({ day, month }: Day): string {
  return `Bom dia. Tudo bem? A quadra 3 está disponível para o dia ${two(day)}/${two(month)} às 18:30?`;
}

/** Opens the chat with the message already typed in the compose box. */
export function whatsappUrl(phone: string, message: string): string {
  return `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
}

/**
 * Keeps only the digits, so `+55 11 9999-0000` and `551199990000` are the same number.
 * A full international number has 12 to 15 digits; fewer usually means the country
 * code is missing, and that number may belong to a stranger (R1.5).
 */
export function phoneDigits(configured: string | undefined): string | null {
  const digits = (configured ?? '').replace(/\D/g, '');
  return /^\d{12,15}$/.test(digits) ? digits : null;
}

export interface RunDeps {
  /** `COURT_WHATSAPP` from `.env.local` (R1.7). */
  phone: string | undefined;
  today: Day;
  log: (line: string) => void;
  error: (line: string) => void;
  send: (booking: Booking) => Promise<void>;
}

const USAGE = 'Uso: npm run quadra -- <DD/MM ou DD/MM/AAAA> [--dry-run]';

/** The court booking command. Every check happens before the browser opens (R1.4, R1.5). Returns the exit code. */
export async function run(args: readonly string[], deps: RunDeps): Promise<number> {
  const flags = args.filter((arg) => arg.startsWith('--'));
  const days = args.filter((arg) => !arg.startsWith('--'));
  const unknown = flags.find((flag) => flag !== '--dry-run');
  if (unknown !== undefined || days.length !== 1 || days[0] === undefined) {
    deps.error(unknown === undefined ? `Informe um dia. ${USAGE}` : `Opção desconhecida: ${unknown}. ${USAGE}`);
    return 1;
  }
  const day = parseDay(days[0], deps.today);
  if ('error' in day) {
    deps.error(day.error);
    return 1;
  }
  const phone = phoneDigits(deps.phone);
  if (phone === null) {
    deps.error('Número da quadra ausente ou incompleto. No .env.local, use o número completo com DDI e DDD: COURT_WHATSAPP=5511999990000');
    return 1;
  }
  const message = courtMessage(day);
  const booking = { phone, message, url: whatsappUrl(phone, message) };
  if (flags.includes('--dry-run')) {
    deps.log(`Para: +${phone}`);
    deps.log(`Mensagem: ${message}`);
    return 0;
  }
  try {
    await deps.send(booking);
  } catch (error: unknown) {
    deps.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
  deps.log(`Enviado para +${phone}: ${message}`);
  return 0;
}
