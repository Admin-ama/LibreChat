import { logger } from '@librechat/data-schemas';

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

interface OpenRouterLog {
  model: string;
  status: number | 'network_error';
  latency: number;
}

function getRequestedModel(init?: RequestInit): string {
  if (typeof init?.body !== 'string') {
    return 'unknown';
  }

  try {
    const body = JSON.parse(init.body) as { model?: unknown };
    return typeof body.model === 'string' ? body.model : 'unknown';
  } catch {
    return 'unknown';
  }
}

function logCompletion(entry: OpenRouterLog): void {
  logger.info('[OpenRouter] completion', entry);
}

function observeResponse(response: Response, requestedModel: string, startedAt: number): Response {
  if (!response.body) {
    logCompletion({
      model: requestedModel,
      status: response.status,
      latency: Math.round(performance.now() - startedAt),
    });
    return response;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let selectedModel: string | undefined;
  let tail = '';
  let logged = false;

  const finish = (): void => {
    if (logged) {
      return;
    }
    logged = true;
    logCompletion({
      model: selectedModel ?? requestedModel,
      status: response.status,
      latency: Math.round(performance.now() - startedAt),
    });
  };

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const result = await reader.read();
      if (result.done) {
        tail += decoder.decode();
        selectedModel ??= /"model"\s*:\s*"([^"]+)"/.exec(tail)?.[1];
        finish();
        controller.close();
        return;
      }

      const text = tail + decoder.decode(result.value, { stream: true });
      selectedModel ??= /"model"\s*:\s*"([^"]+)"/.exec(text)?.[1];
      tail = text.slice(-512);
      controller.enqueue(result.value);
    },
    async cancel(reason) {
      finish();
      await reader.cancel(reason);
    },
  });

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export function createOpenRouterFetch(baseFetch: Fetch = globalThis.fetch): Fetch {
  return async (input, init) => {
    const startedAt = performance.now();
    const requestedModel = getRequestedModel(init);

    try {
      const response = await baseFetch(input, init);
      return observeResponse(response, requestedModel, startedAt);
    } catch (error) {
      logCompletion({
        model: requestedModel,
        status: 'network_error',
        latency: Math.round(performance.now() - startedAt),
      });
      throw error;
    }
  };
}
