export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
export const clientId = crypto.randomUUID();
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  let response: globalThis.Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': clientId },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(
      'Cannot reach the companion service. Check your connection and try again.',
      0,
      'NETWORK_ERROR',
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok && response.status === 401 && !path.startsWith('/auth/'))
    window.dispatchEvent(new Event('snaprun:session-expired'));
  if (!response.ok)
    throw new ApiError(
      typeof data.error === 'string' ? data.error : 'Something went wrong. Please try again.',
      response.status,
      data.code ?? 'REQUEST_FAILED',
      data,
    );
  return data as T;
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
export function relativeTime(date: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)}d ago`;
  return new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}
