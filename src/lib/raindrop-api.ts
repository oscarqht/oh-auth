const RAINDROP_API_BASE = 'https://api.raindrop.io/rest/v1';
const FETCH_PAGE_SIZE = 50;
const SESSIONS_COLLECTION_NAME = 'nenya / sessions';
const EXCLUDED_COLLECTION_NAME = 'nenya / options';
const EXCLUDED_RESULT_URL_PATTERNS = [
  'nenya.local',
  'api.raindrop.io',
  'up.raindrop.io',
];

type RaindropCollection = {
  _id: number;
  title: string;
  count?: number;
  cover?: string[] | string;
  lastUpdate?: string;
  lastAction?: string;
  parent?: {
    $id?: number;
  };
};

type RaindropItem = {
  _id: number;
  title?: string;
  link: string;
  excerpt?: string;
  note?: string;
  tags?: string[];
  collectionId?: number;
  lastUpdate?: string;
  dateAdded?: string;
};

type SessionTab = {
  type: 'tab';
  id: number;
  url: string;
  title?: string;
  pinned: boolean;
  index: number;
  groupId?: number;
  groupTitle?: string;
  groupColor?: string;
  groupCollapsed?: boolean;
};

type SessionGroup = {
  type: 'group';
  id: number;
  title: string;
  color: string;
  collapsed: boolean;
  tabs: SessionTab[];
};

export type RaindropSearchResponse = {
  items: Array<
    RaindropItem & {
      collectionTitle?: string;
      isSession?: boolean;
    }
  >;
  collections: Array<
    RaindropCollection & {
      parentCollectionTitle?: string;
      isSession?: boolean;
    }
  >;
};

export type SessionSummary = {
  id: number;
  title: string;
  cover?: string[] | string;
  lastUpdate?: string;
  lastAction?: string;
};

export type SessionDetails = {
  windows: Array<{
    id: number;
    tree: Array<SessionTab | SessionGroup>;
  }>;
};

type SearchItemResult = RaindropSearchResponse['items'][number];
type SearchCollectionResult = RaindropSearchResponse['collections'][number];

export function readBearerAccessToken(request: Request) {
  const authorization = request.headers.get('authorization')?.trim();
  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

type FetchPageResponse = {
  items?: RaindropItem[];
  count?: number;
};

function unwrapInternalUrl(url: string) {
  if (!url.startsWith('https://nenya.local/tab?url=')) {
    return url;
  }

  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('url') ?? url;
  } catch {
    return url;
  }
}

function getItemMetadata(item: Pick<RaindropItem, 'excerpt' | 'note'>) {
  for (const field of [item.excerpt, item.note]) {
    if (!field) {
      continue;
    }

    try {
      const parsed = JSON.parse(field);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Ignore malformed metadata blobs.
    }
  }

  return {} as Record<string, unknown>;
}

export function dedupeRaindropSearchItems(items: SearchItemResult[]) {
  const seenUrls = new Set<string>();
  const seenKeys = new Set<string>();
  const uniqueItems: SearchItemResult[] = [];

  for (const item of items) {
    const url = (item.link ?? '').trim().toLowerCase();
    const title = (item.title ?? '').trim().toLowerCase();

    if (!url) {
      uniqueItems.push(item);
      continue;
    }

    if (seenUrls.has(url)) {
      continue;
    }

    const dedupeKey = `${title}|${url}`;
    if (seenKeys.has(dedupeKey)) {
      continue;
    }

    seenUrls.add(url);
    seenKeys.add(dedupeKey);
    uniqueItems.push(item);
  }

  return uniqueItems;
}

export function dedupeRaindropSearchCollections(
  collections: SearchCollectionResult[],
) {
  const seenCollectionIds = new Set<number>();
  const uniqueCollections: SearchCollectionResult[] = [];

  for (const collection of collections) {
    if (
      typeof collection._id !== 'number' ||
      !Number.isFinite(collection._id)
    ) {
      uniqueCollections.push(collection);
      continue;
    }

    if (seenCollectionIds.has(collection._id)) {
      continue;
    }

    seenCollectionIds.add(collection._id);
    uniqueCollections.push(collection);
  }

  return uniqueCollections;
}

