import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  dedupeRaindropSearchCollections,
  dedupeRaindropSearchItems,
} from '../src/lib/raindrop-api';

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
