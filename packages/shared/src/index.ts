import { z } from 'zod';

export const APP_VERSION = '0.1.0';
export const OFFICIAL_SNAPCHAT_WEB = 'https://web.snapchat.com/';
export const OFFICIAL_SNAPCHAT_HELP = 'https://help.snapchat.com/';
export const labelSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(32),
    color: z.enum(['yellow', 'blue', 'green', 'purple', 'rose']),
  })
  .strict();
export const shortcutSchema = z
  .object({ enabled: z.boolean(), binding: z.string().min(1).max(48) })
  .strict();
export const settingsSchema = z
  .object({
    theme: z.enum(['dark', 'light', 'system']),
    language: z.enum(['en']),
    reducedMotion: z.boolean(),
    notifications: z
      .object({
        inApp: z.boolean(),
        desktop: z.boolean(),
        onHandoff: z.boolean(),
        onContactChange: z.boolean(),
      })
      .strict(),
    shortcuts: z
      .object({
        commandPalette: shortcutSchema,
        openMessages: shortcutSchema,
        newContact: shortcutSchema,
        toggleTheme: shortcutSchema,
      })
      .strict(),
    desktop: z
      .object({
        launchAtStartup: z.boolean(),
        minimizeToTray: z.boolean(),
        closeToTray: z.boolean(),
        globalShortcut: z.string().min(3).max(48),
      })
      .strict(),
    labels: z
      .array(labelSchema)
      .max(40)
      .refine(
        (labels) =>
          new Set(labels.map((l) => l.id)).size === labels.length &&
          new Set(labels.map((l) => l.name.toLowerCase())).size === labels.length,
        'Labels must be unique',
      ),
  })
  .strict();
export type Settings = z.infer<typeof settingsSchema>;
export type Label = z.infer<typeof labelSchema>;
export const defaultSettings: Settings = {
  theme: 'dark',
  language: 'en',
  reducedMotion: false,
  notifications: { inApp: true, desktop: false, onHandoff: true, onContactChange: false },
  shortcuts: {
    commandPalette: { enabled: true, binding: 'Mod+k' },
    openMessages: { enabled: true, binding: 'Mod+Shift+m' },
    newContact: { enabled: true, binding: 'n' },
    toggleTheme: { enabled: true, binding: 'Mod+Shift+l' },
  },
  desktop: {
    launchAtStartup: false,
    minimizeToTray: true,
    closeToTray: true,
    globalShortcut: 'CommandOrControl+Shift+S',
  },
  labels: [],
};
export const contactInputSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80),
    snapchatUsername: z
      .string()
      .trim()
      .max(32)
      .regex(/^[a-zA-Z0-9._-]*$/, 'Use letters, numbers, periods, underscores or hyphens')
      .default(''),
    notes: z.string().trim().max(2000).default(''),
    labelIds: z.array(z.string().uuid()).max(20).default([]),
  })
  .strict();
export type ContactInput = z.infer<typeof contactInputSchema>;
export type Contact = ContactInput & { id: string; createdAt: string; updatedAt: string };
export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1).max(80),
});
export type User = z.infer<typeof userSchema>;
export const credentialsSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(12).max(128),
  })
  .strict();
export const registerSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(1).max(80),
});
export const capabilityKeys = [
  'officialAuthenticationHandoff',
  'openOfficialMessaging',
  'verifiedConnection',
  'openConversation',
  'sendMessage',
  'receiveMessage',
  'conversationHistory',
  'contactAccess',
  'messageNotifications',
] as const;
export type CapabilityKey = (typeof capabilityKeys)[number];
export type Capabilities = Record<CapabilityKey, boolean>;
export const officialWebCapabilities: Capabilities = {
  officialAuthenticationHandoff: true,
  openOfficialMessaging: true,
  verifiedConnection: false,
  openConversation: false,
  sendMessage: false,
  receiveMessage: false,
  conversationHistory: false,
  contactAccess: false,
  messageNotifications: false,
};
export const connectionStatusSchema = z.enum(['not_connected', 'handoff_opened', 'user_confirmed']);
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;
export type ConnectionState = {
  providerId: 'official-web';
  status: ConnectionStatus;
  lastHandoffAt: string | null;
  confirmedAt: string | null;
  verified: false;
};
export const initialConnection: ConnectionState = {
  providerId: 'official-web',
  status: 'not_connected',
  lastHandoffAt: null,
  confirmedAt: null,
  verified: false,
};
export const restrictionKinds = [
  'account',
  'device',
  'temporary_lock',
  'authentication',
  'network',
  'security_check',
  'unknown',
] as const;
export type RestrictionKind = (typeof restrictionKinds)[number];
export type NotificationKind =
  | 'welcome'
  | 'handoff'
  | 'contact'
  | 'settings'
  | 'security'
  | 'connection';
export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};
export type WorkspaceData = {
  user: User;
  settings: Settings;
  revision: number;
  contacts: Contact[];
  notifications: AppNotification[];
  connection: ConnectionState;
};
export type SyncMessage = {
  type: 'settings' | 'contacts' | 'notifications' | 'connection' | 'session-revoked';
  source: string;
  revision?: number;
};
export const capabilityLabels: Record<CapabilityKey, string> = {
  officialAuthenticationHandoff: 'Official sign-in handoff',
  openOfficialMessaging: 'Open Snapchat Web',
  verifiedConnection: 'Verified account connection',
  openConversation: 'Open a specific conversation',
  sendMessage: 'Send messages from SnapRun',
  receiveMessage: 'Receive Snapchat messages',
  conversationHistory: 'Conversation history',
  contactAccess: 'Snapchat friends access',
  messageNotifications: 'Snapchat message notifications',
};
export function mergeSettings(value: unknown): Settings {
  const parsed = settingsSchema.safeParse(value);
  return parsed.success ? parsed.data : structuredClone(defaultSettings);
}
export function filterContacts(contacts: Contact[], query: string, labelId?: string): Contact[] {
  const q = query.trim().toLowerCase().replace(/^@/, '');
  return contacts.filter(
    (c) =>
      (!labelId || c.labelIds.includes(labelId)) &&
      (!q || `${c.displayName} ${c.snapchatUsername} ${c.notes}`.toLowerCase().includes(q)),
  );
}
