import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildAlbumSearchParams,
  buildCollectionTree,
  clampAlbumViewerTransform,
  getAdjacentAlbumImageId,
  getAlbumSwipeAction,
  normalizeAlbumImage,
  normalizeAlbumImages,
  orderRootCollections,
  parseAlbumRouteState,
} from '../src/lib/raindrop-albums';

describe('orderRootCollections', () => {
  it('orders root collections using user groups first and appends leftovers', () => {
    const ordered = orderRootCollections(
      [
        { _id: 1, title: 'Alpha', sort: 1 },
        { _id: 2, title: 'Beta', sort: 50 },
        { _id: 3, title: 'Gamma', sort: 25 },
      ],
      [
        {
          title: 'Main',
          sort: 0,
          collections: [3, 1],
        },
      ],
    );

    assert.deepEqual(
      ordered.map((collection) => collection._id),
      [3, 1, 2],
    );
  });
});

describe('buildCollectionTree', () => {
  it('orders child collections by sort descending then title', () => {
    const tree = buildCollectionTree(
      [{ _id: 10, title: 'Trips', sort: 5 }],
      [
        { _id: 11, title: 'Zoo', sort: 1, parent: { $id: 10 } },
        { _id: 12, title: 'Beach', sort: 9, parent: { $id: 10 } },
      ],
      [],
    );

    assert.deepEqual(tree[0]?.children.map((collection) => collection.id), [12, 11]);
    assert.deepEqual(tree[0]?.children[0]?.pathIds, [10, 12]);
  });
});

describe('normalizeAlbumImage', () => {
  it('normalizes image items using cover then media then link', () => {
    const fromCover = normalizeAlbumImage({
      _id: 1,
      title: 'Cover image',
      type: 'image',
      link: 'https://example.com/original.jpg',
      cover: 'https://example.com/cover.jpg',
    });
    const fromMedia = normalizeAlbumImage({
      _id: 2,
      title: 'Media image',
      type: 'image',
      link: 'https://example.com/original-2.jpg',
      media: [{ link: 'https://example.com/media.jpg' }],
    });
    const fromLink = normalizeAlbumImage({
      _id: 3,
      title: 'Link image',
      type: 'image',
      link: 'https://example.com/original-3.jpg',
    });

    assert.equal(fromCover?.thumbnailUrl, 'https://example.com/cover.jpg');
    assert.equal(fromCover?.fullUrl, 'https://example.com/cover.jpg');
    assert.equal(fromMedia?.thumbnailUrl, 'https://example.com/media.jpg');
    assert.equal(fromLink?.thumbnailUrl, 'https://example.com/original-3.jpg');
  });

  it('rejects non-image items', () => {
    assert.equal(
      normalizeAlbumImage({
        _id: 1,
        title: 'Bookmark',
        type: 'link',
        link: 'https://example.com',
      }),
      null,
    );
  });
});

describe('normalizeAlbumImages', () => {
  it('returns newest images first', () => {
    const images = normalizeAlbumImages([
      {
        _id: 1,
        title: 'Older',
        type: 'image',
        link: 'https://example.com/older.jpg',
        created: '2024-01-01T00:00:00.000Z',
      },
      {
        _id: 2,
        title: 'Newer',
        type: 'image',
        link: 'https://example.com/newer.jpg',
        created: '2025-01-01T00:00:00.000Z',
      },
    ]);

    assert.deepEqual(
      images.map((image) => image.id),
      [2, 1],
    );
  });
});

describe('album route state', () => {
  it('parses collection and photo ids from search params', () => {
    assert.deepEqual(
      parseAlbumRouteState('?collection=12&photo=88'),
      { collectionId: 12, photoId: 88 },
    );
  });

  it('builds search params while removing photo when collection clears', () => {
    const params = buildAlbumSearchParams('?collection=12&photo=88', {
      collectionId: null,
    });

    assert.equal(params.get('collection'), null);
    assert.equal(params.get('photo'), null);
  });
});

describe('getAdjacentAlbumImageId', () => {
  it('returns previous and next image ids when present', () => {
    const images = [
      {
        id: 1,
        title: 'One',
        thumbnailUrl: 'https://example.com/1.jpg',
        fullUrl: 'https://example.com/1.jpg',
      },
      {
        id: 2,
        title: 'Two',
        thumbnailUrl: 'https://example.com/2.jpg',
        fullUrl: 'https://example.com/2.jpg',
      },
      {
        id: 3,
        title: 'Three',
        thumbnailUrl: 'https://example.com/3.jpg',
        fullUrl: 'https://example.com/3.jpg',
      },
    ];

    assert.equal(getAdjacentAlbumImageId(images, 2, 'previous'), 1);
    assert.equal(getAdjacentAlbumImageId(images, 2, 'next'), 3);
    assert.equal(getAdjacentAlbumImageId(images, 3, 'next'), null);
  });
});

describe('clampAlbumViewerTransform', () => {
  it('preserves swipe offsets at base scale when requested', () => {
    const transform = clampAlbumViewerTransform(
      {
        scale: 1,
        offsetX: 140,
        offsetY: 24,
      },
      {
        width: 400,
        height: 800,
      },
      {
        allowOffsetAtBaseScale: true,
      },
    );

    assert.equal(transform.offsetX, 140);
    assert.equal(transform.offsetY, 24);
  });

  it('still resets offsets at base scale for non-swipe interactions', () => {
    const transform = clampAlbumViewerTransform(
      {
        scale: 1,
        offsetX: 140,
        offsetY: 24,
      },
      {
        width: 400,
        height: 800,
      },
    );

    assert.equal(transform.offsetX, 0);
    assert.equal(transform.offsetY, 0);
  });
});

describe('getAlbumSwipeAction', () => {
  it('maps offsets to previous, next, or close actions', () => {
    assert.equal(getAlbumSwipeAction(120, 10), 'previous');
    assert.equal(getAlbumSwipeAction(-120, 10), 'next');
    assert.equal(getAlbumSwipeAction(20, 130), 'close');
    assert.equal(getAlbumSwipeAction(20, 40), null);
  });
});
