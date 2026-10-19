const LOCAL_PART = /^[a-z0-9._%+-]+$/;
const FULL_EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

/**
 * Turns what the player typed into the email they log in with, or null when it
 * cannot be one. Where an allowed domain is configured only the part before the
 * `@` is kept and that domain is appended, so `bernardo.gsilva` and
 * `bernardo.gsilva@anything` both become `bernardo.gsilva@<domain>`.
 */
export function loginEmail(typed: string, allowedDomain?: string): string | null {
  const input = typed.trim().toLowerCase();
  const domain = allowedDomain?.trim().toLowerCase().replace(/^@/, '');
  if (domain) {
    const local = input.split('@')[0] ?? '';
    return LOCAL_PART.test(local) ? `${local}@${domain}` : null;
  }
  return FULL_EMAIL.test(input) ? input : null;
}
