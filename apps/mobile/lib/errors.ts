// Centralized error → user-facing message mapping.
// Used by the global QueryCache / MutationCache onError handlers in app/_layout.tsx
// and may also be called directly by screens that render an inline error.

const GENERIC = 'Что-то пошло не так. Попробуй ещё раз.';
const NETWORK = 'Нет связи с сервером. Проверь интернет.';
const STALE_SESSION = 'Сессия завершилась. Зайди снова, чтобы продолжить.';

// Domain-level error tags thrown by hooks/RPCs in this codebase.
// Keep the keys in sync with the strings in `throw new Error('...')`.
const DOMAIN_MESSAGES: Record<string, string> = {
  anon_cart_limit: 'В корзине может быть только один товар.',
  already_reserved: 'Этот товар уже у кого-то в корзине.',
  out_of_stock: 'Кто-то успел раньше — товара уже нет.',
};

type SupabaseLikeError = {
  message?: unknown;
  code?: unknown;
  name?: unknown;
  details?: unknown;
};

function isSupabaseLike(err: unknown): err is SupabaseLikeError {
  return typeof err === 'object' && err !== null;
}

function isNetworkError(err: unknown): boolean {
  if (!isSupabaseLike(err)) return false;
  const name = typeof err.name === 'string' ? err.name : '';
  const msg = typeof err.message === 'string' ? err.message : '';
  return (
    name === 'TypeError' && /Network request failed|Failed to fetch/i.test(msg)
  );
}

// Detects errors that mean the local JWT references a user/session the server
// no longer recognizes (deleted user, revoked session, expired without refresh).
// Reactive layer for stale sessions; the proactive layer is getUser() at boot
// — see stores/auth.ts initialize().
export function isStaleSessionError(err: unknown): boolean {
  if (!isSupabaseLike(err)) return false;
  const code = typeof err.code === 'string' ? err.code : '';
  const msg = typeof err.message === 'string' ? err.message : '';
  const details = typeof err.details === 'string' ? err.details : '';
  const hay = `${msg} ${details}`;

  // PostgREST: JWT expired / invalid (server-rejected token)
  if (code === 'PGRST301') return true;

  // 23502 = NOT NULL violation on user_id (auth.uid() returned null)
  // 23503 = FK violation on user_id → auth.users (JWT sub references a deleted user)
  // Both fire from the same root cause: the local session is no longer authoritative.
  if ((code === '23502' || code === '23503') && /user_id/i.test(hay)) return true;

  return false;
}

export function formatError(err: unknown): string {
  if (isStaleSessionError(err)) return STALE_SESSION;

  if (isSupabaseLike(err) && typeof err.message === 'string') {
    const tag = DOMAIN_MESSAGES[err.message];
    if (tag) return tag;
  }

  if (isNetworkError(err)) return NETWORK;

  return GENERIC;
}
