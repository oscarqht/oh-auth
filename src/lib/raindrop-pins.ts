import type { RaindropSearchResponse } from '@/lib/raindrop-api';

const PINNED_RESULTS_STORAGE_KEY = 'nenya.raindrop.pinned-results.v1';
const PINNED_COLOR_PALETTE = [
  { bg: '#fecaca', text: '#991b1b' },
  { bg: '#fed7aa', text: '#9a3412' },
  { bg: '#fef08a', text: '#854d0e' },
  { bg: '#bbf7d0', text: '#166534' },
  { bg: '#99f6e4', text: '#0f766e' },
  { bg: '#bae6fd', text: '#075985' },
  { bg: '#c7d2fe', text: '#3730a3' },
  { bg: '#e9d5ff', text: '#6b21a8' },
  { bg: '#fbcfe8', text: '#9d174d' },
  { bg: '#fecdd3', text: '#9f1239' },
] as const;

export type PinnedRaindropResult = {
  key: string;
  type: 'raindrop' | 'raindrop-collection';
  id: number;
  href: string;
  title: string;
  subtitle: string;
  badge?: string;
  badgeTone: 'ghost' | 'accent';
  count?: number;
};

type LegacyPinnedRaindropResult = {
  title: string;
  url: string;
  type: string;
};

export type PinnedRaindropResultsBackupPayload = {
  version: 1;
  savedAt: number;
  pinnedSearchResults: LegacyPinnedRaindropResult[];
};

type SearchResult =
  | {
      type: 'raindrop';
      data: RaindropSearchResponse['items'][number];
    }
  | {
      type: 'raindrop-collection';
      data: RaindropSearchResponse['collections'][number];
    };

function getPinnedResultKey(type: PinnedRaindropResult['type'], id: number) {
  return `${type}:${id}`;
}

function getFallbackPinnedResultId(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = seed.charCodeAt(index) + ((hash << 5) - hash);
  }

  return Math.abs(hash) || 1;
}

function getCollectionIdFromHref(href: string) {
  try {
    const parsed = new URL(href);
    const match = parsed.pathname.match(/^\/my\/(-?\d+)\/?$/);
    if (!match) {
      return null;
    }

    const id = Number(match[1]);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

function isLegacyPinnedRaindropResult(
  value: unknown,
): value is LegacyPinnedRaindropResult {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.title === 'string' &&
    typeof candidate.url === 'string' &&
    typeof candidate.type === 'string'
  );
}

function normalizeLegacyPinnedRaindropResult(
  value: LegacyPinnedRaindropResult,
): PinnedRaindropResult {
  const inferredType =
    value.type === 'raindrop-collection' || getCollectionIdFromHref(value.url) !== null
      ? 'raindrop-collection'
      : 'raindrop';
  const id =
    getCollectionIdFromHref(value.url) ??
    getFallbackPinnedResultId(`${value.type}:${value.url}`);

  return {
    key: getPinnedResultKey(inferredType, id),
    type: inferredType,
    id,
    href: value.url,
    title: value.title,
    subtitle:
      inferredType === 'raindrop-collection'
        ? 'Open collection in Raindrop'
        : value.url,
    badgeTone: 'ghost',
  };
}

export function toPinnedRaindropResult(
  result: SearchResult,
): PinnedRaindropResult {
  if (result.type === 'raindrop') {
    return {
      key: getPinnedResultKey(result.type, result.data._id),
      type: result.type,
      id: result.data._id,
      href: result.data.link,
      title: result.data.title || result.data.link,
      subtitle: result.data.link,
      badge: result.data.collectionTitle,
      badgeTone: result.data.isSession ? 'accent' : 'ghost',
    };
  }

  return {
    key: getPinnedResultKey(result.type, result.data._id),
    type: result.type,
    id: result.data._id,
    href:
      result.data._id === -1
        ? 'https://app.raindrop.io/my/-1'
        : `https://app.raindrop.io/my/${result.data._id}`,
    title: result.data.title,
    subtitle: 'Open collection in Raindrop',
    badge: result.data.parentCollectionTitle,
    badgeTone: result.data.isSession ? 'accent' : 'ghost',
    count: result.data.count,
  };
}

export function loadPinnedRaindropResults() {
  if (typeof window === 'undefined') {
    return [];
  }

  const raw = window.localStorage.getItem(PINNED_RESULTS_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    return readPinnedRaindropResultsPayload(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function savePinnedRaindropResults(results: PinnedRaindropResult[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(
    PINNED_RESULTS_STORAGE_KEY,
    JSON.stringify(results),
  );
}

export function togglePinnedRaindropResult(
  currentResults: PinnedRaindropResult[],
  nextResult: PinnedRaindropResult,
) {
  const existingIndex = currentResults.findIndex(
    (result) => result.key === nextResult.key,
  );

  if (existingIndex >= 0) {
    return currentResults.filter((result) => result.key !== nextResult.key);
  }

  return [nextResult, ...currentResults];
}

export function readPinnedRaindropResultsPayload(value: unknown) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (isPinnedRaindropResult(item)) {
        return [item];
      }
      if (isLegacyPinnedRaindropResult(item)) {
        return [normalizeLegacyPinnedRaindropResult(item)];
      }
      return [];
    });
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const candidate = value as {
    pinnedSearchResults?: unknown;
  };

  if (!Array.isArray(candidate.pinnedSearchResults)) {
    return [];
  }

  return readPinnedRaindropResultsPayload(candidate.pinnedSearchResults);
}

export function createPinnedRaindropResultsBackupPayload(
  results: PinnedRaindropResult[],
  savedAt = Date.now(),
): PinnedRaindropResultsBackupPayload {
  return {
    version: 1,
    savedAt,
    pinnedSearchResults: results.filter(isPinnedRaindropResult).map((result) => ({
      title: result.title,
      url: result.href,
      type: result.type,
    })),
  };
}

export function isPinnedRaindropResult(
  value: unknown,
): value is PinnedRaindropResult {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.key === 'string' &&
    (candidate.type === 'raindrop' || candidate.type === 'raindrop-collection') &&
    typeof candidate.id === 'number' &&
    typeof candidate.href === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.subtitle === 'string' &&
    (candidate.badge === undefined || typeof candidate.badge === 'string') &&
    (candidate.badgeTone === 'ghost' || candidate.badgeTone === 'accent') &&
    (candidate.count === undefined || typeof candidate.count === 'number')
  );
}

export function getPinnedResultColor(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = seed.charCodeAt(index) + ((hash << 5) - hash);
  }

  return PINNED_COLOR_PALETTE[
    Math.abs(hash) % PINNED_COLOR_PALETTE.length
  ] as (typeof PINNED_COLOR_PALETTE)[number];
}
