import {
  normalizeBackupPinnedSearchResults,
  type BackupPinnedSearchResult,
  type SessionSummary,
} from '@/lib/raindrop-api';

const WORKSPACE_CACHE_PREFIX = 'raindrop-workspace-cache:v1';
const PINNED_RESULTS_STORAGE_KEY = `${WORKSPACE_CACHE_PREFIX}:pinned-results`;
const SESSIONS_STORAGE_KEY = `${WORKSPACE_CACHE_PREFIX}:sessions`;

function readLocalStorage(key: string) {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: string) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage write failures and continue with in-memory state.
  }
}

function removeLocalStorage(key: string) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage removal failures and continue with in-memory state.
  }
}

function normalizeSessionCover(value: unknown): SessionSummary['cover'] {
  if (typeof value === 'string') {
    const nextValue = value.trim();
    return nextValue ? nextValue : undefined;
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const nextValue = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);

  return nextValue.length > 0 ? nextValue : undefined;
}

export function normalizeCachedRaindropSessions(
  value: unknown,
): SessionSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<SessionSummary[]>((results, item) => {
    if (!item || typeof item !== 'object') {
      return results;
    }

    const candidate = item as Record<string, unknown>;
    const id = candidate.id;
    const title =
      typeof candidate.title === 'string' ? candidate.title.trim() : '';

    if (typeof id !== 'number' || !Number.isFinite(id) || !title) {
      return results;
    }

    const cover = normalizeSessionCover(candidate.cover);
    const lastUpdate =
      typeof candidate.lastUpdate === 'string' ? candidate.lastUpdate : undefined;
    const lastAction =
      typeof candidate.lastAction === 'string' ? candidate.lastAction : undefined;

    results.push({
      id,
      title,
      ...(cover ? { cover } : {}),
      ...(lastUpdate ? { lastUpdate } : {}),
      ...(lastAction ? { lastAction } : {}),
    });
    return results;
  }, []);
}

export function loadCachedRaindropPinnedResults() {
  const raw = readLocalStorage(PINNED_RESULTS_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    return normalizeBackupPinnedSearchResults(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveCachedRaindropPinnedResults(
  results: BackupPinnedSearchResult[],
) {
  writeLocalStorage(
    PINNED_RESULTS_STORAGE_KEY,
    JSON.stringify(normalizeBackupPinnedSearchResults(results)),
  );
}

export function loadCachedRaindropSessions() {
  const raw = readLocalStorage(SESSIONS_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    return normalizeCachedRaindropSessions(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveCachedRaindropSessions(sessions: SessionSummary[]) {
  writeLocalStorage(
    SESSIONS_STORAGE_KEY,
    JSON.stringify(normalizeCachedRaindropSessions(sessions)),
  );
}

export function clearRaindropWorkspaceCache() {
  removeLocalStorage(PINNED_RESULTS_STORAGE_KEY);
  removeLocalStorage(SESSIONS_STORAGE_KEY);
}
