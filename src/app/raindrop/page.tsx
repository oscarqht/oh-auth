'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Nunito } from 'next/font/google';
import type {
  RaindropPinnedResultsResponse,
  RaindropSearchResponse,
} from '@/lib/raindrop-api';
import {
  clearStoredRaindropTokens,
  ensureValidRaindropTokens,
  fetchRaindropJson,
  getRaindropAuthHref,
} from '@/lib/raindrop-client';
import {
  clearRaindropWorkspaceCache,
  loadCachedRaindropPinnedResults,
  saveCachedRaindropPinnedResults,
} from '@/lib/raindrop-workspace-cache';
import {
  areStoredProviderTokensEqual,
  type StoredProviderTokens,
} from '@/lib/raindrop-web-auth';
import {
  getPinnedResultColor,
  getPinnedResultIcon,
  toPinnedRaindropResult,
  type PinnedRaindropResult,
} from '@/lib/raindrop-pins';
import { getCycledSearchResultIndex } from '@/lib/raindrop-search-navigation';
import styles from './page.module.css';

type AuthState = 'checking' | 'redirecting' | 'ready' | 'error';
const RAINDROP_ICON_HREF = '/img/provider-raindrop-icon.png';

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
});

type SearchResult =
  | {
      type: 'raindrop';
      data: RaindropSearchResponse['items'][number];
    }
  | {
      type: 'raindrop-collection';
      data: RaindropSearchResponse['collections'][number];
    };

function formatTimestamp(value?: string) {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function getCollectionHref(collectionId: number) {
  return `https://app.raindrop.io/my/${collectionId}`;
}

function createHeadIconLink(rel: string, href: string) {
  const link = document.createElement('link');
  link.rel = rel;
  link.href = href;
  link.type = 'image/png';
  return link;
}

function buildSearchResults(response: RaindropSearchResponse | null) {
  if (!response) {
    return [];
  }

  return [
    ...response.items.map(
      (item) =>
        ({
          type: 'raindrop',
          data: item,
        }) satisfies SearchResult,
    ),
    ...response.collections.map(
      (collection) =>
        ({
          type: 'raindrop-collection',
          data: collection,
        }) satisfies SearchResult,
    ),
  ];
}

function getSearchResultHref(result: SearchResult) {
  if (result.type === 'raindrop') {
    return result.data.link;
  }

  return getCollectionHref(result.data._id);
}

function isPlainLeftClick(event: ReactMouseEvent<HTMLAnchorElement>) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function SearchResultRow({
  icon,
  href,
  title,
  subtitle,
  badges,
  selected = false,
  resultId,
  resultRef,
  onClick,
}: {
  icon: string;
  href: string;
  title: string;
  subtitle: string;
  badges: ReactNode;
  selected?: boolean;
  resultId?: string;
  resultRef?: (node: HTMLAnchorElement | null) => void;
  onClick?: (event: ReactMouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <div
      className={`${styles.resultCard} ${selected ? styles.resultCardSelected : ''}`}
    >
      <a
        id={resultId}
        ref={resultRef}
        href={href}
        rel="noreferrer"
        className={styles.resultLink}
        role="option"
        aria-selected={selected}
        onClick={onClick}
      >
        <div className={styles.resultTopRow}>
          <span className={styles.resultLeadingIcon}>{icon}</span>
          <span className={styles.resultTitle}>{title}</span>
          <div className={styles.resultBadges}>{badges}</div>
        </div>
        <p className={styles.resultSubtitle}>{subtitle}</p>
      </a>
    </div>
  );
}

function SearchResults({
  results,
  query,
  searching,
  error,
  selectedIndex,
  getResultRef,
  onResultClick,
}: {
  results: SearchResult[];
  query: string;
  searching: boolean;
  error: string | null;
  selectedIndex: number | null;
  getResultRef: (index: number) => (node: HTMLAnchorElement | null) => void;
  onResultClick?: (event: ReactMouseEvent<HTMLAnchorElement>) => void;
}) {
  if (query.trim().length < 3) {
    return null;
  }

  if (searching) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-base-300/80 px-4 py-7 text-sm text-base-content/70">
        <span className="loading loading-spinner loading-sm" />
        Searching Raindrop...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-6 text-sm text-error">
        {error}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-base-300/80 px-4 py-7 text-center text-sm text-base-content/60">
        No results found.
      </div>
    );
  }

  return (
    <div className={styles.resultsList} role="listbox" id="raindrop-search-results">
      {results.map((result, index) => {
        const href = getSearchResultHref(result);
        const selected = index === selectedIndex;

        if (result.type === 'raindrop') {
          return (
            <SearchResultRow
              key={`item-${result.data._id}`}
              icon="💧"
              href={href}
              title={result.data.title || result.data.link}
              subtitle={result.data.link}
              selected={selected}
              resultId={`raindrop-search-result-${index}`}
              resultRef={getResultRef(index)}
              badges={
                result.data.collectionTitle ? (
                  <span className="badge badge-sm badge-ghost">
                    {result.data.collectionTitle}
                  </span>
                ) : null
              }
              onClick={onResultClick}
            />
          );
        }

        return (
          <SearchResultRow
            key={`collection-${result.data._id}`}
            href={href}
            icon="📥"
            title={result.data.title}
            subtitle="Open collection in Raindrop"
            selected={selected}
            resultId={`raindrop-search-result-${index}`}
            resultRef={getResultRef(index)}
            badges={
              <>
                {typeof result.data.count === 'number' ? (
                  <span className="badge badge-sm badge-ghost">
                    {result.data.count}
                  </span>
                ) : null}
                {result.data.parentCollectionTitle ? (
                  <span className="badge badge-sm badge-ghost">
                    {result.data.parentCollectionTitle}
                  </span>
                ) : null}
              </>
            }
            onClick={onResultClick}
          />
        );
      })}
    </div>
  );
}

