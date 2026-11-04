/**
 * Tests the optional `prompt` field on `mcpServers.<name>.oauth`.
 *
 * Uses the real `@modelcontextprotocol/sdk` `startAuthorization`, which appends
 * `prompt=consent` whenever the scope includes `offline_access` (this forces the
 * Entra ID consent screen, AADSTS90094 for non-admin users).
 */

import { MCPOptionsSchema, TokenExchangeMethodEnum } from 'librechat-data-provider';
import type { MCPOptions } from 'librechat-data-provider';
import { MCPOAuthHandler } from '~/mcp/oauth';

jest.mock('@librechat/data-schemas', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  getTenantId: jest.fn(),
  SYSTEM_TENANT_ID: '__SYSTEM__',
  encryptV2: jest.fn(async (val: string) => `enc:${val}`),
  decryptV2: jest.fn(async (val: string) => val.replace(/^enc:/, '')),
}));

jest.mock('~/auth', () => ({
  ...jest.requireActual('~/auth'),
  createSSRFSafeUndiciConnect: jest.fn(() => undefined),
  isSSRFTarget: jest.fn(() => false),
  resolveHostnameSSRF: jest.fn(async () => false),
  isOAuthUrlAllowed: jest.fn(() => true),
}));

const ENTRA = 'https://login.microsoftonline.com/tenant-id/oauth2/v2.0';
const OFFLINE_SCOPE = 'openid offline_access https://graph.microsoft.com/User.Read';

const baseOAuth: NonNullable<MCPOptions['oauth']> = {
  authorization_url: `${ENTRA}/authorize`,
  token_url: `${ENTRA}/token`,
  client_id: 'test-client',
  client_secret: 'test-secret',
  redirect_uri: 'https://example.test/api/mcp/outlook/oauth/callback',
  scope: OFFLINE_SCOPE,
  token_exchange_method: TokenExchangeMethodEnum.DefaultPost,
};

async function authorizeUrl(oauth: NonNullable<MCPOptions['oauth']>): Promise<URL> {
  const { authorizationUrl } = await MCPOAuthHandler.initiateOAuthFlow(
    'outlook',
    'http://mcp.example.test/outlook',
    'user-1',
    {},
    oauth,
  );
  return new URL(authorizationUrl);
}

describe('MCP OAuth prompt parameter', () => {
  beforeAll(() => {
    jest.spyOn(global, 'fetch').mockImplementation(async () => new Response(null, { status: 404 }));
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('without oauth.prompt (behavior unchanged)', () => {
    it('keeps the SDK prompt=consent when scope includes offline_access', async () => {
      const url = await authorizeUrl(baseOAuth);
      expect(url.searchParams.getAll('prompt')).toEqual(['consent']);
      expect(url.searchParams.get('scope')).toBe(OFFLINE_SCOPE);
    });

    it('sends no prompt when scope has no offline_access', async () => {
      const url = await authorizeUrl({ ...baseOAuth, scope: 'openid User.Read' });
      expect(url.searchParams.has('prompt')).toBe(false);
    });
  });

  describe("with oauth.prompt: ''", () => {
    it('removes prompt but keeps offline_access in scope', async () => {
      const url = await authorizeUrl({ ...baseOAuth, prompt: '' });
      expect(url.searchParams.has('prompt')).toBe(false);
      expect(url.searchParams.get('scope')).toBe(OFFLINE_SCOPE);
    });

    it('keeps the rest of the authorize parameters intact', async () => {
      const url = await authorizeUrl({ ...baseOAuth, prompt: '' });
      expect(`${url.origin}${url.pathname}`).toBe(`${ENTRA}/authorize`);
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('client_id')).toBe('test-client');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('code_challenge')).toBeTruthy();
      expect(url.searchParams.get('state')).toBeTruthy();
      expect(url.searchParams.get('redirect_uri')).toMatch(/\/api\/mcp\/outlook\/oauth\/callback$/);
    });
  });

  describe('with a non-empty oauth.prompt', () => {
    it('replaces prompt=consent with the configured value', async () => {
      const url = await authorizeUrl({ ...baseOAuth, prompt: 'select_account' });
      expect(url.searchParams.getAll('prompt')).toEqual(['select_account']);
    });

    it('sends the configured value even without offline_access', async () => {
      const url = await authorizeUrl({
        ...baseOAuth,
        scope: 'openid User.Read',
        prompt: 'select_account',
      });
      expect(url.searchParams.getAll('prompt')).toEqual(['select_account']);
    });
  });

  describe('config schema', () => {
    const server = {
      type: 'streamable-http' as const,
      url: 'http://mcp.example.test/outlook',
      requiresOAuth: true,
    };

    it('accepts prompt as an empty string and preserves it', () => {
      const parsed = MCPOptionsSchema.parse({ ...server, oauth: { ...baseOAuth, prompt: '' } });
      expect(parsed.oauth?.prompt).toBe('');
    });

    it('leaves prompt undefined when not configured', () => {
      const parsed = MCPOptionsSchema.parse({ ...server, oauth: baseOAuth });
      expect(parsed.oauth?.prompt).toBeUndefined();
    });

    it('rejects a non-string prompt', () => {
      const result = MCPOptionsSchema.safeParse({
        ...server,
        oauth: { ...baseOAuth, prompt: false },
      });
      expect(result.success).toBe(false);
    });
  });
});
