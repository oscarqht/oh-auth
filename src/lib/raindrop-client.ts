import {
  getProviderTokenStorageKey,
  isStoredProviderTokenExpired,
  RAINDROP_PROVIDER_ID,
  toStoredProviderTokens,
  type StoredProviderTokens,
} from '@/lib/raindrop-web-auth';

const STORAGE_KEY = getProviderTokenStorageKey(RAINDROP_PROVIDER_ID);

export type JsonError = {
  error?: string;
};

export function getRaindropAuthHref(redirectTo = '/raindrop') {
  const state = JSON.stringify({ webRedirectTo: redirectTo });
  return `/auth/raindrop?state=${encodeURIComponent(state)}`;
}

export function loadStoredRaindropTokens() {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredProviderTokens;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.expiresAt !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredRaindropTokens(tokens: StoredProviderTokens) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export function clearStoredRaindropTokens() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}

export async function refreshStoredRaindropTokens(
  currentTokens: StoredProviderTokens,
) {
  if (!currentTokens.refreshToken) {
    clearStoredRaindropTokens();
    return null;
  }

  const response = await fetch('/auth/raindrop/refresh', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      refresh_token: currentTokens.refreshToken,
    }),
  });

  const data = (await response.json()) as Record<string, unknown> & JsonError;
  if (!response.ok) {
    clearStoredRaindropTokens();
    throw new Error(data.error ?? 'Failed to refresh Raindrop access token');
  }

  const nextTokens = toStoredProviderTokens(RAINDROP_PROVIDER_ID, data, {
    fallbackRefreshToken: currentTokens.refreshToken,
  });

  if (!nextTokens) {
    clearStoredRaindropTokens();
    throw new Error('Refreshed token payload was incomplete');
  }

  saveStoredRaindropTokens(nextTokens);
  return nextTokens;
}

export async function ensureValidRaindropTokens() {
  const currentTokens = loadStoredRaindropTokens();
  if (!currentTokens) {
    return null;
  }

  if (!isStoredProviderTokenExpired(currentTokens)) {
    return currentTokens;
  }

  return refreshStoredRaindropTokens(currentTokens);
}

export async function fetchRaindropJson<T>(
  path: string,
  tokens: StoredProviderTokens,
) {
  const response = await fetch(path, {
    headers: {
      authorization: `Bearer ${tokens.accessToken}`,
    },
  });

  const data = (await response.json()) as T & JsonError;
  if (!response.ok) {
    throw new Error(data.error ?? 'Raindrop request failed');
  }

  return data;
}