function PinnedResults({
  results,
  loading,
  error,
}: {
  results: PinnedRaindropResult[];
  loading: boolean;
  error: string | null;
}) {
  let content: ReactNode;

  if (loading && results.length === 0) {
    content = (
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-base-300/80 px-4 py-7 text-sm text-base-content/70">
        <span className="loading loading-spinner loading-sm" />
        Loading pinned results...
      </div>
    );
  } else if (error && results.length === 0) {
    content = (
      <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-6 text-sm text-error">
        {error}
      </div>
    );
  } else if (results.length === 0) {
    content = (
      <div className="rounded-2xl border border-dashed border-base-300/80 px-4 py-7 text-center text-sm text-base-content/60">
        No pinned results found in Raindrop backup.
      </div>
    );
  } else {
    content = (
      <div className={styles.pinnedTags}>
        {results.map((result, index) => {
          const colors = getPinnedResultColor(result.href);

          return (
            <a
              key={result.key}
              href={result.href}
              rel="noreferrer"
              className={styles.pinnedTag}
              style={
                {
                  '--pinned-tag-bg': colors.bg,
                  '--pinned-tag-text': colors.text,
                } as CSSProperties
              }
              title={result.title}
            >
              <span className={styles.pinnedTagIndex}>{index + 1}</span>
              <span className={styles.pinnedTagIcon}>{getPinnedResultIcon(result.type)}</span>
              <span className={styles.pinnedTagTitle}>{result.title}</span>
            </a>
          );
        })}
      </div>
    );
  }

  return (
    <div className={styles.pinnedSection}>
      {content}
      {results.length > 0 && (loading || error) ? (
        <div
          className={`mt-3 rounded-2xl px-3 py-2 text-xs ${
            error
              ? 'border border-error/20 bg-error/5 text-error'
              : 'border border-base-300/80 bg-base-100/70 text-base-content/55'
          }`}
        >
          {error ? error : 'Refreshing pinned results...'}
        </div>
      ) : null}
    </div>
  );
}

