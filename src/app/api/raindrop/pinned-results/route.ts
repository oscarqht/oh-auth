import { NextRequest, NextResponse } from 'next/server';
import {
  fetchRaindropBackupFile,
  readBearerAccessToken,
  saveRaindropBackupFile,
} from '@/lib/raindrop-api';
import {
  createPinnedRaindropResultsBackupPayload,
  readPinnedRaindropResultsPayload,
} from '@/lib/raindrop-pins';

const BACKUP_COLLECTION_TITLE = 'nenya / pinned search results';
const BACKUP_FILE_NAME = 'pinned_search_results.json';
const UPLOAD_FILE_NAME = 'pinned_search_results.txt';

export async function GET(request: NextRequest) {
  const accessToken = readBearerAccessToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 });
  }

  try {
    const response = await fetchRaindropBackupFile(accessToken, {
      collectionTitle: BACKUP_COLLECTION_TITLE,
      fileName: BACKUP_FILE_NAME,
    });

    return NextResponse.json({
      found: response.found,
      results: readPinnedRaindropResultsPayload(response.payload),
      lastModified: response.lastModified,
    });
  } catch (error) {
    console.error(
      '[api/raindrop/pinned-results] Failed to fetch pinned results',
      error,
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch pinned results',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const accessToken = readBearerAccessToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || !Array.isArray((body as { results?: unknown }).results)) {
    return NextResponse.json(
      { error: 'Expected a results array' },
      { status: 400 },
    );
  }

  const results = readPinnedRaindropResultsPayload(
    (body as { results: unknown[] }).results,
  );

  try {
    await saveRaindropBackupFile(accessToken, {
      collectionTitle: BACKUP_COLLECTION_TITLE,
      fileName: BACKUP_FILE_NAME,
      uploadFileName: UPLOAD_FILE_NAME,
      payload: createPinnedRaindropResultsBackupPayload(results),
    });

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    console.error(
      '[api/raindrop/pinned-results] Failed to save pinned results',
      error,
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to save pinned results',
      },
      { status: 500 },
    );
  }
}
