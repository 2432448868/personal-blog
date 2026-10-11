export function slugify(value: string): string {
  const normalized = value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized || `post-${Date.now().toString(36)}`;
}

export function isValidSlug(value: string): boolean {
  return /^[\p{L}\p{N}][\p{L}\p{N}-]{0,79}$/u.test(value);
}
