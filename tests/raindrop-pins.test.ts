import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getPinnedResultColor,
  getPinnedResultIcon,
  toPinnedRaindropResult,
} from '../src/lib/raindrop-pins';

describe('toPinnedRaindropResult', () => {
  it('maps backup-backed pinned results into readonly UI records', () => {
    const pinned = toPinnedRaindropResult({
      title: 'Palx repo',
      url: 'https://example.com/palx',
      type: 'raindrop',
    });

    assert.deepEqual(pinned, {
      key: 'raindrop:https://example.com/palx',
      type: 'raindrop',
      href: 'https://example.com/palx',
      title: 'Palx repo',
    });
  });

  it('preserves collection pins with collection type', () => {
    const pinned = toPinnedRaindropResult({
      title: 'Drafts',
      url: 'https://app.raindrop.io/my/7',
      type: 'raindrop-collection',
    });

    assert.deepEqual(pinned, {
      key: 'raindrop-collection:https://app.raindrop.io/my/7',
      type: 'raindrop-collection',
      href: 'https://app.raindrop.io/my/7',
      title: 'Drafts',
    });
  });

  it('preserves notion page pins from backup', () => {
    const pinned = toPinnedRaindropResult({
      title: 'Projects',
      url: 'https://www.notion.so/acme/Projects-123',
      type: 'notion-page',
    });

    assert.deepEqual(pinned, {
      key: 'notion-page:https://www.notion.so/acme/Projects-123',
      type: 'notion-page',
      href: 'https://www.notion.so/acme/Projects-123',
      title: 'Projects',
    });
  });
});

describe('getPinnedResultIcon', () => {
  it('returns the matching icon for each supported pin type', () => {
    assert.equal(getPinnedResultIcon('raindrop'), '💧');
    assert.equal(getPinnedResultIcon('raindrop-collection'), '📥');
    assert.equal(getPinnedResultIcon('notion-page'), '📝');
    assert.equal(getPinnedResultIcon('notion-data-source'), '🗃️');
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