export default function RaindropPage() {
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [authError, setAuthError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<StoredProviderTokens | null>(null);
  const [query, setQuery] = useState('');
  const [searchResponse, setSearchResponse] =
    useState<RaindropSearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState<number | null>(
    null,
  );
  const [pinnedResults, setPinnedResults] = useState<PinnedRaindropResult[]>(() =>
    loadCachedRaindropPinnedResults().map(toPinnedRaindropResult),
  );
  const [pinnedResultsLoading, setPinnedResultsLoading] = useState(false);
  const [pinnedResultsError, setPinnedResultsError] = useState<string | null>(
    null,
  );

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchResultRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const searchResults = useMemo(
    () => buildSearchResults(searchResponse),
    [searchResponse],
  );
  const showSearchResults = query.trim().length >= 3;

  function syncResolvedTokens(nextTokens: StoredProviderTokens) {
    setTokens((current) =>
      areStoredProviderTokensEqual(current, nextTokens) ? current : nextTokens,
    );
    setAuthError(null);
    setAuthState('ready');
  }

  async function resolveTokens() {
    try {
      const nextTokens = await ensureValidRaindropTokens();
      if (!nextTokens) {
        setAuthState('redirecting');
        window.location.replace(getRaindropAuthHref('/raindrop'));
        return null;
      }

      syncResolvedTokens(nextTokens);
      return nextTokens;
    } catch (error) {
      setAuthState('error');
      setAuthError(
        error instanceof Error ? error.message : 'Failed to validate login',
      );
      return null;
    }
  }

  async function loadPinnedResults() {
    setPinnedResultsLoading(true);
    setPinnedResultsError(null);

    try {
      const nextTokens = await resolveTokens();
      if (!nextTokens) {
        return;
      }

      const response = await fetchRaindropJson<RaindropPinnedResultsResponse>(
        '/api/raindrop/pinned-results',
        nextTokens,
      );
      saveCachedRaindropPinnedResults(response.results);
      setPinnedResults(response.results.map(toPinnedRaindropResult));
    } catch (error) {
      setPinnedResultsError(
        error instanceof Error
          ? error.message
          : 'Failed to load pinned results',
      );
    } finally {
      setPinnedResultsLoading(false);
    }
  }

  function handleReconnect() {
    clearStoredRaindropTokens();
    clearRaindropWorkspaceCache();
    setAuthState('redirecting');
    window.location.replace(getRaindropAuthHref('/raindrop'));
  }

  function handleLogout() {
    clearStoredRaindropTokens();
    clearRaindropWorkspaceCache();
    setTokens(null);
    setSearchResponse(null);
    setPinnedResults([]);
    setPinnedResultsLoading(false);
    setPinnedResultsError(null);
    window.location.replace('/');
  }

  useEffect(() => {
    const selector =
      'link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]';
    const expectedHref = new URL(
      RAINDROP_ICON_HREF,
      window.location.origin,
    ).href;
    const desiredRels = ['icon', 'shortcut icon', 'apple-touch-icon'] as const;
    const previousIcons = Array.from(
      document.head.querySelectorAll<HTMLLinkElement>(selector),
    ).map((node) => node.cloneNode(true) as HTMLLinkElement);
    let syncing = false;

    const syncIcons = () => {
      if (syncing) {
        return;
      }

      syncing = true;
      try {
        document.head
          .querySelectorAll<HTMLLinkElement>(selector)
          .forEach((node) => {
            if (node.href !== expectedHref || !desiredRels.includes(node.rel as (typeof desiredRels)[number])) {
              node.remove();
            }
          });

        desiredRels.forEach((rel) => {
          const existing = document.head.querySelector<HTMLLinkElement>(
            `link[rel="${rel}"][href="${expectedHref}"]`,
          );
          if (!existing) {
            document.head.appendChild(createHeadIconLink(rel, expectedHref));
          }
        });
      } finally {
        syncing = false;
      }
    };

    const observer = new MutationObserver(() => {
      syncIcons();
    });

    syncIcons();
    observer.observe(document.head, {
      childList: true,
      subtree: false,
      attributes: true,
      attributeFilter: ['href', 'rel'],
    });

    return () => {
      observer.disconnect();
      document.head.querySelectorAll(selector).forEach((node) => node.remove());
      previousIcons.forEach((node) => document.head.appendChild(node));
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const nextTokens = await ensureValidRaindropTokens();
        if (cancelled) {
          return;
        }

        if (!nextTokens) {
          setAuthState('redirecting');
          window.location.replace(getRaindropAuthHref('/raindrop'));
          return;
        }

        syncResolvedTokens(nextTokens);
      } catch (error) {
        if (!cancelled) {
          setAuthState('error');
          setAuthError(
            error instanceof Error
              ? error.message
              : 'Failed to validate login',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authState !== 'ready' || !tokens) {
      return;
    }

    void loadPinnedResults();
    // Trigger pinned result loading whenever we reach a ready authenticated state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState, tokens]);

  useEffect(() => {
    if (query.trim().length < 3) {
      setSearchResponse(null);
      setSearchError(null);
      setSearching(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setSearching(true);
        setSearchError(null);

        try {
          const nextTokens = await ensureValidRaindropTokens();
          if (nextTokens) {
            syncResolvedTokens(nextTokens);
          } else {
            setAuthState('redirecting');
            window.location.replace(getRaindropAuthHref('/raindrop'));
            return;
          }

          if (!nextTokens || cancelled) {
            return;
          }

          const response = await fetchRaindropJson<RaindropSearchResponse>(
            `/api/raindrop/search?q=${encodeURIComponent(query.trim())}`,
            nextTokens,
          );

          if (!cancelled) {
            setSearchResponse(response);
          }
        } catch (error) {
          if (!cancelled) {
            setSearchError(
              error instanceof Error ? error.message : 'Failed to search',
            );
          }
        } finally {
          if (!cancelled) {
            setSearching(false);
          }
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    setSelectedSearchIndex(null);
  }, [query]);

  useEffect(() => {
    if (!showSearchResults || searching || searchError || searchResults.length === 0) {
      setSelectedSearchIndex(null);
      return;
    }

    setSelectedSearchIndex((current) => {
      if (current === null || current < 0 || current >= searchResults.length) {
        return null;
      }

      return current;
    });
  }, [searchError, searchResults.length, searching, showSearchResults]);

  useEffect(() => {
    if (selectedSearchIndex === null) {
      return;
    }

    searchResultRefs.current[selectedSearchIndex]?.scrollIntoView({
      block: 'nearest',
    });
  }, [selectedSearchIndex]);

  function handleSearchInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!showSearchResults || searching || searchError || searchResults.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedSearchIndex((current) =>
        getCycledSearchResultIndex(
          current,
          event.key === 'ArrowDown' ? 'next' : 'previous',
          searchResults.length,
        ),
      );
      return;
    }

    if (event.key === 'Enter' && selectedSearchIndex !== null) {
      const selectedResult = searchResults[selectedSearchIndex];
      if (!selectedResult) {
        return;
      }

      event.preventDefault();
      window.location.assign(getSearchResultHref(selectedResult));
    }
  }

  if (authState === 'checking' || authState === 'redirecting') {
    return (
      <main className={`${nunito.className} ${styles.page}`}>
        <div className={styles.stateLayout}>
          <div className={`${styles.card} ${styles.stateCard}`}>
            <div className={styles.brand}>
              <Image
                src="/img/provider-raindrop-icon.png"
                alt="Raindrop"
                width={32}
                height={32}
                className={styles.brandIcon}
              />
              <span>Raindrop</span>
            </div>
            <h1 className={styles.stateTitle}>Connecting to Raindrop</h1>
            <p className={styles.stateMessage}>
              {authState === 'checking'
                ? 'Checking your saved Raindrop login.'
                : 'Redirecting you to Raindrop OAuth.'}
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <span className="loading loading-spinner loading-md" />
              <span className="text-sm text-base-content/60">
                Please wait...
              </span>
            </div>
            <div className={styles.stateActions}>
              <a href={getRaindropAuthHref('/raindrop')} className="btn btn-primary">
                Continue manually
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (authState === 'error') {
    return (
      <main className={`${nunito.className} ${styles.page}`}>
        <div className={styles.stateLayout}>
          <div className={`${styles.card} ${styles.stateCard}`}>
            <div className={styles.brand}>
              <Image
                src="/img/provider-raindrop-icon.png"
                alt="Raindrop"
                width={32}
                height={32}
                className={styles.brandIcon}
              />
              <span>Raindrop</span>
            </div>
            <h1 className={styles.stateTitle}>Could not validate login</h1>
            <p className={styles.stateMessage}>
              {authError ?? 'The stored Raindrop login could not be used.'}
            </p>
            <div className={styles.stateActions}>
              <button className="btn btn-primary" onClick={handleReconnect}>
                Reconnect Raindrop
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  clearStoredRaindropTokens();
                  setAuthError(null);
                  setAuthState('checking');
                  void (async () => {
                    const nextTokens = await resolveTokens();
                    if (nextTokens) {
                      await loadPinnedResults();
                    }
                  })();
                }}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={`${nunito.className} ${styles.page}`}>
      <div className={styles.shell}>
        <div className={styles.content}>
          <header className={styles.header}>
            <div className={styles.brand}>
              <Image
                src="/img/provider-raindrop-icon.png"
                alt="Raindrop"
                width={32}
                height={32}
                className={styles.brandIcon}
              />
              <span>Raindrop</span>
            </div>
            <div className={styles.headerActions}>
              <Link
                className="btn btn-sm btn-ghost"
                href="/raindrop/albums"
                target="_blank"
              >
                Albums
              </Link>
              <button className="btn btn-sm btn-outline" onClick={handleLogout}>
                Log out
              </button>
            </div>
          </header>

          <div className={styles.statusRow}>
            {tokens
              ? `Signed in. Token expires ${formatTimestamp(
                  new Date(tokens.expiresAt).toISOString(),
                )}.`
              : ''}
          </div>

          <section className={styles.main}>
            <article
              className={`${styles.card} ${styles.searchCard}`}
              aria-labelledby="bookmarks-search-heading"
            >
              <h1 id="bookmarks-search-heading" className="sr-only">
                Bookmarks Search
              </h1>
              <div className="space-y-3">
                <label className={styles.softInput}>
                  <span className={styles.searchIcon} aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="11" cy="11" r="6.5" />
                      <path d="M16 16L21 21" />
                    </svg>
                  </span>
                  <span className={styles.softInputFieldWrap}>
                    <input
                      ref={searchInputRef}
                      type="text"
                      autoFocus
                      inputMode="search"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-controls={showSearchResults ? 'raindrop-search-results' : undefined}
                      aria-expanded={showSearchResults}
                      aria-activedescendant={
                        selectedSearchIndex !== null
                          ? `raindrop-search-result-${selectedSearchIndex}`
                          : undefined
                      }
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={handleSearchInputKeyDown}
                      placeholder="Search bookmarks..."
                      className={styles.softInputField}
                    />
                  </span>
                  {query ? (
                    <button
                      type="button"
                      className={styles.clearSearchButton}
                      aria-label="Clear search"
                      title="Clear search"
                      onClick={() => setQuery('')}
                    >
                      ✕
                    </button>
                  ) : null}
                </label>

                {showSearchResults ? (
                  <div className={styles.scrollArea}>
                    <SearchResults
                      results={searchResults}
                      query={query}
                      searching={searching}
                      error={searchError}
                      selectedIndex={selectedSearchIndex}
                      getResultRef={(index) => (node) => {
                        searchResultRefs.current[index] = node;
                      }}
                      onResultClick={(event) => {
                        if (!isPlainLeftClick(event)) {
                          return;
                        }

                        setQuery('');
                        searchInputRef.current?.blur();
                      }}
                    />
                  </div>
                ) : (
                  <PinnedResults
                    results={pinnedResults}
                    loading={pinnedResultsLoading}
                    error={pinnedResultsError}
                  />
                )}
              </div>
            </article>
          </section>
        </div>
      </div>
    </main>
  );
}
