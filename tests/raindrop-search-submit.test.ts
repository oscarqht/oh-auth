import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildBookmarkSearchSubmitHref } from '../src/lib/raindrop-search-submit';

describe('buildBookmarkSearchSubmitHref', () => {
  it('returns null for an empty query', () => {
    assert.equal(buildBookmarkSearchSubmitHref(''), null);
    assert.equal(buildBookmarkSearchSubmitHref('   '), null);
  });

  it('builds a regular Google search URL without a prefix', () => {
    assert.equal(
      buildBookmarkSearchSubmitHref('next auth callbacks'),
      'https://www.google.com/search?q=next%20auth%20callbacks',
    );
  });

  it('builds a Google AI mode search URL with the /gai prefix', () => {
    assert.equal(
      buildBookmarkSearchSubmitHref('/gai next auth callbacks'),
      'https://www.google.com/search?udm=50&aep=11&q=next%20auth%20callbacks',
    );
  });

  it('treats /gai without a following query as empty', () => {
    assert.equal(buildBookmarkSearchSubmitHref('/gai'), null);
    assert.equal(buildBookmarkSearchSubmitHref('/gai   '), null);
  });

  it('does not treat words that only start with /gai as the prefix', () => {
    assert.equal(
      buildBookmarkSearchSubmitHref('/gait analysis'),
      'https://www.google.com/search?q=%2Fgait%20analysis',
    );
  });
});
