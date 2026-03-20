'use client';

import {
  Suspense,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Nunito } from 'next/font/google';
import type {
  AlbumCollectionPayload,
  AlbumImage,
  CollectionNode,
} from '@/lib/raindrop-albums';
import {
  buildAlbumSearchParams,
  getAdjacentAlbumImageId,
  parseAlbumRouteState,
} from '@/lib/raindrop-albums';
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

function flattenTree(nodes: CollectionNode[]) {
  const byId = new Map<number, CollectionNode>();
  let total = 0;

  const visit = (node: CollectionNode) => {
    byId.set(node.id, node);
    total += 1;
    node.children.forEach(visit);
  };

  nodes.forEach(visit);

  return {
    byId,
    total,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function buildHref(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function AlbumsLoadingShell() {
  return (
    <main className={`${nunito.className} ${styles.page}`}>
      <div className={styles.stateShell}>
        <div className={styles.stateCard}>
          <div className={styles.brand}>
            <Image
              src="/img/provider-raindrop-icon.png"
              alt="Raindrop"
              width={36}
              height={36}
              className={styles.brandIcon}
            />
            <span>Raindrop Albums</span>
          </div>
          <h1 className={styles.stateTitle}>Preparing albums</h1>
          <p className={styles.stateMessage}>
            Loading the gallery workspace and restoring your current view.
          </p>
          <div className={styles.stateSpinner}>
            <span className="loading loading-spinner loading-md" />
            <span>Please wait...</span>
          </div>
        </div>
      </div>
    </main>
  );
}

function CollectionTree({
  tree,
  selectedCollectionId,
  expandedCollections,
  onToggleCollection,
  onSelectCollection,
}: {
  tree: CollectionNode[];
  selectedCollectionId: number | null;
  expandedCollections: Record<number, boolean>;
  onToggleCollection: (collectionId: number) => void;
  onSelectCollection: (collectionId: number) => void;
}) {
  if (tree.length === 0) {
    return (
      <div className={styles.sidebarEmpty}>
        No Raindrop collections were found yet.
      </div>
    );
  }

  return (
    <div className={styles.treeList}>
      {tree.map((node) => (
        <CollectionTreeNode
          key={node.id}
          node={node}
          selectedCollectionId={selectedCollectionId}
          expandedCollections={expandedCollections}
          onToggleCollection={onToggleCollection}
          onSelectCollection={onSelectCollection}
        />
      ))}
    </div>
  );
}

function CollectionTreeNode({
  node,
  selectedCollectionId,
  expandedCollections,
  onToggleCollection,
  onSelectCollection,
}: {
  node: CollectionNode;
  selectedCollectionId: number | null;
  expandedCollections: Record<number, boolean>;
  onToggleCollection: (collectionId: number) => void;
  onSelectCollection: (collectionId: number) => void;
}) {
  const isSelected = node.id === selectedCollectionId;
  const isExpanded = expandedCollections[node.id] ?? node.depth === 0;
  const hasChildren = node.children.length > 0;

  return (
    <div className={styles.treeNode}>
      <div
        className={`${styles.treeRow} ${isSelected ? styles.treeRowSelected : ''}`}
      >
        {hasChildren ? (
          <button
            type="button"
            className={styles.treeToggle}
            aria-label={isExpanded ? 'Collapse collection' : 'Expand collection'}
            onClick={() => onToggleCollection(node.id)}
          >
            <span
              className={`${styles.treeChevron} ${
                isExpanded ? styles.treeChevronExpanded : ''
              }`}
            >
              ▶
            </span>
          </button>
        ) : (
          <span className={styles.treeToggleSpacer} aria-hidden="true" />
        )}
        <button
          type="button"
          className={styles.treeSelect}
          onClick={() => onSelectCollection(node.id)}
        >
          <span className={styles.treeThumb}>
            {node.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={node.coverUrl} alt="" className={styles.treeThumbImage} />
            ) : (
              <span aria-hidden="true">☔</span>
            )}
          </span>
          <span className={styles.treeText}>
            <span className={styles.treeTitle}>{node.title}</span>
            <span className={styles.treeMeta}>{node.count} saved</span>
          </span>
        </button>
      </div>

      {hasChildren && isExpanded ? (
        <div className={styles.treeChildren}>
          {node.children.map((child) => (
            <CollectionTreeNode
              key={child.id}
              node={child}
              selectedCollectionId={selectedCollectionId}
              expandedCollections={expandedCollections}
              onToggleCollection={onToggleCollection}
              onSelectCollection={onSelectCollection}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PhotoViewer({
  images,
  activeImage,
  onClose,
  onShowPrevious,
  onShowNext,
}: {
  images: AlbumImage[];
  activeImage: AlbumImage;
  onClose: () => void;
  onShowPrevious: () => void;
  onShowNext: () => void;
}) {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const pointersRef = useRef(
    new Map<number, { x: number; y: number; pointerType: string }>(),
  );
  const interactionRef = useRef<{
    mode: 'idle' | 'swipe' | 'pan' | 'pinch';
    startX: number;
    startY: number;
    baseOffsetX: number;
    baseOffsetY: number;
    baseScale: number;
    pinchDistance: number;
    pinchMidpointX: number;
    pinchMidpointY: number;
  }>({
    mode: 'idle',
    startX: 0,
    startY: 0,
    baseOffsetX: 0,
    baseOffsetY: 0,
    baseScale: 1,
    pinchDistance: 0,
    pinchMidpointX: 0,
    pinchMidpointY: 0,
  });
  const transformRef = useRef({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  const [transform, setTransform] = useState({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });

  function clampOffset(offset: number, size: number, scale: number) {
    if (scale <= 1) {
      return 0;
    }

    const limit = ((scale - 1) * size) / 2 + 48;
    return clamp(offset, -limit, limit);
  }

  function commitTransform(next: {
    scale: number;
    offsetX: number;
    offsetY: number;
  }) {
    const rect = viewerRef.current?.getBoundingClientRect();
    const width = rect?.width ?? window.innerWidth;
    const height = rect?.height ?? window.innerHeight;
    const scale = clamp(next.scale, 1, 4);
    const offsetX = clampOffset(next.offsetX, width, scale);
    const offsetY = clampOffset(next.offsetY, height, scale);
    const clampedTransform = { scale, offsetX, offsetY };

    transformRef.current = clampedTransform;
    setTransform(clampedTransform);
  }

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onShowPrevious();
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      onShowNext();
    }
  });

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  function beginPan(pointerX: number, pointerY: number) {
    interactionRef.current = {
      mode: 'pan',
      startX: pointerX,
      startY: pointerY,
      baseOffsetX: transformRef.current.offsetX,
      baseOffsetY: transformRef.current.offsetY,
      baseScale: transformRef.current.scale,
      pinchDistance: 0,
      pinchMidpointX: 0,
      pinchMidpointY: 0,
    };
  }

  function beginPinch() {
    const pointers = [...pointersRef.current.values()];
    if (pointers.length < 2) {
      return;
    }

    const [first, second] = pointers;
    const midpointX = (first.x + second.x) / 2;
    const midpointY = (first.y + second.y) / 2;
    const distance = Math.hypot(second.x - first.x, second.y - first.y);

    interactionRef.current = {
      mode: 'pinch',
      startX: 0,
      startY: 0,
      baseOffsetX: transformRef.current.offsetX,
      baseOffsetY: transformRef.current.offsetY,
      baseScale: transformRef.current.scale,
      pinchDistance: distance,
      pinchMidpointX: midpointX,
      pinchMidpointY: midpointY,
    };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      pointerType: event.pointerType,
    });

    if (pointersRef.current.size >= 2) {
      beginPinch();
      return;
    }

    if (transformRef.current.scale > 1.02) {
      beginPan(event.clientX, event.clientY);
      return;
    }

    if (event.pointerType === 'mouse') {
      interactionRef.current.mode = 'idle';
      return;
    }

    interactionRef.current = {
      mode: 'swipe',
      startX: event.clientX,
      startY: event.clientY,
      baseOffsetX: 0,
      baseOffsetY: 0,
      baseScale: 1,
      pinchDistance: 0,
      pinchMidpointX: 0,
      pinchMidpointY: 0,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pointer = pointersRef.current.get(event.pointerId);
    if (!pointer) {
      return;
    }

    pointer.x = event.clientX;
    pointer.y = event.clientY;

    const interaction = interactionRef.current;

    if (pointersRef.current.size >= 2) {
      beginPinch();
    }

    if (interactionRef.current.mode === 'pinch') {
      const pointers = [...pointersRef.current.values()];
      if (pointers.length < 2) {
        return;
      }

      const [first, second] = pointers;
      const midpointX = (first.x + second.x) / 2;
      const midpointY = (first.y + second.y) / 2;
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      const scale =
        interactionRef.current.baseScale *
        (distance / Math.max(interactionRef.current.pinchDistance, 1));

      commitTransform({
        scale,
        offsetX:
          interactionRef.current.baseOffsetX +
          (midpointX - interactionRef.current.pinchMidpointX),
        offsetY:
          interactionRef.current.baseOffsetY +
          (midpointY - interactionRef.current.pinchMidpointY),
      });
      return;
    }

    if (interaction.mode === 'pan') {
      commitTransform({
        scale: transformRef.current.scale,
        offsetX: interaction.baseOffsetX + (event.clientX - interaction.startX),
        offsetY: interaction.baseOffsetY + (event.clientY - interaction.startY),
      });
      return;
    }

    if (interaction.mode === 'swipe') {
      commitTransform({
        scale: 1,
        offsetX: event.clientX - interaction.startX,
        offsetY: event.clientY - interaction.startY,
      });
    }
  }

  function releasePointer(pointerId: number) {
    pointersRef.current.delete(pointerId);

    if (pointersRef.current.size >= 2) {
      beginPinch();
      return;
    }

    if (pointersRef.current.size === 1 && transformRef.current.scale > 1.02) {
      const [remainingPointer] = pointersRef.current.values();
      beginPan(remainingPointer.x, remainingPointer.y);
      return;
    }

    const interaction = interactionRef.current;
    interactionRef.current.mode = 'idle';

    if (interaction.mode !== 'swipe') {
      if (transformRef.current.scale <= 1.02) {
        commitTransform({
          scale: 1,
          offsetX: 0,
          offsetY: 0,
        });
      }
      return;
    }

    const { offsetX, offsetY } = transformRef.current;
    const horizontalSwipe =
      Math.abs(offsetX) > 90 && Math.abs(offsetX) > Math.abs(offsetY) * 1.2;
    const verticalSwipe =
      offsetY > 110 && Math.abs(offsetY) > Math.abs(offsetX) * 1.1;

    commitTransform({
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    });

    if (verticalSwipe) {
      onClose();
      return;
    }

    if (!horizontalSwipe) {
      return;
    }

    if (offsetX > 0) {
      onShowPrevious();
    } else {
      onShowNext();
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    releasePointer(event.pointerId);
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    releasePointer(event.pointerId);
  }

  const activeIndex = images.findIndex((image) => image.id === activeImage.id);

  return (
    <div className={styles.viewerOverlay}>
      <div
        ref={viewerRef}
        className={styles.viewerSurface}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div className={styles.viewerTopBar}>
          <div className={styles.viewerMeta}>
            <span className={styles.viewerCounter}>
              {activeIndex + 1} / {images.length}
            </span>
            <span className={styles.viewerTitle}>{activeImage.title}</span>
          </div>
          <button
            type="button"
            className={styles.viewerClose}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <button
          type="button"
          className={`${styles.viewerArrow} ${styles.viewerArrowLeft}`}
          onClick={onShowPrevious}
          aria-label="Show previous image"
        >
          ‹
        </button>
        <button
          type="button"
          className={`${styles.viewerArrow} ${styles.viewerArrowRight}`}
          onClick={onShowNext}
          aria-label="Show next image"
        >
          ›
        </button>

        <div
          className={styles.viewerImageWrap}
          style={{
            transform: `translate3d(${transform.offsetX}px, ${transform.offsetY}px, 0) scale(${transform.scale})`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeImage.fullUrl}
            alt={activeImage.title}
            className={styles.viewerImage}
            draggable={false}
          />
        </div>

        <div className={styles.viewerHint}>
          Swipe left or right, swipe down to close, pinch to zoom.
        </div>
      </div>
    </div>
  );
}

function RaindropAlbumsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeState = parseAlbumRouteState(searchParams);
  const selectedCollectionId = routeState.collectionId;
  const selectedPhotoId = routeState.photoId;

  const [authState, setAuthState] = useState<AuthState>('checking');
  const [authError, setAuthError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<StoredProviderTokens | null>(null);
  const [tree, setTree] = useState<CollectionNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [albumLoading, setAlbumLoading] = useState(false);
  const [albumError, setAlbumError] = useState<string | null>(null);
  const [albumPayload, setAlbumPayload] = useState<AlbumCollectionPayload | null>(
    null,
  );
  const [expandedCollections, setExpandedCollections] = useState<
    Record<number, boolean>
  >({});
  const [mobileTreeOpen, setMobileTreeOpen] = useState(false);

  const treeMeta = flattenTree(tree);
  const selectedTreeNode =
    selectedCollectionId == null
      ? null
      : treeMeta.byId.get(selectedCollectionId) ?? null;
  const activeImage =
    albumPayload?.images.find((image) => image.id === selectedPhotoId) ?? null;

  const syncResolvedTokens = useEffectEvent(
    (nextTokens: StoredProviderTokens) => {
      setTokens((current) => {
        if (areStoredProviderTokensEqual(current, nextTokens)) {
          return current;
        }

        return nextTokens;
      });
      setAuthError(null);
      setAuthState('ready');
    },
  );

  const redirectToAuth = useEffectEvent(() => {
    const redirectTarget = `${pathname}${
      searchParams.toString() ? `?${searchParams.toString()}` : ''
    }`;
    setAuthState('redirecting');
    window.location.replace(getRaindropAuthHref(redirectTarget));
  });

  function redirectToAuthNow() {
    const redirectTarget = `${pathname}${
      searchParams.toString() ? `?${searchParams.toString()}` : ''
    }`;
    setAuthState('redirecting');
    window.location.replace(getRaindropAuthHref(redirectTarget));
  }

  const resolveTokens = useEffectEvent(async () => {
    try {
      const nextTokens = await ensureValidRaindropTokens();
      if (!nextTokens) {
        redirectToAuth();
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
  });

  const loadTree = useEffectEvent(async () => {
    setTreeLoading(true);
    setTreeError(null);

    try {
      const nextTokens = await resolveTokens();
      if (!nextTokens) {
        return;
      }

      const response = await fetchRaindropJson<{ tree: CollectionNode[] }>(
        '/api/raindrop/albums/tree',
        nextTokens,
      );
      setTree(response.tree);
      setExpandedCollections((current) => {
        if (Object.keys(current).length > 0) {
          return current;
        }

        return response.tree.reduce<Record<number, boolean>>((accumulator, node) => {
          accumulator[node.id] = true;
          return accumulator;
        }, {});
      });
    } catch (error) {
      setTreeError(
        error instanceof Error
          ? error.message
          : 'Failed to load Raindrop collection tree',
      );
    } finally {
      setTreeLoading(false);
    }
  });

  const loadAlbum = useEffectEvent(async (collectionId: number) => {
    setAlbumLoading(true);
    setAlbumError(null);

    try {
      const nextTokens = await resolveTokens();
      if (!nextTokens) {
        return;
      }

      const response = await fetchRaindropJson<AlbumCollectionPayload>(
        `/api/raindrop/albums/collections/${collectionId}`,
        nextTokens,
      );
      setAlbumPayload(response);
    } catch (error) {
      setAlbumPayload(null);
      setAlbumError(
        error instanceof Error ? error.message : 'Failed to load album',
      );
    } finally {
      setAlbumLoading(false);
    }
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const nextTokens = await ensureValidRaindropTokens();
        if (cancelled) {
          return;
        }

        if (!nextTokens) {
          redirectToAuth();
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

    void loadTree();
  }, [authState, tokens]);

  useEffect(() => {
    if (selectedCollectionId == null) {
      setAlbumPayload(null);
      setAlbumError(null);
      setAlbumLoading(false);
      return;
    }

    if (authState !== 'ready' || !tokens) {
      return;
    }

    void loadAlbum(selectedCollectionId);
  }, [authState, tokens, selectedCollectionId]);

  useEffect(() => {
    if (selectedCollectionId == null || !selectedTreeNode) {
      return;
    }

    setExpandedCollections((current) => {
      const nextState = { ...current };
      selectedTreeNode.pathIds.forEach((collectionId) => {
        nextState[collectionId] = true;
      });
      return nextState;
    });
  }, [selectedCollectionId, selectedTreeNode]);

  useEffect(() => {
    if (selectedPhotoId != null && selectedCollectionId == null) {
      const nextParams = buildAlbumSearchParams(searchParams, { photoId: null });
      router.replace(buildHref(pathname, nextParams));
    }
  }, [pathname, router, searchParams, selectedCollectionId, selectedPhotoId]);

  useEffect(() => {
    if (!albumPayload || selectedPhotoId == null) {
      return;
    }

    if (albumPayload.images.some((image) => image.id === selectedPhotoId)) {
      return;
    }

    const nextParams = buildAlbumSearchParams(searchParams, { photoId: null });
    router.replace(buildHref(pathname, nextParams));
  }, [albumPayload, pathname, router, searchParams, selectedPhotoId]);

  function pushRoute(nextState: Partial<{ collectionId: number | null; photoId: number | null }>) {
    const nextParams = buildAlbumSearchParams(searchParams, nextState);
    router.push(buildHref(pathname, nextParams));
  }

  function replaceRoute(
    nextState: Partial<{ collectionId: number | null; photoId: number | null }>,
  ) {
    const nextParams = buildAlbumSearchParams(searchParams, nextState);
    router.replace(buildHref(pathname, nextParams));
  }

  function handleReconnect() {
    clearStoredRaindropTokens();
    redirectToAuthNow();
  }

  function handleLogout() {
    clearStoredRaindropTokens();
    setTokens(null);
    setTree([]);
    setAlbumPayload(null);
    window.location.replace('/raindrop');
  }

  function handleToggleCollection(collectionId: number) {
    setExpandedCollections((current) => ({
      ...current,
      [collectionId]: !(current[collectionId] ?? true),
    }));
  }

  function handleSelectCollection(collectionId: number) {
    pushRoute({
      collectionId,
      photoId: null,
    });
    setMobileTreeOpen(false);
  }

  function handleOpenPhoto(photoId: number) {
    pushRoute({ photoId });
  }

  function handleClosePhoto() {
    replaceRoute({ photoId: null });
  }

  function handleShowPreviousPhoto() {
    const nextPhotoId = getAdjacentAlbumImageId(
      albumPayload?.images ?? [],
      selectedPhotoId,
      'previous',
    );

    if (nextPhotoId != null) {
      replaceRoute({ photoId: nextPhotoId });
    }
  }

  function handleShowNextPhoto() {
    const nextPhotoId = getAdjacentAlbumImageId(
      albumPayload?.images ?? [],
      selectedPhotoId,
      'next',
    );

    if (nextPhotoId != null) {
      replaceRoute({ photoId: nextPhotoId });
    }
  }

  if (authState === 'checking' || authState === 'redirecting') {
    return (
      <main className={`${nunito.className} ${styles.page}`}>
        <div className={styles.stateShell}>
          <div className={styles.stateCard}>
            <div className={styles.brand}>
              <Image
                src="/img/provider-raindrop-icon.png"
                alt="Raindrop"
                width={36}
                height={36}
                className={styles.brandIcon}
              />
              <span>Raindrop Albums</span>
            </div>
            <h1 className={styles.stateTitle}>Connecting to Raindrop</h1>
            <p className={styles.stateMessage}>
              {authState === 'checking'
                ? 'Checking your saved Raindrop session.'
                : 'Redirecting you to Raindrop OAuth.'}
            </p>
            <div className={styles.stateSpinner}>
              <span className="loading loading-spinner loading-md" />
              <span>Please wait...</span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (authState === 'error') {
    return (
      <main className={`${nunito.className} ${styles.page}`}>
        <div className={styles.stateShell}>
          <div className={styles.stateCard}>
            <div className={styles.brand}>
              <Image
                src="/img/provider-raindrop-icon.png"
                alt="Raindrop"
                width={36}
                height={36}
                className={styles.brandIcon}
              />
              <span>Raindrop Albums</span>
            </div>
            <h1 className={styles.stateTitle}>Could not validate login</h1>
            <p className={styles.stateMessage}>
              {authError ?? 'The stored Raindrop session could not be used.'}
            </p>
            <div className={styles.stateActions}>
              <button className="btn btn-primary" onClick={handleReconnect}>
                Reconnect
              </button>
              <Link className="btn btn-ghost" href="/raindrop">
                Back to workspace
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={`${nunito.className} ${styles.page}`}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <Image
              src="/img/provider-raindrop-icon.png"
              alt="Raindrop"
              width={36}
              height={36}
              className={styles.brandIcon}
            />
            <div>
              <div className={styles.brandTitle}>Raindrop Albums</div>
              <div className={styles.brandSubtitle}>
                Browse collection trees like a photos library.
              </div>
            </div>
          </div>

          <div className={styles.headerActions}>
            <button
              type="button"
              className={`btn btn-sm btn-outline ${styles.mobileTreeButton}`}
              onClick={() => setMobileTreeOpen(true)}
            >
              Collections
            </button>
            <Link className="btn btn-sm btn-ghost" href="/raindrop">
              Workspace
            </Link>
            <button className="btn btn-sm btn-outline" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </header>

        <button
          type="button"
          className={styles.mobileFab}
          onClick={() => setMobileTreeOpen(true)}
        >
          Collections
        </button>

        <div className={styles.layout}>
          <aside className={styles.sidebarDesktop}>
            <div className={styles.sidebarCard}>
              <div className={styles.sidebarHeader}>
                <div>
                  <div className={styles.sidebarEyebrow}>Collections</div>
                  <div className={styles.sidebarTitle}>
                    {treeMeta.total} collection{treeMeta.total === 1 ? '' : 's'}
                  </div>
                </div>
                {treeLoading ? (
                  <span className={styles.sidebarLoading}>loading...</span>
                ) : null}
              </div>

              {treeError ? (
                <div className={styles.inlineError}>{treeError}</div>
              ) : null}

              <CollectionTree
                tree={tree}
                selectedCollectionId={selectedCollectionId}
                expandedCollections={expandedCollections}
                onToggleCollection={handleToggleCollection}
                onSelectCollection={handleSelectCollection}
              />

              <div className={styles.mobileDrawerFooter}>
                <Link className="btn btn-sm btn-ghost" href="/raindrop">
                  Workspace
                </Link>
                <button className="btn btn-sm btn-outline" onClick={handleLogout}>
                  Log out
                </button>
              </div>
            </div>
          </aside>

          <div
            className={`${styles.mobileDrawerScrim} ${
              mobileTreeOpen ? styles.mobileDrawerScrimOpen : ''
            }`}
            onClick={() => setMobileTreeOpen(false)}
          />

          <aside
            className={`${styles.sidebarMobile} ${
              mobileTreeOpen ? styles.sidebarMobileOpen : ''
            }`}
          >
            <div className={styles.sidebarCard}>
              <div className={styles.sidebarHeader}>
                <div>
                  <div className={styles.sidebarEyebrow}>Collections</div>
                  <div className={styles.sidebarTitle}>Pick an album</div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setMobileTreeOpen(false)}
                >
                  Close
                </button>
              </div>

              {treeError ? (
                <div className={styles.inlineError}>{treeError}</div>
              ) : null}

              <CollectionTree
                tree={tree}
                selectedCollectionId={selectedCollectionId}
                expandedCollections={expandedCollections}
                onToggleCollection={handleToggleCollection}
                onSelectCollection={handleSelectCollection}
              />
            </div>
          </aside>

          <section className={styles.content}>
            {selectedCollectionId == null ? (
              <div className={styles.browserCard}>
                <div className={styles.heroBadge}>Browser mode</div>
                <h1 className={styles.heroTitle}>Choose a collection to open an album.</h1>
                <p className={styles.heroText}>
                  The left tree follows your Raindrop collection structure. Once
                  you pick a collection, this page switches into album mode and
                  shows only direct-child image bookmarks.
                </p>
                <div className={styles.heroStats}>
                  <div className={styles.heroStat}>
                    <span className={styles.heroStatValue}>{treeMeta.total}</span>
                    <span className={styles.heroStatLabel}>collections indexed</span>
                  </div>
                  <div className={styles.heroStat}>
                    <span className={styles.heroStatValue}>Google Photos</span>
                    <span className={styles.heroStatLabel}>inspired layout</span>
                  </div>
                </div>
              </div>
            ) : albumLoading ? (
              <div className={styles.browserCard}>
                <div className={styles.loadingState}>
                  <span className="loading loading-spinner loading-md" />
                  <span>Loading album...</span>
                </div>
              </div>
            ) : albumError ? (
              <div className={styles.browserCard}>
                <div className={styles.inlineError}>{albumError}</div>
              </div>
            ) : albumPayload ? (
              <>
                <div className={styles.albumToolbar}>
                  <div className={styles.albumBreadcrumbs}>
                    {albumPayload.breadcrumb.map((collection, index) => (
                      <span key={collection.id} className={styles.albumBreadcrumb}>
                        {index > 0 ? <span className={styles.breadcrumbSlash}>/</span> : null}
                        <button
                          type="button"
                          className={styles.breadcrumbButton}
                          onClick={() => handleSelectCollection(collection.id)}
                        >
                          {collection.title}
                        </button>
                      </span>
                    ))}
                  </div>
                  <a
                    href={getCollectionHref(albumPayload.collection.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm btn-outline"
                  >
                    Open in Raindrop
                  </a>
                </div>

                {albumPayload.images.length === 0 ? (
                  <div className={styles.browserCard}>
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>🖼️</div>
                      <h2 className={styles.emptyTitle}>No direct-child images here yet</h2>
                      <p className={styles.emptyText}>
                        This albums page only shows items with Raindrop type
                        <code className={styles.inlineCode}> image </code>
                        inside the selected collection.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className={styles.albumGrid}>
                    {albumPayload.images.map((image) => (
                      <button
                        key={image.id}
                        type="button"
                        className={styles.photoCard}
                        onClick={() => handleOpenPhoto(image.id)}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image.thumbnailUrl}
                          alt={image.title}
                          className={styles.photoImage}
                          loading="lazy"
                        />
                        <span className={styles.photoOverlay}>
                          <span className={styles.photoLabel}>{image.title}</span>
                          <span className={styles.photoDate}>
                            {formatTimestamp(image.lastUpdate ?? image.created)}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className={styles.browserCard}>
                <div className={styles.inlineError}>
                  The selected album could not be loaded.
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {activeImage ? (
        <PhotoViewer
          key={activeImage.id}
          images={albumPayload?.images ?? []}
          activeImage={activeImage}
          onClose={handleClosePhoto}
          onShowPrevious={handleShowPreviousPhoto}
          onShowNext={handleShowNextPhoto}
        />
      ) : null}
    </main>
  );
}

export default function RaindropAlbumsPage() {
  return (
    <Suspense fallback={<AlbumsLoadingShell />}>
      <RaindropAlbumsPageInner />
    </Suspense>
  );
}
