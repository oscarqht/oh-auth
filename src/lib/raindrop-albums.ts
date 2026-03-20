const RAINDROP_API_BASE = 'https://api.raindrop.io/rest/v1';
const FETCH_PAGE_SIZE = 50;

type SearchParamsLike = {
  toString(): string;
};

type RawCollection = {
  _id: number;
  title: string;
  count?: number;
  cover?: string[] | string;
  sort?: number;
  lastUpdate?: string;
  parent?: {
    $id?: number;
  };
};

type RawUserGroup = {
  title?: string;
  hidden?: boolean;
  sort?: number;
  collections?: number[];
};

type RawUser = {
  groups?: RawUserGroup[];
};

type RawItemMedia = {
  link?: string;
};

type RawItem = {
  _id: number;
  title?: string;
  link: string;
  type?: string;
  cover?: string;
  media?: RawItemMedia[];
  created?: string;
  lastUpdate?: string;
};

type CollectionsResponse = {
  items?: RawCollection[];
};

type UserResponse = {
  user?: RawUser;
};

type RaindropItemsResponse = {
  items?: RawItem[];
  count?: number;
};

type CollectionLookup = Map<number, RawCollection>;

export type CollectionNode = {
  id: number;
  title: string;
  count: number;
  coverUrl?: string;
  parentId?: number;
  depth: number;
  pathIds: number[];
  children: CollectionNode[];
};

export type AlbumCollection = {
  id: number;
  title: string;
  count: number;
  coverUrl?: string;
  parentId?: number;
  pathIds: number[];
};

export type AlbumImage = {
  id: number;
  title: string;
  thumbnailUrl: string;
  fullUrl: string;
  created?: string;
  lastUpdate?: string;
};

export type AlbumCollectionPayload = {
  collection: AlbumCollection;
  breadcrumb: AlbumCollection[];
  images: AlbumImage[];
};

export type AlbumRouteState = {
  collectionId: number | null;
  photoId: number | null;
};

export type AlbumViewerTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type AlbumSwipeAction = 'previous' | 'next' | 'close' | null;

function getStringCoverUrl(cover?: string[] | string) {
  if (Array.isArray(cover)) {
    return cover[0];
  }

  return cover;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function compareCollections(left: RawCollection, right: RawCollection) {
  const leftSort =
    typeof left.sort === 'number' && Number.isFinite(left.sort)
      ? left.sort
      : Number.NEGATIVE_INFINITY;
  const rightSort =
    typeof right.sort === 'number' && Number.isFinite(right.sort)
      ? right.sort
      : Number.NEGATIVE_INFINITY;

  if (leftSort !== rightSort) {
    return rightSort - leftSort;
  }

  return left.title.localeCompare(right.title, 'en', { sensitivity: 'base' });
}

function cloneSearchParams(input?: SearchParamsLike | string | null) {
  if (typeof input === 'string') {
    return new URLSearchParams(input);
  }

  return new URLSearchParams(input?.toString() ?? '');
}

function toAlbumCollection(
  collection: RawCollection,
  pathIds: number[],
): AlbumCollection {
  return {
    id: collection._id,
    title: collection.title,
    count: collection.count ?? 0,
    coverUrl: getStringCoverUrl(collection.cover),
    parentId: collection.parent?.$id,
    pathIds,
  };
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
    error?: string;
    errorMessage?: string;
  };

  if (data.result === false) {
    throw new Error(
      data.errorMessage ?? data.error ?? 'Raindrop API returned an error',
    );
  }

  return data;
}

async function fetchWorkspaceCollections(accessToken: string) {
  const [userResponse, rootCollectionsResponse, childCollectionsResponse] =
    await Promise.all([
      raindropRequest<UserResponse>('/user', accessToken),
      raindropRequest<CollectionsResponse>('/collections', accessToken),
      raindropRequest<CollectionsResponse>('/collections/childrens', accessToken),
    ]);

  return {
    userGroups: Array.isArray(userResponse.user?.groups)
      ? userResponse.user.groups
      : [],
    rootCollections: Array.isArray(rootCollectionsResponse.items)
      ? rootCollectionsResponse.items
      : [],
    childCollections: Array.isArray(childCollectionsResponse.items)
      ? childCollectionsResponse.items
      : [],
  };
}

