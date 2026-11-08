import { describe, expect, it, vi, afterEach } from 'vitest';
import { OfficialWebProvider } from './OfficialWebProvider';
import { openExternal } from '../../lib/platform';
import { connectionLabel } from './IntegrationStatus';
afterEach(() => vi.restoreAllMocks());
describe('OfficialWebProvider', () => {
  it('opens only the official destination and never reports verification', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const provider = new OfficialWebProvider();
    const result = await provider.handoff('register', { connectionStatus: 'not_connected' });
    expect(open).toHaveBeenCalledWith('https://web.snapchat.com/', '_blank', 'noopener,noreferrer');
    expect(result).toEqual({
      outcome: 'opened',
      verified: false,
      url: 'https://web.snapchat.com/',
    });
    expect(provider.capabilities.conversationHistory).toBe(false);
  });
  it('reports blocked pop-ups instead of simulated success', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    await expect(
      new OfficialWebProvider().handoff('login', { connectionStatus: 'not_connected' }),
    ).rejects.toThrow('blocked');
  });
  it('rejects nonofficial or insecure destinations', async () => {
    await expect(openExternal('https://evil.example')).rejects.toThrow('official');
    await expect(openExternal('http://web.snapchat.com')).rejects.toThrow('official');
  });
  it('keeps self-reported status distinct from verified access', () => {
    expect(connectionLabel('user_confirmed')).toContain('self-reported');
    expect(connectionLabel('handoff_opened')).toBe('Handoff opened');
  });
});
