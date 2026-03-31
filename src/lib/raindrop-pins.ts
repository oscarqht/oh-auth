import type { BackupPinnedSearchResult } from '@/lib/raindrop-api';

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
  type: BackupPinnedSearchResult['type'];
  href: string;
  title: string;
};

export function toPinnedRaindropResult(
  result: BackupPinnedSearchResult,
): PinnedRaindropResult {
  return {
    key: `${result.type}:${result.url}`,
    type: result.type,
    href: result.url,
    title: result.title,
  };
}

export function getPinnedResultIcon(type: BackupPinnedSearchResult['type']) {
  switch (type) {
    case 'raindrop':
      return '💧';
    case 'raindrop-collection':
      return '📥';
    case 'notion-page':
      return '📝';
    case 'notion-data-source':
      return '🗃️';
  }
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
