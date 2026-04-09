import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeCachedRaindropSessions } from '../src/lib/raindrop-workspace-cache';

describe('normalizeCachedRaindropSessions', () => {
  it('keeps only valid cached session summaries', () => {
    const sessions = normalizeCachedRaindropSessions([
      {
        id: 11,
        title: 'Morning tabs',
        cover: ['https://img.example.com/cover.png'],
        lastAction: '2026-04-09T03:12:00.000Z',
      },
      {
        id: 12,
        title: '  Planning  ',
        cover: 'https://img.example.com/solo.png',
        lastUpdate: '2026-04-09T04:00:00.000Z',
      },
      {
        id: 'bad',
        title: 'Wrong id type',
      },
      {
        id: 13,
        title: '   ',
      },
      null,
    ]);

    assert.deepEqual(sessions, [
      {
        id: 11,
        title: 'Morning tabs',
        cover: ['https://img.example.com/cover.png'],
        lastAction: '2026-04-09T03:12:00.000Z',
      },
      {
        id: 12,
        title: 'Planning',
        cover: 'https://img.example.com/solo.png',
        lastUpdate: '2026-04-09T04:00:00.000Z',
      },
    ]);
  });

  it('returns an empty list for malformed cache payloads', () => {
    assert.deepEqual(normalizeCachedRaindropSessions(null), []);
    assert.deepEqual(normalizeCachedRaindropSessions({ sessions: [] }), []);
  });
});
