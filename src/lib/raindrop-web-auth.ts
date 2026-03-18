export const RAINDROP_PROVIDER_ID = 'raindrop';

export type StoredProviderTokens = {
  provider: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

export function getProviderTokenStorageKey(providerId: string) {
  return `oh-auth:provider-tokens:${providerId}`;
}

export function sanitizeWebRedirectTarget(
  value: unknown,
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith('/')) {
    return null;
  }

  if (trimmed.startsWith('//')) {
    return null;
  }

  return trimmed;
}

export function toStoredProviderTokens(
  providerId: string,
  tokenPayload: unknown,
  options: {
    fallbackRefreshToken?: string;
    now?: number;
  } = {},
): StoredProviderTokens | null {
  if (!tokenPayload || typeof tokenPayload !== 'object') {
    return null;
  }

  const payload = tokenPayload as Record<string, unknown>;
  const accessToken = payload.access_token;
  const expiresIn = payload.expires_in;

  if (typeof accessToken !== 'string' || accessToken.trim().length === 0) {
    return null;
  }

  const expiresInSeconds =
    typeof expiresIn === 'number'
      ? expiresIn
      : typeof expiresIn === 'string'
      ? Number(expiresIn)
      : NaN;
  const now = options.now ?? Date.now();
  const safeExpiresInSeconds = Number.isFinite(expiresInSeconds)
    ? Math.max(expiresInSeconds, 60)
    : 60 * 60;

  const refreshToken =
    typeof payload.refresh_token === 'string'
      ? payload.refresh_token
      : options.fallbackRefreshToken ?? '';

  return {
    provider: providerId,
    accessToken,
    refreshToken,
    expiresAt: now + safeExpiresInSeconds * 1000,
  };
}

export function isStoredProviderTokenExpired(
  tokens: StoredProviderTokens | null,
  bufferMs = 60_000,
) {
  if (!tokens) {
    return true;
  }

  return tokens.expiresAt <= Date.now() + bufferMs;
}

export function areStoredProviderTokensEqual(
  left: StoredProviderTokens | null,
  right: StoredProviderTokens | null,
) {
  if (left === right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return (
    left.provider === right.provider &&
    left.accessToken === right.accessToken &&
    left.refreshToken === right.refreshToken &&
    left.expiresAt === right.expiresAt
  );
}

export function buildWebOauthStorageScript(
  providerId: string,
  tokenPayload: unknown,
  redirectTo: string,
) {
  const storedTokens = toStoredProviderTokens(providerId, tokenPayload);
  if (!storedTokens) {
    return null;
  }

  const storageKey = getProviderTokenStorageKey(providerId);

  return `(() => {
    const storageKey = ${JSON.stringify(storageKey)};
    const redirectTo = ${JSON.stringify(redirectTo)};
    const tokens = ${JSON.stringify(storedTokens)};

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(tokens));
    } catch (error) {
      console.error('[callback] Failed to persist web tokens', error);
    }

    window.location.replace(redirectTo);
  })();`;
}
