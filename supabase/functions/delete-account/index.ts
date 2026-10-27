// Removes every storage object under the user's folder, then deletes the auth
// user. Every table cascades from auth.users, so rows go with it.
import { deleteAccountRequestSchema } from '@fitlens/schemas';

import { readEnv, requireUser } from '../_shared/auth.ts';
import { HttpError, handle, json, readJson } from '../_shared/http.ts';

async function listAll(admin: ReturnType<typeof Object>, prefix: string): Promise<string[]> {
  // Walks the user's folder recursively. Storage list is one level per call.
  const client = admin as { storage: { from: (b: string) => { list: (p: string, o: { limit: number; offset: number }) => Promise<{ data: { name: string; id: string | null }[] | null }> } } };
  const out: string[] = [];
  const stack = [prefix];
  while (stack.length) {
    const dir = stack.pop() as string;
    let offset = 0;
    for (;;) {
      const { data } = await client.storage.from('meal-photos').list(dir, { limit: 1000, offset });
      if (!data || data.length === 0) break;
      for (const entry of data) {
        const full = `${dir}/${entry.name}`;
        if (entry.id == null) stack.push(full);
        else out.push(full);
      }
      if (data.length < 1000) break;
      offset += data.length;
    }
  }
  return out;
}

Deno.serve(
  handle(async (req, requestId) => {
    if (req.method !== 'POST') throw new HttpError(405, 'method_not_allowed', 'POST only');
    const env = readEnv();
    const caller = await requireUser(req, env);
    const body = deleteAccountRequestSchema.safeParse(await readJson(req));
    if (!body.success) throw new HttpError(400, 'bad_request', 'Send { "confirm": "DELETE" }');

    const paths = await listAll(caller.admin, caller.userId);
    let removed = 0;
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      const { error } = await caller.admin.storage.from('meal-photos').remove(chunk);
      if (error) throw new HttpError(500, 'storage_error', `Removed ${removed} of ${paths.length} photos before failing. Try again to finish.`, true);
      removed += chunk.length;
    }

    const { error: userErr } = await caller.admin.auth.admin.deleteUser(caller.userId);
    if (userErr) throw new HttpError(500, 'auth_error', 'Photos were removed but the account could not be deleted. Try again.', true);

    return json({ deleted: true, photos_removed: removed }, 200, { 'x-request-id': requestId });
  }),
);
