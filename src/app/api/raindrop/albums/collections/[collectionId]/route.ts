import { NextRequest, NextResponse } from 'next/server';
import { readBearerAccessToken } from '@/lib/raindrop-api';
import { fetchAlbumCollectionPayload } from '@/lib/raindrop-albums';

type RouteContext = {
  params: Promise<{
    collectionId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const accessToken = readBearerAccessToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 });
  }

  const { collectionId } = await context.params;
  const parsedCollectionId = Number(collectionId);
  if (!Number.isFinite(parsedCollectionId)) {
    return NextResponse.json(
      { error: 'Invalid album collection id' },
      { status: 400 },
    );
  }

  try {
    const payload = await fetchAlbumCollectionPayload(accessToken, parsedCollectionId);
    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to load Raindrop album';
    const status = message === 'Collection not found' ? 404 : 500;

    console.error(
      `[api/raindrop/albums/collections/${collectionId}] Failed to load album`,
      error,
    );
    return NextResponse.json({ error: message }, { status });
  }
}
