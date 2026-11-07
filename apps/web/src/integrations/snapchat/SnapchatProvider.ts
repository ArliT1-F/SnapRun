import type { Capabilities } from '@snaprun/shared';
import type { HandoffPurpose, HandoffResult, ProviderContext } from './types';
export interface SnapchatProvider {
  readonly id: string;
  readonly displayName: string;
  readonly capabilities: Capabilities;
  handoff(purpose: HandoffPurpose, context: ProviderContext): Promise<HandoffResult>;
}