async function fetchCollectionItems(
  accessToken: string,
  collectionId: number,
): Promise<RawItem[]> {
  const firstPage = await raindropRequest<RaindropItemsResponse>(
    `/raindrops/${collectionId}?perpage=${FETCH_PAGE_SIZE}&page=0&sort=-created&nested=false`,
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
          raindropRequest<RaindropItemsResponse>(
            `/raindrops/${collectionId}?perpage=${FETCH_PAGE_SIZE}&page=${page}&sort=-created&nested=false`,
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
    const response = await raindropRequest<RaindropItemsResponse>(
      `/raindrops/${collectionId}?perpage=${FETCH_PAGE_SIZE}&page=${page}&sort=-created&nested=false`,
      accessToken,
    );
    const pageItems = Array.isArray(response.items) ? response.items : [];
    items.push(...pageItems);

    if (pageItems.length < FETCH_PAGE_SIZE) {
      return items;
    }

    page += 1;
  }
}

export function orderRootCollections(
  rootCollections: RawCollection[],
  userGroups: RawUserGroup[],
) {
  const lookup = new Map(rootCollections.map((collection) => [collection._id, collection]));
  const seen = new Set<number>();
  const ordered: RawCollection[] = [];
  const sortedGroups = [...userGroups].sort((left, right) => {
    const leftSort =
      typeof left.sort === 'number' && Number.isFinite(left.sort)
        ? left.sort
        : Number.MAX_SAFE_INTEGER;
    const rightSort =
      typeof right.sort === 'number' && Number.isFinite(right.sort)
        ? right.sort
        : Number.MAX_SAFE_INTEGER;
    return leftSort - rightSort;
  });

  sortedGroups.forEach((group) => {
    if (!Array.isArray(group.collections)) {
      return;
    }

    group.collections.forEach((collectionId) => {
      const collection = lookup.get(collectionId);
      if (!collection || seen.has(collectionId)) {
        return;
      }

      seen.add(collectionId);
      ordered.push(collection);
    });
  });

  rootCollections
    .filter((collection) => !seen.has(collection._id))
    .sort(compareCollections)
    .forEach((collection) => {
      ordered.push(collection);
    });

  return ordered;
}

export function buildCollectionTree(
  rootCollections: RawCollection[],
  childCollections: RawCollection[],
  userGroups: RawUserGroup[],
) {
  const childrenByParent = new Map<number, RawCollection[]>();

  childCollections.forEach((collection) => {
    const parentId = collection.parent?.$id;
    if (typeof parentId !== 'number') {
      return;
    }

    const existing = childrenByParent.get(parentId) ?? [];
    existing.push(collection);
    childrenByParent.set(parentId, existing);
  });

  const buildNode = (
    collection: RawCollection,
    depth: number,
    parentPathIds: number[],
  ): CollectionNode => {
    const pathIds = [...parentPathIds, collection._id];
    const children = [...(childrenByParent.get(collection._id) ?? [])]
      .sort(compareCollections)
      .map((child) => buildNode(child, depth + 1, pathIds));

    return {
      id: collection._id,
      title: collection.title,
      count: collection.count ?? 0,
      coverUrl: getStringCoverUrl(collection.cover),
      parentId: collection.parent?.$id,
      depth,
      pathIds,
      children,
    };
  };

  return orderRootCollections(rootCollections, userGroups).map((collection) =>
    buildNode(collection, 0, []),
  );
}

export function buildCollectionLookup(
  rootCollections: RawCollection[],
  childCollections: RawCollection[],
): CollectionLookup {
  return new Map(
    [...rootCollections, ...childCollections].map((collection) => [
      collection._id,
      collection,
    ]),
  );
}

export function buildCollectionBreadcrumb(
  collectionId: number,
  lookup: CollectionLookup,
) {
  const chain: RawCollection[] = [];
  let current = lookup.get(collectionId);

  while (current) {
    chain.unshift(current);

    const parentId = current.parent?.$id;
    if (typeof parentId !== 'number') {
      break;
    }

    current = lookup.get(parentId);
  }

  return chain.map((collection, index) =>
    toAlbumCollection(
      collection,
      chain.slice(0, index + 1).map((entry) => entry._id),
    ),
  );
}

export function normalizeAlbumImage(item: RawItem): AlbumImage | null {
  if (item.type !== 'image') {
    return null;
  }

  const mediaLink = Array.isArray(item.media) ? item.media[0]?.link : undefined;
  const source = item.cover ?? mediaLink ?? item.link;
  if (!source) {
    return null;
  }

  return {
    id: item._id,
    title: item.title?.trim() || 'Untitled image',
    thumbnailUrl: source,
    fullUrl: source,
    created: item.created,
    lastUpdate: item.lastUpdate,
  };
}

export function normalizeAlbumImages(items: RawItem[]) {
  return items
    .map((item) => normalizeAlbumImage(item))
    .filter((item): item is AlbumImage => Boolean(item))
    .sort((left, right) => {
      const leftTime = new Date(left.lastUpdate ?? left.created ?? 0).getTime();
      const rightTime = new Date(right.lastUpdate ?? right.created ?? 0).getTime();
      return rightTime - leftTime;
    });
}

export async function fetchCollectionTree(accessToken: string) {
  const { userGroups, rootCollections, childCollections } =
    await fetchWorkspaceCollections(accessToken);

  return buildCollectionTree(rootCollections, childCollections, userGroups);
}

export async function fetchAlbumCollectionPayload(
  accessToken: string,
  collectionId: number,
): Promise<AlbumCollectionPayload> {
  const [{ rootCollections, childCollections }, items] = await Promise.all([
    fetchWorkspaceCollections(accessToken),
    fetchCollectionItems(accessToken, collectionId),
  ]);

  const lookup = buildCollectionLookup(rootCollections, childCollections);
  const collection = lookup.get(collectionId);
  if (!collection) {
    throw new Error('Collection not found');
  }

  const breadcrumb = buildCollectionBreadcrumb(collectionId, lookup);

  return {
    collection: toAlbumCollection(collection, breadcrumb.map((item) => item.id)),
    breadcrumb,
    images: normalizeAlbumImages(items),
  };
}

export function parseAlbumRouteState(
  searchParams?: SearchParamsLike | string | null,
): AlbumRouteState {
  const params = cloneSearchParams(searchParams);

  const toNumber = (value: string | null) => {
    if (!value) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    collectionId: toNumber(params.get('collection')),
    photoId: toNumber(params.get('photo')),
  };
}

export function buildAlbumSearchParams(
  currentSearchParams: SearchParamsLike | string | null | undefined,
  nextState: Partial<AlbumRouteState>,
) {
  const params = cloneSearchParams(currentSearchParams);

  if ('collectionId' in nextState) {
    if (typeof nextState.collectionId === 'number') {
      params.set('collection', String(nextState.collectionId));
    } else {
      params.delete('collection');
      params.delete('photo');
    }
  }

  if ('photoId' in nextState) {
    if (typeof nextState.photoId === 'number') {
      params.set('photo', String(nextState.photoId));
    } else {
      params.delete('photo');
    }
  }

  return params;
}

export function getAdjacentAlbumImageId(
  images: AlbumImage[],
  currentImageId: number | null,
  direction: 'previous' | 'next',
) {
  if (currentImageId == null) {
    return null;
  }

  const index = images.findIndex((image) => image.id === currentImageId);
  if (index === -1) {
    return null;
  }

  const offset = direction === 'previous' ? -1 : 1;
  const nextImage = images[index + offset];
  return nextImage?.id ?? null;
}

export function clampAlbumViewerTransform(
  next: AlbumViewerTransform,
  viewport: {
    width: number;
    height: number;
  },
  options: {
    allowOffsetAtBaseScale?: boolean;
  } = {},
): AlbumViewerTransform {
  const scale = clampNumber(next.scale, 1, 4);

  const clampOffset = (offset: number, size: number) => {
    if (scale <= 1 && !options.allowOffsetAtBaseScale) {
      return 0;
    }

    if (scale <= 1) {
      return offset;
    }

    const limit = ((scale - 1) * size) / 2 + 48;
    return clampNumber(offset, -limit, limit);
  };

  return {
    scale,
    offsetX: clampOffset(next.offsetX, viewport.width),
    offsetY: clampOffset(next.offsetY, viewport.height),
  };
}

export function getAlbumSwipeAction(
  offsetX: number,
  offsetY: number,
): AlbumSwipeAction {
  const horizontalSwipe =
    Math.abs(offsetX) > 90 && Math.abs(offsetX) > Math.abs(offsetY) * 1.2;
  const verticalSwipe =
    offsetY > 110 && Math.abs(offsetY) > Math.abs(offsetX) * 1.1;

  if (verticalSwipe) {
    return 'close';
  }

  if (!horizontalSwipe) {
    return null;
  }

  return offsetX > 0 ? 'previous' : 'next';
}
