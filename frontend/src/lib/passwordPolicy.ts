/** Mirrors backend `IdentityOptions.Password` in `Program.cs` (IS 414). */
export const PASSWORD_MIN_LENGTH = 14;
export const PASSWORD_MIN_UNIQUE_CHARS = 1;

export function countUniqueChars(password: string): number {
  return new Set(password).size;
}

export function passwordMeetsMinLength(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH;
}

export function passwordMeetsUniqueChars(password: string): boolean {
  return countUniqueChars(password) >= PASSWORD_MIN_UNIQUE_CHARS;
}

export function passwordMeetsPolicy(password: string): boolean {
  return passwordMeetsMinLength(password) && passwordMeetsUniqueChars(password);
}
