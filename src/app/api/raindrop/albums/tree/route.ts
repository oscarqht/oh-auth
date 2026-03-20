import { NextRequest, NextResponse } from 'next/server';
import { readBearerAccessToken } from '@/lib/raindrop-api';
import { fetchCollectionTree } from '@/lib/raindrop-albums';

export async function GET(request: NextRequest) {
  const accessToken = readBearerAccessToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 });
  }

  try {
    const tree = await fetchCollectionTree(accessToken);
    return NextResponse.json({ tree });
  } catch (error) {
    console.error('[api/raindrop/albums/tree] Failed to load collection tree', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load Raindrop collection tree',
      },
      { status: 500 },
    );
  }
}
