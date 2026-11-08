import { describe, expect, it } from 'vitest';
import { matchesShortcut } from './Layout';
const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);
describe('workspace shortcuts', () => {
  it('supports platform command modifiers', () => {
    expect(matchesShortcut(key({ key: 'k', ctrlKey: true }), 'Mod+k')).toBe(true);
    expect(matchesShortcut(key({ key: 'k', metaKey: true }), 'Mod+k')).toBe(true);
    expect(matchesShortcut(key({ key: 'k' }), 'Mod+k')).toBe(false);
  });
  it('does not confuse shifted and unshifted shortcuts', () => {
    expect(matchesShortcut(key({ key: 'M', ctrlKey: true, shiftKey: true }), 'Mod+Shift+m')).toBe(
      true,
    );
    expect(matchesShortcut(key({ key: 'm', ctrlKey: true }), 'Mod+Shift+m')).toBe(false);
    expect(matchesShortcut(key({ key: 'n' }), 'n')).toBe(true);
  });
});
