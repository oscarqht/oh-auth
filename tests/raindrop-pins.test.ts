import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createPinnedRaindropResultsBackupPayload,
  getPinnedResultColor,
  isPinnedRaindropResult,
  readPinnedRaindropResultsPayload,
  toPinnedRaindropResult,
  togglePinnedRaindropResult,
} from '../src/lib/raindrop-pins';

describe('toPinnedRaindropResult', () => {
  it('normalizes searchable Raindrop items into pinned shortcut records', () => {
    const pinned = toPinnedRaindropResult({
      type: 'raindrop',
      data: {
        _id: 42,
        link: 'https://example.com/palx',
        title: 'Palx repo',
        collectionTitle: 'palx',
        isSession: false,
      },
    });

    assert.deepEqual(pinned, {
      key: 'raindrop:42',
      type: 'raindrop',
      id: 42,
      href: 'https://example.com/palx',
      title: 'Palx repo',
      subtitle: 'https://example.com/palx',
      badge: 'palx',
      badgeTone: 'ghost',
    });
  });

  it('normalizes searchable collections into pinned shortcut records', () => {
    const pinned = toPinnedRaindropResult({
      type: 'raindrop-collection',
      data: {
        _id: 7,
        title: 'Dia - Office',
        count: 12,
        parentCollectionTitle: 'Sessions',
        isSession: true,
      },
    });

    assert.deepEqual(pinned, {
      key: 'raindrop-collection:7',
      type: 'raindrop-collection',
      id: 7,
      href: 'https://app.raindrop.io/my/7',
      title: 'Dia - Office',
      subtitle: 'Open collection in Raindrop',
      badge: 'Sessions',
      badgeTone: 'accent',
      count: 12,
    });
  });
});

describe('togglePinnedRaindropResult', () => {
  it('adds a result to the front when it is not pinned yet', () => {
    const first = {
      key: 'raindrop:1',
      type: 'raindrop',
      id: 1,
      href: 'https://example.com/1',
      title: 'One',
      subtitle: 'https://example.com/1',
      badgeTone: 'ghost',
    } as const;

    const second = {
      key: 'raindrop:2',
      type: 'raindrop',
      id: 2,
      href: 'https://example.com/2',
      title: 'Two',
      subtitle: 'https://example.com/2',
      badgeTone: 'ghost',
    } as const;

    assert.deepEqual(togglePinnedRaindropResult([first], second), [second, first]);
  });

  it('removes a result when it is already pinned', () => {
    const pinned = {
      key: 'raindrop:1',
      type: 'raindrop',
      id: 1,
      href: 'https://example.com/1',
      title: 'One',
      subtitle: 'https://example.com/1',
      badgeTone: 'ghost',
    } as const;

    assert.deepEqual(togglePinnedRaindropResult([pinned], pinned), []);
  });
});

describe('isPinnedRaindropResult', () => {
  it('accepts valid pinned shortcut payloads', () => {
    assert.equal(
      isPinnedRaindropResult({
        key: 'raindrop:1',
        type: 'raindrop',
        id: 1,
        href: 'https://example.com/1',
        title: 'One',
        subtitle: 'https://example.com/1',
        badge: 'palx',
        badgeTone: 'ghost',
      }),
      true,
    );
  });

  it('rejects malformed pinned shortcut payloads', () => {
    assert.equal(
      isPinnedRaindropResult({
        key: 'raindrop:1',
        type: 'raindrop',
        id: '1',
      }),
      false,
    );
  });
});

describe('readPinnedRaindropResultsPayload', () => {
  it('reads legacy array payloads', () => {
    const results = readPinnedRaindropResultsPayload([
      {
        key: 'raindrop:1',
        type: 'raindrop',
        id: 1,
        href: 'https://example.com/1',
        title: 'One',
        subtitle: 'https://example.com/1',
        badgeTone: 'ghost',
      },
      {
        bad: true,
      },
    ]);

    assert.deepEqual(results, [
      {
        key: 'raindrop:1',
        type: 'raindrop',
        id: 1,
        href: 'https://example.com/1',
        title: 'One',
        subtitle: 'https://example.com/1',
        badgeTone: 'ghost',
      },
    ]);
  });

  it('reads backup payload objects from Raindrop', () => {
    const results = readPinnedRaindropResultsPayload({
      version: 1,
      savedAt: 123,
      pinnedSearchResults: [
        {
          key: 'raindrop-collection:7',
          type: 'raindrop-collection',
          id: 7,
          href: 'https://app.raindrop.io/my/7',
          title: 'Office',
          subtitle: 'Open collection in Raindrop',
          badgeTone: 'accent',
          count: 12,
        },
      ],
    });

    assert.deepEqual(results, [
      {
        key: 'raindrop-collection:7',
        type: 'raindrop-collection',
        id: 7,
        href: 'https://app.raindrop.io/my/7',
        title: 'Office',
        subtitle: 'Open collection in Raindrop',
        badgeTone: 'accent',
        count: 12,
      },
    ]);
  });
});

describe('createPinnedRaindropResultsBackupPayload', () => {
  it('wraps pinned results in the Raindrop backup format', () => {
    const payload = createPinnedRaindropResultsBackupPayload(
      [
        {
          key: 'raindrop:1',
          type: 'raindrop',
          id: 1,
          href: 'https://example.com/1',
          title: 'One',
          subtitle: 'https://example.com/1',
          badgeTone: 'ghost',
        },
      ],
      123,
    );

    assert.deepEqual(payload, {
      version: 1,
      savedAt: 123,
      pinnedSearchResults: [
        {
          key: 'raindrop:1',
          type: 'raindrop',
          id: 1,
          href: 'https://example.com/1',
          title: 'One',
          subtitle: 'https://example.com/1',
          badgeTone: 'ghost',
        },
      ],
    });
  });
});

describe('getPinnedResultColor', () => {
  it('returns a stable color for the same seed', () => {
    assert.deepEqual(
      getPinnedResultColor('https://example.com/palx'),
      getPinnedResultColor('https://example.com/palx'),
    );
  });

  it('returns palette colors with background and text values', () => {
    const color = getPinnedResultColor('https://example.com/other');

    assert.equal(typeof color.bg, 'string');
    assert.equal(typeof color.text, 'string');
    assert.ok(color.bg.startsWith('#'));
    assert.ok(color.text.startsWith('#'));
  });
});
