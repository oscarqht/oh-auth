import { NextRequest, NextResponse } from 'next/server';
import {
  fetchSessionSummaries,
  readBearerAccessToken,
} from '@/lib/raindrop-api';

export async function GET(request: NextRequest) {
  const accessToken = readBearerAccessToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 });
  }

  try {
    const sessions = await fetchSessionSummaries(accessToken);
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('[api/raindrop/sessions] Failed to load sessions', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load Raindrop sessions',
      },
      { status: 500 },
    );
  }
}
