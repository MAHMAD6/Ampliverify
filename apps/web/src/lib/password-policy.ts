/** Password rules shown on Sign Up (Signup_Login design) and enforced by the auth server. */
export const PASSWORD_RULES = [
  { key: 'length', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { key: 'upper', label: 'At least one uppercase letter (A–Z)', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'At least one lowercase letter (a–z)', test: (p: string) => /[a-z]/.test(p) },
  { key: 'number', label: 'At least one number (0–9)', test: (p: string) => /[0-9]/.test(p) },
  { key: 'special', label: 'At least one special character (e.g., ! @ # $ % ^ & *)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
] as const;

const SHORT: Record<(typeof PASSWORD_RULES)[number]['key'], string> = {
  length: 'at least 8 characters',
  upper: 'an uppercase letter',
  lower: 'a lowercase letter',
  number: 'a number',
  special: 'a special character',
};

export function passwordProblems(p: string) {
  return PASSWORD_RULES.filter((r) => !r.test(p)).map((r) => SHORT[r.key]);
}
