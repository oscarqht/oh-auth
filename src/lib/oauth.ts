import type { NextRequest } from 'next/server';

type ProviderId = 'google' | 'raindrop';

type ProviderConfig = {
  id: ProviderId;
  name: string;
  authorizationUrl: string;
  tokenUrl: string;
  scope: string;
  authParams?: Record<string, string>;
  tokenEndpointFormat?: 'json' | 'form';
};

type ProviderEnv = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

type EnvResult =
  | { ok: true; env: ProviderEnv }
  | { ok: false; missing: string[] };

const providerConfigs: Record<ProviderId, ProviderConfig> = {
  google: {
    id: 'google',
    name: 'Google',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    authParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  },
  raindrop: {
    id: 'raindrop',
    name: 'Raindrop',
    authorizationUrl: 'https://raindrop.io/oauth/authorize',
    tokenUrl: 'https://raindrop.io/oauth/access_token',
    scope: 'read+write',
    tokenEndpointFormat: 'json',
  },
};

const providerEnvVars: Record<
  ProviderId,
  { clientId: string; clientSecret: string; redirectUri: string }
> = {
  google: {
    clientId: 'GOOGLE_CLIENT_ID',
    clientSecret: 'GOOGLE_CLIENT_SECRET',
    redirectUri: 'GOOGLE_REDIRECT_URI',
  },
  raindrop: {
    clientId: 'RAINDROP_CLIENT_ID',
    clientSecret: 'RAINDROP_CLIENT_SECRET',
    redirectUri: 'RAINDROP_REDIRECT_URI',
  },
};

export function getProviderConfig(provider: string): ProviderConfig | null {
  if (providerConfigs.google.id === provider) return providerConfigs.google;
  if (providerConfigs.raindrop.id === provider) return providerConfigs.raindrop;
  return null;
}

export function loadProviderEnv(providerId: ProviderId): EnvResult {
  const envKeys = providerEnvVars[providerId];
  const clientId = process.env[envKeys.clientId];
  const clientSecret = process.env[envKeys.clientSecret];
  const redirectUri = process.env[envKeys.redirectUri];

  const missing = [
    clientId ? null : envKeys.clientId,
    clientSecret ? null : envKeys.clientSecret,
    redirectUri ? null : envKeys.redirectUri,
  ].filter(Boolean) as string[];

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  return {
    ok: true,
    env: {
      clientId: clientId!,
      clientSecret: clientSecret!,
      redirectUri: redirectUri!,
    },
  };
}

export function buildAuthorizationUrl(
  provider: ProviderConfig,
  env: ProviderEnv,
  state: string,
  request?: NextRequest,
): string {
  const extraScope = request?.nextUrl.searchParams.get('scope') ?? '';
  const scope = `${provider.scope} ${extraScope}`;
  const showToken = request?.nextUrl.searchParams.get('show_token');

  let finalState = state;
  if (showToken) {
    let stateObj: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(state);
      if (typeof parsed === 'object' && parsed !== null) {
        stateObj = parsed;
      }
    } catch {
      // not a json. Maybe it's a random UUID.
      if (state) {
        stateObj.originalState = state;
      }
    }
    stateObj.show_token = true;
    finalState = JSON.stringify(stateObj);
  }

  const url = new URL(provider.authorizationUrl);
  url.searchParams.set('client_id', env.clientId);
  url.searchParams.set('redirect_uri', env.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scope);
  url.searchParams.set('state', finalState);

  Object.entries(provider.authParams ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  if (provider.id === 'google' && request) {
    const hostedDomain = request.nextUrl.searchParams.get('hd');
    if (hostedDomain) {
      url.searchParams.set('hd', hostedDomain);
    }
  }

  return url.toString();
}

export async function exchangeCodeForTokens(
  provider: ProviderConfig,
  env: ProviderEnv,
  code: string,
): Promise<unknown> {
  const params = {
    client_id: env.clientId,
    client_secret: env.clientSecret,
    redirect_uri: env.redirectUri,
    grant_type: 'authorization_code',
    code,
  };

  const useJson = provider.tokenEndpointFormat === 'json';
  const body = useJson
    ? JSON.stringify(params)
    : new URLSearchParams(params).toString();

  const response = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: {
      'content-type': useJson
        ? 'application/json'
        : 'application/x-www-form-urlencoded',
    },
    body,
  });

  let json: unknown = null;
  try {
    json = await response.json();
  } catch (error) {
    console.error('Failed to parse token response', error);
  }

  if (!response.ok) {
    throw new Error(
      `Token exchange failed for ${provider.id}: ${
        response.status
      } ${JSON.stringify(json)}`,
    );
  }

  return json;
}

export async function refreshAccessToken(
  provider: ProviderConfig,
  env: ProviderEnv,
  refreshToken: string,
): Promise<unknown> {
  const params = {
    client_id: env.clientId,
    client_secret: env.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  };

  const useJson = provider.tokenEndpointFormat === 'json';
  const body = useJson
    ? JSON.stringify(params)
    : new URLSearchParams(params).toString();

  const response = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: {
      'content-type': useJson
        ? 'application/json'
        : 'application/x-www-form-urlencoded',
    },
    body,
  });

  let json: unknown = null;
  try {
    json = await response.json();
  } catch (error) {
    console.error('Failed to parse refresh token response', error);
  }

  if (!response.ok) {
    throw new Error(
      `Token refresh failed for ${provider.id}: ${
        response.status
      } ${JSON.stringify(json)}`,
    );
  }

  return json;
}

export function describeMissingEnv(missing: string[]): string {
  return missing.join(', ');
}
