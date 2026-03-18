import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { refreshAccessToken, getProviderConfig } from '../src/lib/oauth';

type MockFetchInit = RequestInit & {
  headers?: Record<string, string>;
};

describe('refreshAccessToken', () => {
  it('calls Raindrop token endpoint with JSON format', async () => {
    const provider = getProviderConfig('raindrop')!;
    const env = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost/callback'
    };
    const refreshToken = 'test-refresh-token';

    const mockResponse = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 3600
    };

    // Mock global fetch
    const originalFetch = global.fetch;
    global.fetch = mock.fn(async (url, init) => {
      assert.strictEqual(url, provider.tokenUrl);
      assert.strictEqual(init?.method, 'POST');
      const requestInit = init as MockFetchInit | undefined;
      assert.strictEqual(
        requestInit?.headers?.['content-type'],
        'application/json',
      );

      const body = JSON.parse(requestInit?.body as string);
      assert.strictEqual(body.client_id, env.clientId);
      assert.strictEqual(body.client_secret, env.clientSecret);
      assert.strictEqual(body.grant_type, 'refresh_token');
      assert.strictEqual(body.refresh_token, refreshToken);

      return {
        ok: true,
        json: async () => mockResponse,
        status: 200
      } as Response;
    });

    try {
      const result = await refreshAccessToken(provider, env, refreshToken);
      assert.deepStrictEqual(result, mockResponse);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('calls Google token endpoint with Form format', async () => {
    const provider = getProviderConfig('google')!;
    const env = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost/callback'
    };
    const refreshToken = 'test-refresh-token';

    const mockResponse = {
      access_token: 'new-access-token',
      expires_in: 3600
    };

    // Mock global fetch
    const originalFetch = global.fetch;
    global.fetch = mock.fn(async (url, init) => {
      assert.strictEqual(url, provider.tokenUrl);
      assert.strictEqual(init?.method, 'POST');
      const requestInit = init as MockFetchInit | undefined;
      assert.strictEqual(
        requestInit?.headers?.['content-type'],
        'application/x-www-form-urlencoded',
      );

      const body = new URLSearchParams(requestInit?.body as string);
      assert.strictEqual(body.get('client_id'), env.clientId);
      assert.strictEqual(body.get('client_secret'), env.clientSecret);
      assert.strictEqual(body.get('grant_type'), 'refresh_token');
      assert.strictEqual(body.get('refresh_token'), refreshToken);

      return {
        ok: true,
        json: async () => mockResponse,
        status: 200
      } as Response;
    });

    try {
      const result = await refreshAccessToken(provider, env, refreshToken);
      assert.deepStrictEqual(result, mockResponse);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
