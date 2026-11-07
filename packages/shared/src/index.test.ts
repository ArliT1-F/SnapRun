import { describe, expect, it } from 'vitest';
import {
  contactInputSchema,
  defaultSettings,
  filterContacts,
  officialWebCapabilities,
  settingsSchema,
} from './index';
describe('honest provider capabilities', () => {
  it('never advertises private messaging, friends or verified connections', () => {
    expect(officialWebCapabilities.openOfficialMessaging).toBe(true);
    for (const key of [
      'verifiedConnection',
      'sendMessage',
      'receiveMessage',
      'conversationHistory',
      'contactAccess',
      'messageNotifications',
    ] as const)
      expect(officialWebCapabilities[key]).toBe(false);
  });
});
describe('validated local data', () => {
  it('accepts only explicit settings', () => {
    expect(settingsSchema.safeParse(defaultSettings).success).toBe(true);
    expect(settingsSchema.safeParse({ ...defaultSettings, snapchatToken: 'never' }).success).toBe(
      false,
    );
    expect(
      settingsSchema.safeParse({
        ...defaultSettings,
        desktop: { ...defaultSettings.desktop, token: 'never' },
      }).success,
    ).toBe(false);
  });
  it('searches local contacts without inventing Snapchat data', () => {
    const c = {
      id: '1',
      displayName: 'Alex',
      snapchatUsername: 'alex.local',
      notes: 'Book club',
      labelIds: [],
      createdAt: '',
      updatedAt: '',
    };
    expect(filterContacts([c], '@ALEX')).toEqual([c]);
    expect(filterContacts([c], 'someone else')).toEqual([]);
  });
  it('rejects invalid usernames and extra credential fields', () => {
    expect(
      contactInputSchema.safeParse({ displayName: 'Alex', snapchatUsername: 'not a username' })
        .success,
    ).toBe(false);
    expect(contactInputSchema.safeParse({ displayName: 'Alex', password: 'secret' }).success).toBe(
      false,
    );
  });
});
