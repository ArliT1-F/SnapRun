import type { ConnectionStatus } from '@snaprun/shared';
export function connectionLabel(status: ConnectionStatus) {
  return {
    not_connected: 'Not connected',
    handoff_opened: 'Handoff opened',
    user_confirmed: 'Signed in · self-reported',
  }[status];
}
export const restrictionGuidance = {
  account: {
    title: 'Account restriction',
    body: 'SnapRun cannot inspect or lift Snapchat account restrictions. Review the notice in Snapchat and contact Snapchat Support.',
    kind: 'account',
  },
  device: {
    title: 'Device restriction',
    body: 'If Snapchat says this device is unsupported or restricted, use a supported device and contact Snapchat Support. SnapRun does not alter device identity or bypass restrictions.',
    kind: 'device',
  },
  temporary_lock: {
    title: 'Temporary account lock',
    body: 'Follow Snapchat’s official unlock instructions. Do not repeatedly retry or share credentials with third-party tools.',
    kind: 'account',
  },
  authentication: {
    title: 'Sign-in problem',
    body: 'Return to Snapchat’s official sign-in page and follow its recovery options. Never enter your Snapchat password into SnapRun.',
    kind: 'authentication',
  },
  network: {
    title: 'Network problem',
    body: 'Check your internet connection, then reopen Snapchat. This is a local connectivity check, not a diagnosis of your Snapchat account.',
    kind: 'network',
  },
  security_check: {
    title: 'Security check required',
    body: 'Complete any CAPTCHA or security check yourself in Snapchat’s official interface. SnapRun never solves or bypasses these checks.',
    kind: 'authentication',
  },
  unknown: {
    title: 'Not sure what happened?',
    body: 'Check the exact message in Snapchat and visit official Snapchat Support. SnapRun cannot see Snapchat-side errors.',
    kind: 'unknown',
  },
} as const;
