'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Nunito } from 'next/font/google';
import type {
  RaindropSearchResponse,
  SessionDetails,
  SessionSummary,
} from '@/lib/raindrop-api';
import {
  clearStoredRaindropTokens,
  ensureValidRaindropTokens,
  fetchRaindropJson,
  getRaindropAuthHref,
} from '@/lib/raindrop-client';
import {
  areStoredProviderTokensEqual,
  type StoredProviderTokens,
} from '@/lib/raindrop-web-auth';
import styles from './page.module.css';

type AuthState = 'checking' | 'redirecting' | 'ready' | 'error';

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

function getCoverUrl(cover?: string[] | string) {
  if (Array.isArray(cover)) {
    return cover[0];
  }

  return cover;
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

function SearchResults({
  results,
  query,
  searching,
  error,
}: {
  results: SearchResult[];
  query: string;
  searching: boolean;
  error: string | null;
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
    <div className="space-y-2">
      {results.map((result) => {
        if (result.type === 'raindrop') {
          const href = result.data.link;
          return (
            <a
              key={`item-${result.data._id}`}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="group block rounded-2xl border border-base-300/70 bg-base-100/80 px-4 py-3 transition hover:border-base-content/20 hover:bg-base-200/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm">💧</span>
                    <span className="truncate font-medium">
                      {result.data.title || result.data.link}
                    </span>
                    {result.data.collectionTitle ? (
                      <span
                        className={`badge badge-sm ${
                          result.data.isSession ? 'badge-accent' : 'badge-ghost'
                        }`}
                      >
                        {result.data.collectionTitle}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-xs text-base-content/60">
                    {result.data.link}
                  </p>
                </div>
                <span className="text-base-content/40 transition group-hover:text-base-content">
                  ↗
                </span>
              </div>
            </a>
          );
        }

        return (
          <a
            key={`collection-${result.data._id}`}
            href={getCollectionHref(result.data._id)}
            target="_blank"
            rel="noreferrer"
            className="group block rounded-2xl border border-base-300/70 bg-base-100/80 px-4 py-3 transition hover:border-base-content/20 hover:bg-base-200/60"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm">📥</span>
                  <span className="truncate font-medium">
                    {result.data.title}
                  </span>
                  {typeof result.data.count === 'number' ? (
                    <span className="badge badge-sm badge-ghost">
                      {result.data.count}
                    </span>
                  ) : null}
                  {result.data.parentCollectionTitle ? (
                    <span
                      className={`badge badge-sm ${
                        result.data.isSession ? 'badge-accent' : 'badge-ghost'
                      }`}
                    >
                      {result.data.parentCollectionTitle}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-xs text-base-content/60">
                  Open collection in Raindrop
                </p>
              </div>
              <span className="text-base-content/40 transition group-hover:text-base-content">
                ↗
              </span>
            </div>
          </a>
        );
      })}
    </div>
  );
}

function SessionTree({ details }: { details: SessionDetails }) {
  if (details.windows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-base-300 px-4 py-6 text-center text-xs italic text-base-content/50">
        No open tabs in this session.
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      {details.windows.map((windowItem, index) => (
        <details
          key={`window-${windowItem.id}-${index}`}
          className="overflow-hidden rounded-lg border border-base-300 bg-base-100/60"
          open
        >
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-base-content/55">
            Window {index + 1}
          </summary>
          <div className="min-w-0 space-y-2 px-3 pb-3">
            {windowItem.tree.map((node, nodeIndex) => {
              if (node.type === 'tab') {
                return (
                  <a
                    key={`tab-${node.id}-${nodeIndex}`}
                    href={node.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start justify-between gap-3 overflow-hidden rounded-md px-2 py-2 text-sm transition hover:bg-base-200"
                  >
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div className="break-words">{node.title || node.url}</div>
                      <div className="truncate text-xs text-base-content/55">
                        {node.url}
                      </div>
                    </div>
                    <span className="shrink-0 text-base-content/40">↗</span>
                  </a>
                );
              }

              return (
                  <div
                    key={`group-${node.id}-${nodeIndex}`}
                    className="min-w-0 rounded-md bg-transparent"
                  >
                  <div className="px-2 py-2 text-sm font-medium">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ backgroundColor: node.color || 'gray' }} />
                    {node.title}
                  </div>
                  <div className="space-y-1 px-3 pb-3">
                    {node.tabs.map((tab) => (
                      <a
                        key={`group-tab-${tab.id}`}
                        href={tab.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-start justify-between gap-3 overflow-hidden rounded-md px-2 py-2 text-sm transition hover:bg-base-200"
                      >
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="break-words">
                            {tab.title || tab.url}
                          </div>
                          <div className="truncate text-xs text-base-content/55">
                            {tab.url}
                          </div>
                        </div>
                        <span className="shrink-0 text-base-content/40">↗</span>
                      </a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      ))}
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
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [expandedSessions, setExpandedSessions] = useState<Record<number, boolean>>(
    {},
  );
  const [sessionDetails, setSessionDetails] = useState<
    Record<number, SessionDetails | undefined>
  >({});
  const [sessionDetailErrors, setSessionDetailErrors] = useState<
    Record<number, string | undefined>
  >({});
  const [sessionDetailLoading, setSessionDetailLoading] = useState<
    Record<number, boolean | undefined>
  >({});

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

  async function loadSessions() {
    setSessionsLoading(true);
    setSessionsError(null);

    try {
      const nextTokens = await resolveTokens();
      if (!nextTokens) {
        return;
      }

      await fetchSessionsWithTokens(nextTokens);
    } catch (error) {
      setSessionsError(
        error instanceof Error ? error.message : 'Failed to load sessions',
      );
    } finally {
      setSessionsLoading(false);
    }
  }

  async function fetchSessionsWithTokens(currentTokens: StoredProviderTokens) {
    const response = await fetchRaindropJson<{ sessions: SessionSummary[] }>(
      '/api/raindrop/sessions',
      currentTokens,
    );
    setSessions(response.sessions);
  }

  async function loadSessionDetails(sessionId: number) {
    setSessionDetailLoading((current) => ({ ...current, [sessionId]: true }));
    setSessionDetailErrors((current) => ({ ...current, [sessionId]: undefined }));

    try {
      const nextTokens = await resolveTokens();
      if (!nextTokens) {
        return;
      }

      const details = await fetchRaindropJson<SessionDetails>(
        `/api/raindrop/sessions/${sessionId}`,
        nextTokens,
      );
      setSessionDetails((current) => ({ ...current, [sessionId]: details }));
    } catch (error) {
      setSessionDetailErrors((current) => ({
        ...current,
        [sessionId]:
          error instanceof Error
            ? error.message
            : 'Failed to load session details',
      }));
    } finally {
      setSessionDetailLoading((current) => ({ ...current, [sessionId]: false }));
    }
  }

  function toggleSession(sessionId: number, expanded: boolean) {
    setExpandedSessions((current) => ({
      ...current,
      [sessionId]: !expanded,
    }));

    if (!expanded && !sessionDetails[sessionId]) {
      void loadSessionDetails(sessionId);
    }
  }

  function handleReconnect() {
    clearStoredRaindropTokens();
    setAuthState('redirecting');
    window.location.replace(getRaindropAuthHref('/raindrop'));
  }

  function handleLogout() {
    clearStoredRaindropTokens();
    setTokens(null);
    setSearchResponse(null);
    setSessions([]);
    setExpandedSessions({});
    setSessionDetails({});
    setSessionDetailErrors({});
    setSessionDetailLoading({});
    window.location.replace('/');
  }

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

    void loadSessions();
    // Trigger session loading whenever we reach a ready authenticated state.
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
          const nextTokens = await resolveTokens();
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
                ? 'Checking your saved Raindrop session.'
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
              {authError ?? 'The stored Raindrop session could not be used.'}
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
                      await loadSessions();
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
                      type="text"
                      autoFocus
                      inputMode="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search bookmarks..."
                      className={styles.softInputField}
                    />
                  </span>
                </label>

                {showSearchResults ? (
                  <div className={styles.scrollArea}>
                    <SearchResults
                      results={searchResults}
                      query={query}
                      searching={searching}
                      error={searchError}
                    />
                  </div>
                ) : null}
              </div>
            </article>

            <article
              className={`${styles.card} ${styles.sessionsCard}`}
              aria-labelledby="sessions-heading"
            >
              <div className={styles.sectionHeader}>
                <h2 id="sessions-heading" className={styles.eyebrow}>
                  Sessions
                </h2>
                {sessionsLoading ? (
                  <span className="text-[10px] italic text-base-content/45">
                    loading...
                  </span>
                ) : null}
              </div>

              {sessionsError ? (
                <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-6 text-sm text-error">
                  {sessionsError}
                </div>
              ) : null}

              {!sessionsLoading && !sessionsError && sessions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-base-300/80 px-4 py-7 text-center text-sm text-base-content/60">
                  No session collections were found in Raindrop.
                </div>
              ) : null}

              <div className={styles.sessionsList}>
                {sessions.map((session) => {
                  const expanded = Boolean(expandedSessions[session.id]);
                  const coverUrl = getCoverUrl(session.cover);

                  return (
                    <div
                      id={`session-${session.id}`}
                      key={session.id}
                      className={`${styles.sessionRow} ${
                        expanded ? styles.sessionRowExpanded : ''
                      }`}
                    >
                      <div className={styles.sessionHeader}>
                        <button
                          type="button"
                          className={styles.sessionToggle}
                          onClick={() => toggleSession(session.id, expanded)}
                        >
                          <span
                            className={`${styles.sessionChevron} ${
                              expanded ? styles.sessionChevronExpanded : ''
                            }`}
                          >
                            ▶
                          </span>
                          <div className={styles.sessionAvatar}>
                            {coverUrl ? (
                              <img
                                src={coverUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-sm">☔</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className={styles.sessionTitle}>{session.title}</div>
                            <div className={styles.sessionMeta}>
                              Last active: {formatTimestamp(session.lastAction)}
                            </div>
                          </div>
                        </button>
                        <a
                          href={getCollectionHref(session.id)}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.sessionLink}
                        >
                          Open
                        </a>
                      </div>

                      {expanded ? (
                        <div className={styles.sessionDetails}>
                          {sessionDetailLoading[session.id] ? (
                            <div className="flex items-center gap-3 rounded-2xl border border-base-300/80 px-4 py-6 text-sm text-base-content/60">
                              <span className="loading loading-spinner loading-sm" />
                              Loading session details...
                            </div>
                          ) : null}

                          {sessionDetailErrors[session.id] ? (
                            <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-6 text-sm text-error">
                              {sessionDetailErrors[session.id]}
                            </div>
                          ) : null}

                          {sessionDetails[session.id] ? (
                            <SessionTree details={sessionDetails[session.id]!} />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </article>
          </section>
        </div>
      </div>
    </main>
  );
}
