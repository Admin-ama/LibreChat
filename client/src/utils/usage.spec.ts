import { formatCountdown, usagePercent } from './usage';

describe('formatCountdown', () => {
  const now = Date.parse('2026-10-31T12:00:00Z');
  const later = (minutes: number) => new Date(now + minutes * 60000).toISOString();

  it('formats minutes, hours and days like the Claude Code status line', () => {
    expect(formatCountdown(later(12), now)).toBe('12m');
    expect(formatCountdown(later(285), now)).toBe('4h 45m');
    expect(formatCountdown(later(2 * 1440 + 600), now)).toBe('2d 10h');
  });

  it('returns null for missing or past dates', () => {
    expect(formatCountdown(null, now)).toBeNull();
    expect(formatCountdown(later(-5), now)).toBeNull();
  });
});

describe('usagePercent', () => {
  it('clamps and treats a zero cap as full', () => {
    expect(usagePercent(1, 2)).toBe(50);
    expect(usagePercent(5, 2)).toBe(100);
    expect(usagePercent(0, 0)).toBe(100);
    expect(usagePercent(1, null)).toBeNull();
  });
});
