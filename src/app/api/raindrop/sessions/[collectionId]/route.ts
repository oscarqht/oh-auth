import { NextRequest, NextResponse } from 'next/server';
import {
  fetchSessionDetails,
  readBearerAccessToken,
} from '@/lib/raindrop-api';

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
      { error: 'Invalid session collection id' },
      { status: 400 },
    );
  }

  try {
    const details = await fetchSessionDetails(accessToken, parsedCollectionId);
    return NextResponse.json(details);
  } catch (error) {
    console.error(
      `[api/raindrop/sessions/${collectionId}] Failed to load session details`,
      error,
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load session details',
      },
      { status: 500 },
    );
  }
}
