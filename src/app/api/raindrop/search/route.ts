import { NextRequest, NextResponse } from 'next/server';
import {
  readBearerAccessToken,
  searchRaindropWorkspace,
} from '@/lib/raindrop-api';

export async function GET(request: NextRequest) {
  const accessToken = readBearerAccessToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (query.length < 3) {
    return NextResponse.json({ items: [], collections: [] });
  }

  try {
    const response = await searchRaindropWorkspace(accessToken, query);
    return NextResponse.json(response);
  } catch (error) {
    console.error('[api/raindrop/search] Search failed', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to search Raindrop',
      },
      { status: 500 },
    );
  }
}
