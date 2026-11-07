import type { Capabilities, ConnectionStatus } from '@snaprun/shared';
export type HandoffPurpose = 'login' | 'register';
export type HandoffResult = { outcome: 'opened'; verified: false; url: string };
export interface ProviderContext {
  connectionStatus: ConnectionStatus;
}
