import { NextRequest, NextResponse } from 'next/server';
import {
  describeMissingEnv,
  getProviderConfig,
  loadProviderEnv,
  refreshAccessToken,
} from '@/lib/oauth';

type RouteContext = {
  params: Promise<{
    provider: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { provider: providerId } = await context.params;
  const provider = providerId ? getProviderConfig(providerId) : null;

  if (!provider) {
    return NextResponse.json(
      { error: `Unsupported provider "${providerId}"` },
      { status: 404 },
    );
  }

  const envResult = loadProviderEnv(provider.id);

  if (!envResult.ok) {
    return NextResponse.json(
      { error: `Missing credentials: ${describeMissingEnv(envResult.missing)}` },
      { status: 500 },
    );
  }

  let refreshToken: string | undefined;
  try {
    const body = await request.json();
    refreshToken = body.refresh_token;
  } catch {
    // Fallback to form data if JSON parsing fails
    try {
      const formData = await request.formData();
      const val = formData.get('refresh_token');
      if (typeof val === 'string') {
        refreshToken = val;
      }
    } catch {
      // ignore
    }
  }

  if (!refreshToken) {
    return NextResponse.json(
      { error: 'Missing refresh_token in request body' },
      { status: 400 },
    );
  }

  try {
    const tokens = await refreshAccessToken(
      provider,
      envResult.env,
      refreshToken,
    );
    return NextResponse.json(tokens);
  } catch (error) {
    console.error(`[refresh] Token refresh failed for ${provider.id}`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Token refresh failed' },
      { status: 400 },
    );
  }
}
