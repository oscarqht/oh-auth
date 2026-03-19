import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  dedupeRaindropSearchCollections,
  dedupeRaindropSearchItems,
  fetchRaindropBackupFile,
} from '../src/lib/raindrop-api';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe('dedupeRaindropSearchCollections', () => {
  it('removes duplicate collections that share the same _id', () => {
    const uniqueCollections = dedupeRaindropSearchCollections([
      { _id: 64914957, title: 'drafts', count: 15 },
      { _id: 64914957, title: 'drafts', count: 15 },
      { _id: 20, title: 'other', count: 1 },
    ]);

    assert.deepEqual(
      uniqueCollections.map((collection) => collection._id),
      [64914957, 20],
    );
  });
});

describe('dedupeRaindropSearchItems', () => {
  it('removes duplicate items that share the same URL', () => {
    const uniqueItems = dedupeRaindropSearchItems([
      {
        _id: 1,
        link: 'https://example.com/drafts',
        title: 'drafts',
      },
      {
        _id: 2,
        link: 'https://example.com/drafts',
        title: 'drafts copy',
      },
      {
        _id: 3,
        link: 'https://example.com/other',
        title: 'other',
      },
    ]);

    assert.deepEqual(
      uniqueItems.map((item) => item._id),
      [1, 3],
    );
  });
});

describe('fetchRaindropBackupFile', () => {
  it('treats malformed downloaded backup files as missing instead of throwing', async () => {
    let downloadAuthorizationHeader: string | null = null;

    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url === 'https://api.raindrop.io/rest/v1/collections') {
        return Response.json({
          items: [{ _id: 10, title: 'nenya / pinned search results' }],
        });
      }

      if (url === 'https://api.raindrop.io/rest/v1/collections/childrens') {
        return Response.json({ items: [] });
      }

      if (
        url ===
        'https://api.raindrop.io/rest/v1/raindrops/10?perpage=50&page=0'
      ) {
        return Response.json({
          items: [
            {
              _id: 12,
              title: 'pinned_search_results.json',
              link: 'https://files.example/pinned_search_results.json',
              lastUpdate: '2026-03-19T00:00:00.000Z',
            },
          ],
          count: 1,
        });
      }

      if (url === 'https://files.example/pinned_search_results.json') {
        downloadAuthorizationHeader = new Headers(init?.headers).get(
          'authorization',
        );
        return new Response('<!doctype html>', {
          status: 200,
          headers: {
            'content-type': 'text/html',
          },
        });
      }

      throw new Error(`Unexpected fetch URL in test: ${url}`);
    }) as typeof global.fetch;

    const result = await fetchRaindropBackupFile('token', {
      collectionTitle: 'nenya / pinned search results',
      fileName: 'pinned_search_results.json',
    });

    assert.deepEqual(result, {
      found: false,
      payload: null,
      lastModified: '2026-03-19T00:00:00.000Z',
    });
    assert.equal(downloadAuthorizationHeader, 'Bearer token');
  });
});
