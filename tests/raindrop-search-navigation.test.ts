import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getCycledSearchResultIndex } from '../src/lib/raindrop-search-navigation';

describe('getCycledSearchResultIndex', () => {
  it('returns null when there are no results', () => {
    assert.equal(getCycledSearchResultIndex(null, 'next', 0), null);
    assert.equal(getCycledSearchResultIndex(2, 'previous', 0), null);
  });

  it('starts from the first result when moving down without a selection', () => {
    assert.equal(getCycledSearchResultIndex(null, 'next', 4), 0);
  });

  it('starts from the last result when moving up without a selection', () => {
    assert.equal(getCycledSearchResultIndex(null, 'previous', 4), 3);
  });

  it('wraps around when moving past either end of the list', () => {
    assert.equal(getCycledSearchResultIndex(3, 'next', 4), 0);
    assert.equal(getCycledSearchResultIndex(0, 'previous', 4), 3);
  });
});
