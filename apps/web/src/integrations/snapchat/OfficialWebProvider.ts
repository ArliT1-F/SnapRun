import { OFFICIAL_SNAPCHAT_WEB } from '@snaprun/shared';
import { openExternal } from '../../lib/platform';
import { capabilities } from './SnapchatCapabilities';
import type { SnapchatProvider } from './SnapchatProvider';
export class OfficialWebProvider implements SnapchatProvider {
  readonly id = 'official-web';
  readonly displayName = 'Snapchat Web';
  readonly capabilities = capabilities;
  async handoff(_purpose: 'login' | 'register', _context: import('./types').ProviderContext) {
    await openExternal(OFFICIAL_SNAPCHAT_WEB);
    return { outcome: 'opened' as const, verified: false as const, url: OFFICIAL_SNAPCHAT_WEB };
  }
}
export const snapchatProvider = new OfficialWebProvider();
