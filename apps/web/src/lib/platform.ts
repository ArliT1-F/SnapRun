import { localPreferencePersistence, type Settings } from '@snaprun/shared';
import { systemNotificationPayload } from './privacy';

export const isDesktop = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export async function openExternal(url: string) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== 'https:' ||
    !['web.snapchat.com', 'help.snapchat.com', 'accounts.snapchat.com', 'snapchat.com'].includes(
      parsed.hostname,
    )
  )
    throw new Error('Only official Snapchat destinations can be opened.');
  if (isDesktop()) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('open_official_snapchat', { url: parsed.href });
  } else {
    const win = window.open(parsed.href, '_blank', 'noopener,noreferrer');
    if (!win)
      throw new Error(
        'Your browser blocked the new tab. Allow pop-ups for SnapRun, then try again.',
      );
  }
}

export async function cacheDesktopSettings(settings: Settings) {
  if (!isDesktop()) return;
  const { load } = await import('@tauri-apps/plugin-store');
  const store = await load('preferences.json', { autoSave: true });
  if (!localPreferencePersistence(settings)) {
    await store.clear();
    await store.save();
    return;
  }
  await store.set('settings', {
    theme: settings.theme,
    language: settings.language,
    reducedMotion: settings.reducedMotion,
    desktop: settings.desktop,
  });
  await store.save();
}

export async function clearDesktopPreferencesCache(): Promise<boolean> {
  if (!isDesktop()) return false;
  const { load } = await import('@tauri-apps/plugin-store');
  const store = await load('preferences.json', { autoSave: false });
  await store.clear();
  await store.save();
  return true;
}

export async function desktopNotify(title: string, body: string, redact = true) {
  const payload = systemNotificationPayload(title, body, redact);
  if (isDesktop()) {
    const { isPermissionGranted, requestPermission, sendNotification } = await import(
      '@tauri-apps/plugin-notification'
    );
    if ((await isPermissionGranted()) || (await requestPermission()) === 'granted')
      sendNotification(payload);
  } else if ('Notification' in window && Notification.permission === 'granted')
    new Notification(payload.title, { body: payload.body, icon: '/favicon.svg' });
}

export async function requestNotificationPermission() {
  if (isDesktop()) {
    const { isPermissionGranted, requestPermission } = await import(
      '@tauri-apps/plugin-notification'
    );
    return (await isPermissionGranted()) || (await requestPermission()) === 'granted';
  }
  if (!('Notification' in window))
    throw new Error('This browser does not support system notifications.');
  return (await Notification.requestPermission()) === 'granted';
}

export type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported' | 'unknown';
export async function notificationPermissionState(): Promise<PermissionState> {
  try {
    if (isDesktop()) {
      const { isPermissionGranted } = await import('@tauri-apps/plugin-notification');
      return (await isPermissionGranted()) ? 'granted' : 'default';
    }
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  } catch {
    return 'unknown';
  }
}

export async function desktopAutostartEnabled(): Promise<boolean | null> {
  if (!isDesktop()) return null;
  try {
    const { isEnabled } = await import('@tauri-apps/plugin-autostart');
    return await isEnabled();
  } catch {
    return null;
  }
}

let registeredShortcut: string | undefined;
export async function applyDesktopBehavior(settings: Settings) {
  if (!isDesktop()) return;
  const { enable, disable, isEnabled } = await import('@tauri-apps/plugin-autostart');
  if (settings.desktop.launchAtStartup !== (await isEnabled())) {
    if (settings.desktop.launchAtStartup) await enable();
    else await disable();
  }
  const { register, unregister, isRegistered } = await import('@tauri-apps/plugin-global-shortcut');
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  if (registeredShortcut && (await isRegistered(registeredShortcut)))
    await unregister(registeredShortcut);
  if (await isRegistered(settings.desktop.globalShortcut))
    await unregister(settings.desktop.globalShortcut);
  await register(settings.desktop.globalShortcut, async (event) => {
    if (event.state === 'Pressed') {
      const win = getCurrentWindow();
      await win.unminimize();
      await win.show();
      await win.setFocus();
    }
  });
  registeredShortcut = settings.desktop.globalShortcut;
}

export async function desktopShortcutRegistered(binding: string): Promise<boolean | null> {
  if (!isDesktop()) return null;
  try {
    const { isRegistered } = await import('@tauri-apps/plugin-global-shortcut');
    return await isRegistered(binding);
  } catch {
    return null;
  }
}
