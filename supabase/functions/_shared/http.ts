// Response helpers and the shared error envelope.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
  }
}

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra },
  });
}

export function errorResponse(err: unknown, requestId: string): Response {
  if (err instanceof HttpError) {
    return json({ error: { code: err.code, message: err.message, retryable: err.retryable } }, err.status, { 'x-request-id': requestId });
  }
  const message = err instanceof Error ? err.message : 'Unexpected error';
  console.error(JSON.stringify({ requestId, level: 'error', code: 'internal', message }));
  return json({ error: { code: 'internal', message: 'Something went wrong. Try again.', retryable: true } }, 500, { 'x-request-id': requestId });
}

export function handle(fn: (req: Request, requestId: string) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req) => {
    const requestId = crypto.randomUUID();
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    const started = Date.now();
    try {
      const res = await fn(req, requestId);
      console.log(JSON.stringify({ requestId, level: 'info', status: res.status, ms: Date.now() - started }));
      return res;
    } catch (err) {
      const res = errorResponse(err, requestId);
      console.log(JSON.stringify({ requestId, level: 'info', status: res.status, ms: Date.now() - started }));
      return res;
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, 'bad_request', 'Body must be JSON');
  }
}
