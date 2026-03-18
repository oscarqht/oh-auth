'use client';

import { useEffect, useMemo, useState } from 'react';
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
import type { StoredProviderTokens } from '@/lib/raindrop-web-auth';

type AuthState = 'checking' | 'redirecting' | 'ready' | 'error';

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
    return (
      <div className="rounded-xl border border-dashed border-base-300 px-4 py-8 text-center text-sm text-base-content/60">
        Enter at least 3 characters to search Raindrop items and collections.
      </div>
    );
  }

  if (searching) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-xl border border-base-300 px-4 py-8 text-sm text-base-content/70">
        <span className="loading loading-spinner loading-sm" />
        Searching Raindrop...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-error/20 bg-error/5 px-4 py-6 text-sm text-error">
        {error}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-base-300 px-4 py-8 text-center text-sm text-base-content/60">
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
              className="group block rounded-xl border border-base-300 bg-base-100 px-4 py-3 transition hover:border-base-content/20 hover:bg-base-200/60"
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
            className="group block rounded-xl border border-base-300 bg-base-100 px-4 py-3 transition hover:border-base-content/20 hover:bg-base-200/60"
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
    <div className="space-y-3">
      {details.windows.map((windowItem, index) => (
        <details
          key={`window-${windowItem.id}-${index}`}
          className="rounded-lg border border-base-300 bg-base-100/60"
          open
        >
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-base-content/55">
            Window {index + 1}
          </summary>
          <div className="space-y-2 px-3 pb-3">
            {windowItem.tree.map((node, nodeIndex) => {
              if (node.type === 'tab') {
                return (
                  <a
                    key={`tab-${node.id}-${nodeIndex}`}
                    href={node.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-md px-2 py-2 text-sm transition hover:bg-base-200"
                  >
                    <div className="min-w-0">
                      <div className="truncate">{node.title || node.url}</div>
                      <div className="truncate text-xs text-base-content/55">
                        {node.url}
                      </div>
                    </div>
                    <span className="text-base-content/40">↗</span>
                  </a>
                );
              }

              return (
                <details
                  key={`group-${node.id}-${nodeIndex}`}
                  className="rounded-md border border-base-300 bg-base-100"
                  open={!node.collapsed}
                >
                  <summary className="cursor-pointer px-2 py-2 text-sm font-medium">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ backgroundColor: node.color || 'gray' }} />
                    {node.title}
                  </summary>
                  <div className="space-y-1 px-3 pb-3">
                    {node.tabs.map((tab) => (
                      <a
                        key={`group-tab-${tab.id}`}
                        href={tab.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between rounded-md px-2 py-2 text-sm transition hover:bg-base-200"
                      >
                        <div className="min-w-0">
                          <div className="truncate">
                            {tab.title || tab.url}
                          </div>
                          <div className="truncate text-xs text-base-content/55">
                            {tab.url}
                          </div>
                        </div>
                        <span className="text-base-content/40">↗</span>
                      </a>
                    ))}
                  </div>
                </details>
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

  async function resolveTokens() {
    try {
      const nextTokens = await ensureValidRaindropTokens();
      if (!nextTokens) {
        setAuthState('redirecting');
        window.location.replace(getRaindropAuthHref('/raindrop'));
        return null;
      }

      setTokens(nextTokens);
      setAuthState('ready');
      setAuthError(null);
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

  function handleReconnect() {
    clearStoredRaindropTokens();
    setAuthState('redirecting');
    window.location.replace(getRaindropAuthHref('/raindrop'));
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

        setTokens(nextTokens);
        setAuthState('ready');
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
      <main className="min-h-screen bg-base-200 text-base-content">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-12">
          <div className="w-full max-w-xl rounded-3xl border border-base-300 bg-base-100 p-10 text-center shadow-xl">
            <span className="badge badge-primary mb-4">Raindrop Workspace</span>
            <h1 className="text-3xl font-bold">Connecting to Raindrop</h1>
            <p className="mt-3 text-base-content/70">
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
            <a href={getRaindropAuthHref('/raindrop')} className="btn btn-primary mt-8">
              Continue manually
            </a>
          </div>
        </div>
      </main>
    );
  }

  if (authState === 'error') {
    return (
      <main className="min-h-screen bg-base-200 text-base-content">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-12">
          <div className="w-full max-w-xl rounded-3xl border border-error/20 bg-base-100 p-10 text-center shadow-xl">
            <span className="badge badge-error mb-4">Raindrop Workspace</span>
            <h1 className="text-3xl font-bold">Could not validate login</h1>
            <p className="mt-3 text-base-content/70">
              {authError ?? 'The stored Raindrop session could not be used.'}
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
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
    <main className="min-h-screen bg-base-200 text-base-content">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 md:py-10">
        <header className="rounded-3xl border border-base-300 bg-base-100 p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="badge badge-primary">Raindrop Workspace</span>
              <h1 className="mt-3 text-3xl font-bold">Search and browse sessions</h1>
              <p className="mt-2 max-w-3xl text-sm text-base-content/70 md:text-base">
                This page reuses the same Raindrop data model as the extension
                popup. Search across items and collections, then inspect session
                collections under <code>nenya / sessions</code>.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl bg-base-200 px-4 py-3 text-sm">
                <div className="font-medium">Signed in</div>
                <div className="text-base-content/60">
                  Token expires {tokens ? formatTimestamp(new Date(tokens.expiresAt).toISOString()) : 'Unknown'}
                </div>
              </div>
              <button className="btn btn-outline" onClick={handleReconnect}>
                Reconnect
              </button>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm md:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Search</h2>
                <p className="text-sm text-base-content/60">
                  Matches Raindrop items and collections.
                </p>
              </div>
              <a
                href="https://app.raindrop.io/my/0"
                target="_blank"
                rel="noreferrer"
                className="link link-primary text-sm"
              >
                Open Raindrop
              </a>
            </div>

            <label className="input input-bordered flex h-14 w-full items-center gap-3 rounded-2xl border-base-300 px-4">
              <span className="text-base-content/45">⌕</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search bookmarks, sessions, and collections..."
                className="grow bg-transparent"
              />
            </label>

            <div className="mt-4">
              <SearchResults
                results={searchResults}
                query={query}
                searching={searching}
                error={searchError}
              />
            </div>
          </article>

          <article className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm md:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Sessions</h2>
                <p className="text-sm text-base-content/60">
                  Child collections from <code>nenya / sessions</code>.
                </p>
              </div>
              {sessionsLoading ? (
                <span className="text-xs italic text-base-content/45">
                  loading...
                </span>
              ) : null}
            </div>

            {sessionsError ? (
              <div className="rounded-xl border border-error/20 bg-error/5 px-4 py-6 text-sm text-error">
                {sessionsError}
              </div>
            ) : null}

            {!sessionsLoading && !sessionsError && sessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-base-300 px-4 py-8 text-center text-sm text-base-content/60">
                No session collections were found in Raindrop.
              </div>
            ) : null}

            <div className="space-y-3">
              {sessions.map((session) => {
                const expanded = Boolean(expandedSessions[session.id]);
                const coverUrl = getCoverUrl(session.cover);

                return (
                  <div
                    key={session.id}
                    className="overflow-hidden rounded-2xl border border-base-300 bg-base-100"
                  >
                    <div className="flex items-start justify-between gap-3 px-4 py-4 transition hover:bg-base-200/60">
                      <button
                        className="flex min-w-0 flex-1 items-start gap-3 text-left"
                        onClick={() => {
                          setExpandedSessions((current) => ({
                            ...current,
                            [session.id]: !expanded,
                          }));

                          if (!expanded && !sessionDetails[session.id]) {
                            void loadSessionDetails(session.id);
                          }
                        }}
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <span
                            className={`mt-1 text-xs transition ${
                              expanded ? 'rotate-90' : ''
                            }`}
                          >
                            ▶
                          </span>
                          {coverUrl ? (
                            <img
                              src={coverUrl}
                              alt=""
                              className="mt-0.5 h-10 w-10 rounded-xl object-cover"
                            />
                          ) : (
                            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-base-200 text-lg">
                              ☔
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {session.title}
                            </div>
                            <div className="mt-1 text-xs text-base-content/55">
                              Last active {formatTimestamp(session.lastAction)}
                            </div>
                          </div>
                        </div>
                      </button>
                      <a
                        href={getCollectionHref(session.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-ghost btn-sm"
                      >
                        Open
                      </a>
                    </div>

                    {expanded ? (
                      <div className="border-t border-base-300 px-4 py-4">
                        {sessionDetailLoading[session.id] ? (
                          <div className="flex items-center gap-3 rounded-xl border border-base-300 px-4 py-6 text-sm text-base-content/60">
                            <span className="loading loading-spinner loading-sm" />
                            Loading session details...
                          </div>
                        ) : null}

                        {sessionDetailErrors[session.id] ? (
                          <div className="rounded-xl border border-error/20 bg-error/5 px-4 py-6 text-sm text-error">
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
    </main>
  );
}
