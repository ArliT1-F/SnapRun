import type { Settings } from '@snaprun/shared';
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
  await store.set('settings', {
    theme: settings.theme,
    language: settings.language,
    reducedMotion: settings.reducedMotion,
    desktop: settings.desktop,
  });
  await store.save();
}
export async function desktopNotify(title: string, body: string) {
  if (isDesktop()) {
    const { isPermissionGranted, requestPermission, sendNotification } = await import(
      '@tauri-apps/plugin-notification'
    );
    if ((await isPermissionGranted()) || (await requestPermission()) === 'granted')
      sendNotification({ title, body });
  } else if ('Notification' in window && Notification.permission === 'granted')
    new Notification(title, { body, icon: '/favicon.svg' });
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
