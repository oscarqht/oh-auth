import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { NextRequest } from 'next/server';
import { GET as GET_TREE } from '../src/app/api/raindrop/albums/tree/route';
import { GET as GET_COLLECTION } from '../src/app/api/raindrop/albums/collections/[collectionId]/route';

function buildRequest(url: string, accessToken?: string) {
  const headers = accessToken
    ? { authorization: `Bearer ${accessToken}` }
    : undefined;

  return new NextRequest(url, { headers });
}

describe('GET /api/raindrop/albums/tree', () => {
  it('returns 401 when the bearer token is missing', async () => {
    const response = await GET_TREE(
      buildRequest('https://example.test/api/raindrop/albums/tree'),
    );

    assert.equal(response.status, 401);
  });

  it('returns the normalized collection tree', async () => {
    const originalFetch = global.fetch;
    global.fetch = mock.fn(async (url) => {
      const href = String(url);

      if (href.endsWith('/user')) {
        return Response.json({
          result: true,
          user: {
            groups: [{ sort: 0, collections: [2, 1] }],
          },
        });
      }

      if (href.endsWith('/collections')) {
        return Response.json({
          result: true,
          items: [
            { _id: 1, title: 'Alpha', sort: 1 },
            { _id: 2, title: 'Beta', sort: 2 },
          ],
        });
      }

      if (href.endsWith('/collections/childrens')) {
        return Response.json({
          result: true,
          items: [{ _id: 3, title: 'Child', sort: 1, parent: { $id: 2 } }],
        });
      }

      throw new Error(`Unexpected url: ${href}`);
    });

    try {
      const response = await GET_TREE(
        buildRequest('https://example.test/api/raindrop/albums/tree', 'token'),
      );

      assert.equal(response.status, 200);
      const payload = (await response.json()) as {
        tree: Array<{ id: number; children: Array<{ id: number }> }>;
      };

      assert.deepEqual(
        payload.tree.map((collection) => collection.id),
        [2, 1],
      );
      assert.deepEqual(payload.tree[0]?.children.map((child) => child.id), [3]);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('GET /api/raindrop/albums/collections/[collectionId]', () => {
  it('returns 400 when the collection id is invalid', async () => {
    const response = await GET_COLLECTION(
      buildRequest(
        'https://example.test/api/raindrop/albums/collections/not-a-number',
        'token',
      ),
      {
        params: Promise.resolve({ collectionId: 'not-a-number' }),
      },
    );

    assert.equal(response.status, 400);
  });

  it('returns album payload with direct-child images only', async () => {
    const originalFetch = global.fetch;
    global.fetch = mock.fn(async (url) => {
      const href = String(url);

      if (href.endsWith('/user')) {
        return Response.json({
          result: true,
          user: { groups: [{ sort: 0, collections: [10] }] },
        });
      }

      if (href.endsWith('/collections')) {
        return Response.json({
          result: true,
          items: [{ _id: 10, title: 'Trips', sort: 5 }],
        });
      }

      if (href.endsWith('/collections/childrens')) {
        return Response.json({
          result: true,
          items: [{ _id: 11, title: 'Beach', sort: 1, parent: { $id: 10 } }],
        });
      }

      if (href.includes('/raindrops/11?')) {
        return Response.json({
          result: true,
          count: 2,
          items: [
            {
              _id: 1,
              title: 'Photo',
              type: 'image',
              link: 'https://example.com/photo.jpg',
              created: '2025-01-01T00:00:00.000Z',
            },
            {
              _id: 2,
              title: 'Bookmark',
              type: 'link',
              link: 'https://example.com/bookmark',
              created: '2025-01-02T00:00:00.000Z',
            },
          ],
        });
      }

      throw new Error(`Unexpected url: ${href}`);
    });

    try {
      const response = await GET_COLLECTION(
        buildRequest(
          'https://example.test/api/raindrop/albums/collections/11',
          'token',
        ),
        {
          params: Promise.resolve({ collectionId: '11' }),
        },
      );

      assert.equal(response.status, 200);
      const payload = (await response.json()) as {
        collection: { id: number };
        breadcrumb: Array<{ id: number }>;
        images: Array<{ id: number }>;
      };

      assert.equal(payload.collection.id, 11);
      assert.deepEqual(
        payload.breadcrumb.map((item) => item.id),
        [10, 11],
      );
      assert.deepEqual(
        payload.images.map((item) => item.id),
        [1],
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
});