async function raindropRequest<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
) {
  const headers = new Headers(init?.headers);
  headers.set('authorization', `Bearer ${accessToken}`);
  headers.set('accept', 'application/json');
  headers.set('cache-control', 'no-cache, no-store, must-revalidate');
  headers.set('pragma', 'no-cache');

  const response = await fetch(`${RAINDROP_API_BASE}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(
      `Raindrop request failed (${response.status}): ${response.statusText}`,
    );
  }

  const data = (await response.json()) as T & {
    result?: boolean;
    errorMessage?: string;
    error?: string;
  };

  if (data && data.result === false) {
    throw new Error(
      data.errorMessage ?? data.error ?? 'Raindrop API returned an error',
    );
  }

  return data;
}

async function fetchAllCollections(accessToken: string) {
  const [rootCollections, childCollections] = await Promise.all([
    raindropRequest<{ items?: RaindropCollection[] }>('/collections', accessToken),
    raindropRequest<{ items?: RaindropCollection[] }>(
      '/collections/childrens',
      accessToken,
    ),
  ]);

  return {
    rootCollections: Array.isArray(rootCollections.items)
      ? rootCollections.items
      : [],
    childCollections: Array.isArray(childCollections.items)
      ? childCollections.items
      : [],
  };
}

async function fetchAllItemsInCollection(
  accessToken: string,
  collectionId: number,
): Promise<RaindropItem[]> {
  const firstPage = await raindropRequest<FetchPageResponse>(
    `/raindrops/${collectionId}?perpage=${FETCH_PAGE_SIZE}&page=0`,
    accessToken,
  );
  const items = Array.isArray(firstPage.items) ? [...firstPage.items] : [];

  if (items.length < FETCH_PAGE_SIZE) {
    return items;
  }

  const totalCount = firstPage.count;
  if (typeof totalCount === 'number' && totalCount > items.length) {
    const totalPages = Math.ceil(totalCount / FETCH_PAGE_SIZE);
    const pageIndexes: number[] = [];
    for (let page = 1; page < totalPages; page += 1) {
      pageIndexes.push(page);
    }

    for (let start = 0; start < pageIndexes.length; start += 5) {
      const chunk = pageIndexes.slice(start, start + 5);
      const results = await Promise.all(
        chunk.map((page) =>
          raindropRequest<FetchPageResponse>(
            `/raindrops/${collectionId}?perpage=${FETCH_PAGE_SIZE}&page=${page}`,
            accessToken,
          ),
        ),
      );

      results.forEach((result) => {
        if (Array.isArray(result.items)) {
          items.push(...result.items);
        }
      });
    }

    return items;
  }

  let page = 1;
  while (true) {
    const result = await raindropRequest<FetchPageResponse>(
      `/raindrops/${collectionId}?perpage=${FETCH_PAGE_SIZE}&page=${page}`,
      accessToken,
    );
    const pageItems = Array.isArray(result.items) ? result.items : [];
    items.push(...pageItems);

    if (pageItems.length < FETCH_PAGE_SIZE) {
      return items;
    }

    page += 1;
  }
}

export async function searchRaindropWorkspace(
  accessToken: string,
  rawQuery: string,
): Promise<RaindropSearchResponse> {
  const query = rawQuery.trim();
  if (!query) {
    return { items: [], collections: [] };
  }

  const [itemsResponse, { rootCollections, childCollections }] =
    await Promise.all([
      raindropRequest<{ items?: RaindropItem[] }>(
        `/raindrops/0?search=${encodeURIComponent(query)}&perpage=50&sort=score`,
        accessToken,
      ),
      fetchAllCollections(accessToken),
    ]);

  const items = Array.isArray(itemsResponse.items) ? itemsResponse.items : [];
  const allCollections = [...rootCollections, ...childCollections];
  const searchTerms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  const excludedCollectionIds = new Set(
    allCollections
      .filter((collection) => collection.title?.toLowerCase() === EXCLUDED_COLLECTION_NAME)
      .map((collection) => collection._id),
  );

  const collectionIdTitleMap = new Map<number, string>();
  const collectionIdParentMap = new Map<number, number>();
  let sessionsCollectionId: number | null = null;

  allCollections.forEach((collection) => {
    collectionIdTitleMap.set(collection._id, collection.title);
    const parentId = collection.parent?.$id;
    if (typeof parentId === 'number') {
      collectionIdParentMap.set(collection._id, parentId);
    }
    if (collection.title === SESSIONS_COLLECTION_NAME) {
      sessionsCollectionId = collection._id;
    }
  });

  collectionIdTitleMap.set(-1, 'Unsorted');

  const filteredItems = dedupeRaindropSearchItems(
    items
    .filter((item) => {
      if (
        typeof item.collectionId === 'number' &&
        excludedCollectionIds.has(item.collectionId)
      ) {
        return false;
      }

      const title = (item.title ?? '').toLowerCase();
      const link = (item.link ?? '').toLowerCase();
      const excerpt = (item.excerpt ?? '').toLowerCase();
      const tags = Array.isArray(item.tags)
        ? item.tags.map((tag) => String(tag).toLowerCase())
        : [];

      const isSystemUrl =
        link.startsWith('https://api.raindrop.io') ||
        link.startsWith('https://up.raindrop.io');
      if (isSystemUrl) {
        return searchTerms.every((term) => title.includes(term));
      }

      const searchableText = `${title} ${excerpt} ${tags.join(' ')} ${link
        .replace('https://raindrop.io', '')
        .replace('http://raindrop.io', '')}`;
      return searchTerms.every((term) => searchableText.includes(term));
    })
    .filter((item) => {
      const link = item.link?.toLowerCase() ?? '';
      return !EXCLUDED_RESULT_URL_PATTERNS.some((pattern) => link.includes(pattern));
    })
    .map((item) => {
      const collectionTitle =
        typeof item.collectionId === 'number'
          ? collectionIdTitleMap.get(item.collectionId)
          : undefined;
      const parentId =
        typeof item.collectionId === 'number'
          ? collectionIdParentMap.get(item.collectionId)
          : undefined;

      return {
        ...item,
        collectionTitle,
        isSession:
          typeof sessionsCollectionId === 'number' && parentId === sessionsCollectionId,
      };
    }),
  );

  filteredItems.sort((a, b) => {
    const aLink = (a.link ?? '').toLowerCase();
    const bLink = (b.link ?? '').toLowerCase();
    const aSystem =
      aLink.startsWith('https://api.raindrop.io') ||
      aLink.startsWith('https://up.raindrop.io');
    const bSystem =
      bLink.startsWith('https://api.raindrop.io') ||
      bLink.startsWith('https://up.raindrop.io');

    if (aSystem && !bSystem) return 1;
    if (!aSystem && bSystem) return -1;
    return 0;
  });

  const filteredCollections = dedupeRaindropSearchCollections(
    allCollections
    .filter((collection) => {
      const title = (collection.title ?? '').toLowerCase();
      if (title === EXCLUDED_COLLECTION_NAME) {
        return false;
      }
      return searchTerms.every((term) => title.includes(term));
    })
    .map((collection) => {
      const parentId = collectionIdParentMap.get(collection._id);
      return {
        ...collection,
        parentCollectionTitle:
          typeof parentId === 'number'
            ? collectionIdTitleMap.get(parentId)
            : undefined,
        isSession:
          typeof sessionsCollectionId === 'number' && parentId === sessionsCollectionId,
      };
    }),
  );

  if ('unsorted'.includes(query.toLowerCase())) {
    filteredCollections.unshift({
      _id: -1,
      title: 'Unsorted',
      parentCollectionTitle: undefined,
      isSession: false,
    });
  }

  return {
    items: filteredItems,
    collections: filteredCollections,
  };
}

export async function fetchSessionSummaries(
  accessToken: string,
): Promise<SessionSummary[]> {
  const { rootCollections, childCollections } = await fetchAllCollections(accessToken);
  const sessionsCollection = rootCollections.find(
    (collection) => collection.title === SESSIONS_COLLECTION_NAME,
  );

  if (!sessionsCollection) {
    return [];
  }

  return childCollections
    .filter((collection) => collection.parent?.$id === sessionsCollection._id)
    .sort((a, b) => {
      const aTime = new Date(a.lastAction ?? a.lastUpdate ?? 0).getTime();
      const bTime = new Date(b.lastAction ?? b.lastUpdate ?? 0).getTime();
      return bTime - aTime;
    })
    .map((collection) => ({
      id: collection._id,
      title: collection.title,
      cover: collection.cover,
      lastUpdate: collection.lastUpdate,
      lastAction: collection.lastAction ?? collection.lastUpdate,
    }));
}

export async function fetchSessionDetails(
  accessToken: string,
  collectionId: number,
): Promise<SessionDetails> {
  const items = await fetchAllItemsInCollection(accessToken, collectionId);
  if (items.length === 0) {
    return { windows: [] };
  }

  const tabItems = items.filter((item) => item.link !== 'https://nenya.local/meta');
  const windowsMap = new Map<
    number,
    {
      id: number;
      items: SessionTab[];
    }
  >();

  tabItems.forEach((item) => {
    const metadata = getItemMetadata(item);
    const rawWindowId = metadata.windowId;
    const windowId =
      typeof rawWindowId === 'number' ? rawWindowId : Number(rawWindowId) || 0;
    const rawGroupId = metadata.tabGroupId;
    const groupId =
      typeof rawGroupId === 'number' ? rawGroupId : Number(rawGroupId);

    if (!windowsMap.has(windowId)) {
      windowsMap.set(windowId, { id: windowId, items: [] });
    }

    windowsMap.get(windowId)?.items.push({
      type: 'tab',
      id: item._id,
      url: unwrapInternalUrl(item.link),
      title: item.title,
      pinned: Boolean(metadata.pinned),
      index:
        typeof metadata.index === 'number'
          ? metadata.index
          : Number(metadata.index) || 0,
      groupId: Number.isFinite(groupId) ? groupId : undefined,
      groupTitle:
        typeof metadata.groupTitle === 'string' ? metadata.groupTitle : undefined,
      groupColor:
        typeof metadata.groupColor === 'string' ? metadata.groupColor : undefined,
      groupCollapsed: Boolean(metadata.groupCollapsed),
    });
  });

  const windows = Array.from(windowsMap.values()).map((windowEntry) => {
    windowEntry.items.sort((a, b) => a.index - b.index);
    const tree: Array<SessionTab | SessionGroup> = [];
    const processedGroupIds = new Set<number>();

    windowEntry.items.forEach((tab) => {
      if (typeof tab.groupId === 'number' && tab.groupId !== -1) {
        if (processedGroupIds.has(tab.groupId)) {
          return;
        }

        tree.push({
          type: 'group',
          id: tab.groupId,
          title: tab.groupTitle ?? 'Group',
          color: tab.groupColor ?? 'gray',
          collapsed: Boolean(tab.groupCollapsed),
          tabs: windowEntry.items.filter((item) => item.groupId === tab.groupId),
        });
        processedGroupIds.add(tab.groupId);
        return;
      }

      tree.push(tab);
    });

    return {
      id: windowEntry.id,
      tree,
    };
  });

  return { windows };
}
