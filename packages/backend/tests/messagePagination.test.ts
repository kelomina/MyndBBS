import { parseMessagePageLimit } from '../src/lib/messagePagination';

describe('parseMessagePageLimit', () => {
  it('should default missing limit to 20', () => {
    expect(parseMessagePageLimit(undefined)).toBe(20);
  });

  it.each(['1', '20', '100'])('should accept safe limit %s', (limit) => {
    expect(parseMessagePageLimit(limit)).toBe(Number(limit));
  });

  it.each(['0', '-1', '101', 'abc', '1.5'])('should reject unsafe limit %s', (limit) => {
    expect(parseMessagePageLimit(limit)).toBeNull();
  });

  it('should reject repeated query values', () => {
    expect(parseMessagePageLimit(['20'])).toBeNull();
  });
});
