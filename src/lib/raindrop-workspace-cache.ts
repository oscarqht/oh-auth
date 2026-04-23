import {
  normalizeBackupPinnedSearchResults,
  type BackupPinnedSearchResult,
} from '@/lib/raindrop-api';

const WORKSPACE_CACHE_PREFIX = 'raindrop-workspace-cache:v1';
const PINNED_RESULTS_STORAGE_KEY = `${WORKSPACE_CACHE_PREFIX}:pinned-results`;

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

export function clearRaindropWorkspaceCache() {
  removeLocalStorage(PINNED_RESULTS_STORAGE_KEY);
}
