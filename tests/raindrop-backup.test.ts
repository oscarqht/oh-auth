import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  extractBackupPinnedSearchResults,
  fetchBackupPinnedSearchResults,
  normalizeBackupPinnedSearchResults,
} from '../src/lib/raindrop-api';

function createJsonResponse(data: unknown, init?: Partial<Response>) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    json: async () => data,
  } as Response;
}

function createZipResponse(entries: Record<string, string>) {
  const archive = createStoredZip(entries, { useDataDescriptor: true });
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    arrayBuffer: async () =>
      archive.buffer.slice(
        archive.byteOffset,
        archive.byteOffset + archive.byteLength,
      ),
  } as Response;
}

function createStoredZip(
  entries: Record<string, string>,
  options?: { useDataDescriptor?: boolean },
) {
  const useDataDescriptor = options?.useDataDescriptor ?? false;
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const [fileName, contents] of Object.entries(entries)) {
    const nameBuffer = Buffer.from(fileName, 'utf8');
    const contentBuffer = Buffer.from(contents, 'utf8');

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(useDataDescriptor ? 0x08 : 0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(useDataDescriptor ? 0 : contentBuffer.length, 18);
    localHeader.writeUInt32LE(useDataDescriptor ? 0 : contentBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const dataDescriptor = Buffer.alloc(16);
    dataDescriptor.writeUInt32LE(0x08074b50, 0);
    dataDescriptor.writeUInt32LE(0, 4);
    dataDescriptor.writeUInt32LE(contentBuffer.length, 8);
    dataDescriptor.writeUInt32LE(contentBuffer.length, 12);

    localHeaders.push(
      localHeader,
      nameBuffer,
      contentBuffer,
      ...(useDataDescriptor ? [dataDescriptor] : []),
    );

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(useDataDescriptor ? 0x08 : 0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(contentBuffer.length, 20);
    centralHeader.writeUInt32LE(contentBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralHeaders.push(centralHeader, nameBuffer);
    offset +=
      localHeader.length +
      nameBuffer.length +
      contentBuffer.length +
      (useDataDescriptor ? dataDescriptor.length : 0);
  }

  const centralDirectory = Buffer.concat(centralHeaders);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(Object.keys(entries).length, 8);
  endOfCentralDirectory.writeUInt16LE(Object.keys(entries).length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  return Buffer.concat([
    ...localHeaders,
    centralDirectory,
    endOfCentralDirectory,
  ]);
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('normalizeBackupPinnedSearchResults', () => {
  it('keeps only valid pinned search results', () => {
    const normalized = normalizeBackupPinnedSearchResults([
      { title: 'One', url: 'https://example.com/1', type: 'raindrop' },
      { title: 'Two', url: 'https://example.com/2', type: 'raindrop-collection' },
      {
        title: 'Projects',
        url: 'https://www.notion.so/acme/Projects-123',
        type: 'notion-page',
      },
      {
        title: 'Roadmap',
        url: 'https://www.notion.so/acme/Roadmap-456',
        type: 'notion-data-source',
      },
      { title: 'Bad', url: '', type: 'raindrop' },
      { title: 'Also bad', url: 'https://example.com/3', type: 'other' },
      null,
    ]);

    assert.deepEqual(normalized, [
      { title: 'One', url: 'https://example.com/1', type: 'raindrop' },
      {
        title: 'Two',
        url: 'https://example.com/2',
        type: 'raindrop-collection',
      },
      {
        title: 'Projects',
        url: 'https://www.notion.so/acme/Projects-123',
        type: 'notion-page',
      },
      {
        title: 'Roadmap',
        url: 'https://www.notion.so/acme/Roadmap-456',
        type: 'notion-data-source',
      },
    ]);
  });
});

describe('extractBackupPinnedSearchResults', () => {
  it('returns an empty list when pinnedSearchResults is absent or malformed', () => {
    assert.deepEqual(extractBackupPinnedSearchResults(null), []);
    assert.deepEqual(extractBackupPinnedSearchResults({}), []);
    assert.deepEqual(
      extractBackupPinnedSearchResults({ pinnedSearchResults: 'bad' }),
      [],
    );
  });
});

describe('fetchBackupPinnedSearchResults', () => {
  it('returns normalized results from the Raindrop backup file', async () => {
    let exportAuthHeader = '';

    globalThis.fetch = async (input, init) => {
      const url = String(input);

      if (url === 'https://api.raindrop.io/rest/v1/collections') {
        return createJsonResponse({
          items: [{ _id: 7, title: 'nenya / backup' }],
        });
      }

      if (url === 'https://api.raindrop.io/rest/v1/collections/childrens') {
        return createJsonResponse({ items: [] });
      }

      if (url === 'https://api.raindrop.io/rest/v1/raindrops/7/export.zip') {
        const headers = new Headers(init?.headers);
        exportAuthHeader = headers.get('authorization') ?? '';
        return createZipResponse({
          'options_backup.txt': JSON.stringify({
            pinnedSearchResults: [
              { title: 'One', url: 'https://example.com/1', type: 'raindrop' },
              {
                title: 'Two',
                url: 'https://example.com/2',
                type: 'raindrop-collection',
              },
              {
                title: 'Projects',
                url: 'https://www.notion.so/acme/Projects-123',
                type: 'notion-page',
              },
              { title: 'Ignored', url: 'https://example.com/3', type: 'other' },
            ],
          }),
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    };

    const results = await fetchBackupPinnedSearchResults('token');

    assert.deepEqual(results, [
      { title: 'One', url: 'https://example.com/1', type: 'raindrop' },
      {
        title: 'Two',
        url: 'https://example.com/2',
        type: 'raindrop-collection',
      },
      {
        title: 'Projects',
        url: 'https://www.notion.so/acme/Projects-123',
        type: 'notion-page',
      },
    ]);
    assert.equal(exportAuthHeader, 'Bearer token');
  });

  it('returns an empty list when the backup collection is missing', async () => {
    globalThis.fetch = async (input) => {
      const url = String(input);

      if (url === 'https://api.raindrop.io/rest/v1/collections') {
        return createJsonResponse({ items: [{ _id: 3, title: 'other' }] });
      }

      if (url === 'https://api.raindrop.io/rest/v1/collections/childrens') {
        return createJsonResponse({ items: [] });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    };

    const results = await fetchBackupPinnedSearchResults('token');
    assert.deepEqual(results, []);
  });

  it('returns an empty list when the backup file is missing', async () => {
    globalThis.fetch = async (input) => {
      const url = String(input);

      if (url === 'https://api.raindrop.io/rest/v1/collections') {
        return createJsonResponse({
          items: [{ _id: 7, title: 'nenya / backup' }],
        });
      }

      if (url === 'https://api.raindrop.io/rest/v1/collections/childrens') {
        return createJsonResponse({ items: [] });
      }

      if (url === 'https://api.raindrop.io/rest/v1/raindrops/7/export.zip') {
        return createZipResponse({
          'export.txt': 'https://example.com/other.txt',
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    };

    const results = await fetchBackupPinnedSearchResults('token');
    assert.deepEqual(results, []);
  });

  it('returns an empty list when the backup payload is malformed', async () => {
    globalThis.fetch = async (input) => {
      const url = String(input);

      if (url === 'https://api.raindrop.io/rest/v1/collections') {
        return createJsonResponse({
          items: [{ _id: 7, title: 'nenya / backup' }],
        });
      }

      if (url === 'https://api.raindrop.io/rest/v1/collections/childrens') {
        return createJsonResponse({ items: [] });
      }

      if (url === 'https://api.raindrop.io/rest/v1/raindrops/7/export.zip') {
        return createZipResponse({
          'options_backup.txt': '{not json',
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    };

    const results = await fetchBackupPinnedSearchResults('token');
    assert.deepEqual(results, []);
  });
});
