import { beforeEach, describe, expect, it } from 'vitest';
import {
  PREFERENCES_KEY,
  localPreferenceCachePresent,
  systemNotificationPayload,
  wipeBrowserCompanionData,
} from './privacy';

describe('Privacy Mode local data controls', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  it('redacts notification titles and bodies without leaking event details', () => {
    const payload = systemNotificationPayload('Alex Rivera', 'Saved contact alex.rivera', true);
    expect(payload.title).toBe('SnapRun');
    expect(payload.body).not.toContain('Alex');
    expect(payload.body).not.toContain('alex.rivera');
    expect(systemNotificationPayload('Visible', 'Details', false)).toEqual({
      title: 'Visible',
      body: 'Details',
    });
  });
  it('wipes only SnapRun-owned browser storage', () => {
    localStorage.setItem(PREFERENCES_KEY, '{}');
    localStorage.setItem('snaprun.other', 'remove me');
    localStorage.setItem('another-site', 'keep me');
    sessionStorage.setItem('snaprun.session', 'remove me');
    sessionStorage.setItem('another-session', 'keep me');
    const result = wipeBrowserCompanionData();
    expect(result.localKeys).toBe(2);
    expect(result.sessionKeys).toBe(1);
    expect(localStorage.getItem(PREFERENCES_KEY)).toBeNull();
    expect(localStorage.getItem('snaprun.other')).toBeNull();
    expect(sessionStorage.getItem('snaprun.session')).toBeNull();
    expect(localStorage.getItem('another-site')).toBe('keep me');
    expect(sessionStorage.getItem('another-session')).toBe('keep me');
    expect(localPreferenceCachePresent()).toBe(false);
  });
});
