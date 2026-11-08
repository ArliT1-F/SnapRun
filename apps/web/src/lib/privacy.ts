export const PREFERENCES_KEY = 'snaprun.preferences';
export const LOCAL_KEY_PREFIX = 'snaprun.';

export type BrowserWipeResult = { localKeys: number; sessionKeys: number };

/** Generic system-notification payload. It intentionally contains no event details. */
export function systemNotificationPayload(title: string, body: string, redact: boolean) {
  return redact
    ? { title: 'SnapRun', body: 'You have a workspace update. Open SnapRun to view it.' }
    : { title, body };
}

function clearPrefixedStorage(storage: Storage | undefined): number {
  if (!storage) return 0;
  let removed = 0;
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key?.startsWith(LOCAL_KEY_PREFIX)) keys.push(key);
    }
    for (const key of keys) {
      storage.removeItem(key);
      removed += 1;
    }
  } catch {
    /* Storage can be unavailable in private/embedded contexts. */
  }
  return removed;
}

/** Removes only SnapRun-owned browser storage. It never touches other sites or account data. */
export function wipeBrowserCompanionData(): BrowserWipeResult {
  return {
    localKeys: clearPrefixedStorage(typeof localStorage === 'undefined' ? undefined : localStorage),
    sessionKeys: clearPrefixedStorage(
      typeof sessionStorage === 'undefined' ? undefined : sessionStorage,
    ),
  };
}

export function localPreferenceCachePresent(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(PREFERENCES_KEY) !== null;
  } catch {
    return false;
  }
}

export const privacyDataInventory = [
  {
    id: 'device-identifiers',
    label: 'Device identifiers / hardware fingerprint',
    status: 'Not collected by SnapRun',
    detail:
      'SnapRun does not request or store advertising IDs, serial numbers or a hardware fingerprint. Standard HTTP requests still expose network metadata such as IP address and user-agent to the host.',
  },
  {
    id: 'analytics',
    label: 'Analytics / advertising trackers',
    status: 'None added',
    detail: 'No analytics SDK, advertising pixel or cross-site tracking script is included.',
  },
  {
    id: 'sensitive-permissions',
    label: 'Camera, microphone and location',
    status: 'Not requested',
    detail: 'SnapRun does not call camera, microphone or geolocation APIs.',
  },
  {
    id: 'snapchat-data',
    label: 'Snapchat credentials, messages and friends',
    status: 'Never collected',
    detail:
      'Authentication and messaging continue in Snapchat’s official interface. SnapRun has no private Snapchat token or message archive.',
  },
  {
    id: 'companion-account',
    label: 'Companion account data',
    status: 'Only if you sign in',
    detail:
      'Email, display name, a salted password hash and expiring session hashes are stored server-side. Guest mode creates no companion account.',
  },
  {
    id: 'contacts',
    label: 'Contacts, notes and labels',
    status: 'You create them',
    detail:
      'Guest contacts stay in memory for this page session. Signed-in contacts are encrypted before database storage and synced only to your companion account.',
  },
  {
    id: 'activity',
    label: 'Workspace activity',
    status: 'Companion events only',
    detail:
      'Handoffs, contact changes and connection notes can create companion notifications. Snapchat message events are not received.',
  },
] as const;
