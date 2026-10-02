import { ChatOpenRouter } from '@librechat/agents';
import { logger } from '@librechat/data-schemas';
import type { BindToolsInput } from '@librechat/agents/langchain/language_models/chat_models';
import type { OpenAIConfigOptions } from '~/types';
import { getOpenAIConfig } from './config';
import { createOpenRouterFetch } from './openrouter';

const MODELS = [
  'openai/gpt-5.6-luna',
  'nvidia/nemotron-3-super-120b-a12b',
  'qwen/qwen3.6-35b-a3b',
  'google/gemma-4-31b-it',
] as const;

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

interface TestModelResponse {
  response_metadata: {
    model_name?: string;
  };
}

declare module '@librechat/agents' {
  interface ChatOpenRouter {
    invoke(input: string | Array<[string, string]>): Promise<TestModelResponse>;
    bindTools(tools: BindToolsInput[]): ChatOpenRouter;
  }
}

function getAMAGPTOpenRouterConfig(streaming = true): OpenAIConfigOptions {
  return {
    reverseProxyUrl: 'https://openrouter.ai/api/v1',
    addParams: {
      models: [...MODELS],
      maxRetries: 3,
      provider: { allow_fallbacks: true },
    },
    streaming,
    modelOptions: { model: MODELS[0], temperature: 0.2 },
  };
}

function completion(model: string): Response {
  return new Response(
    JSON.stringify({
      id: 'chatcmpl-test',
      object: 'chat.completion',
      created: 1,
      model,
      choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

function recoverableError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { message, type: 'upstream_error' } }), {
    status,
    headers: { 'content-type': 'application/json', 'retry-after': '0' },
  });
}

function createClient(fetch: Fetch, tools?: BindToolsInput[]) {
  const result = getOpenAIConfig('not-a-real-key', getAMAGPTOpenRouterConfig(false), 'OpenRouter');
  const client = new ChatOpenRouter({
    ...result.llmConfig,
    configuration: { ...result.configOptions, fetch },
  } as ConstructorParameters<typeof ChatOpenRouter>[0]);
  return tools ? client.bindTools(tools) : client;
}

describe('AMAGPT OpenRouter model fallback chain', () => {
  it('configures the exact ordered chain and a bounded retry budget', () => {
    const result = getOpenAIConfig('not-a-real-key', getAMAGPTOpenRouterConfig(), 'OpenRouter');

    expect(result.llmConfig.modelKwargs).toMatchObject({
      models: [...MODELS],
      provider: { allow_fallbacks: true },
    });
    expect(result.llmConfig.maxRetries).toBe(3);
    expect(result.llmConfig.streaming).toBe(true);
  });

  it('sends Luna first and includes the exact ordered models array in the HTTP body', async () => {
    const requests: Array<Record<string, unknown>> = [];
    const fetch = jest.fn<Promise<Response>, Parameters<Fetch>>(async (_input, init) => {
      requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return completion(MODELS[0]);
    });

    const tool: BindToolsInput = {
      type: 'function',
      function: {
        name: 'get_status',
        description: 'Returns a status',
        parameters: { type: 'object', properties: {} },
      },
    };
    const response = await createClient(fetch, [tool]).invoke([
      ['system', 'sensitive system prompt'],
      ['human', 'sensitive user prompt'],
    ]);

    expect(response.response_metadata.model_name).toBe(MODELS[0]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(requests[0]).toMatchObject({
      model: MODELS[0],
      models: [...MODELS],
      temperature: 0.2,
      tools: [
        {
          type: 'function',
          function: {
            name: 'get_status',
            description: 'Returns a status',
            parameters: { type: 'object', properties: {} },
          },
        },
      ],
      messages: [
        { role: 'developer', content: 'sensitive system prompt' },
        { role: 'user', content: 'sensitive user prompt' },
      ],
    });
  });

  it('retries after a 429 and accepts the second model selected by OpenRouter', async () => {
    const fetch = jest
      .fn<Promise<Response>, Parameters<Fetch>>()
      .mockResolvedValueOnce(recoverableError(429, 'Luna rate limited'))
      .mockResolvedValueOnce(completion(MODELS[1]));

    const response = await createClient(fetch).invoke('hello');

    expect(response.response_metadata.model_name).toBe(MODELS[1]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('continues through recoverable failures until the last model responds', async () => {
    const fetch = jest
      .fn<Promise<Response>, Parameters<Fetch>>()
      .mockResolvedValueOnce(recoverableError(429, 'Luna rate limited'))
      .mockResolvedValueOnce(recoverableError(503, 'Nemotron unavailable'))
      .mockResolvedValueOnce(recoverableError(502, 'Qwen upstream unavailable'))
      .mockResolvedValueOnce(completion(MODELS[3]));

    const response = await createClient(fetch).invoke('hello');

    expect(response.response_metadata.model_name).toBe(MODELS[3]);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('returns a clear error after every model and retry is exhausted', async () => {
    const fetch = jest.fn<Promise<Response>, Parameters<Fetch>>(async () =>
      recoverableError(503, 'No models in the AMAGPT OpenRouter fallback chain responded'),
    );

    await expect(createClient(fetch).invoke('hello')).rejects.toThrow(
      'No models in the AMAGPT OpenRouter fallback chain responded',
    );
    expect(fetch).toHaveBeenCalledTimes(4);
  });
});

describe('OpenRouter fallback telemetry', () => {
  it('logs only the selected model, status, and latency', async () => {
    const info = jest.spyOn(logger, 'info').mockImplementation(() => logger);
    const fetch = createOpenRouterFetch(async () => completion(MODELS[1]));
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: 'Bearer secret-key' },
      body: JSON.stringify({
        model: MODELS[0],
        models: [...MODELS],
        messages: [{ role: 'user', content: 'sensitive prompt' }],
      }),
    });

    await response.json();

    expect(info).toHaveBeenCalledWith('[OpenRouter] completion', {
      model: MODELS[1],
      status: 200,
      latency: expect.any(Number),
    });
    expect(JSON.stringify(info.mock.calls)).not.toContain('sensitive prompt');
    expect(JSON.stringify(info.mock.calls)).not.toContain('secret-key');
  });
});
