// Streaming RFC 4180 CSV reader. Yields one string[] per record, header included.
import type { Readable } from 'node:stream';

export async function* csvRows(input: Readable, encoding = 'utf-8'): AsyncGenerator<string[]> {
  const decoder = new TextDecoder(encoding);
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let quotePending = false;
  let skipLf = false;
  let first = true;

  const parse = function* (text: string): Generator<string[]> {
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (skipLf) {
        skipLf = false;
        if (ch === '\n') continue;
      }
      if (inQuotes) {
        if (quotePending) {
          quotePending = false;
          if (ch === '"') {
            field += '"';
            continue;
          }
          inQuotes = false;
        } else if (ch === '"') {
          quotePending = true;
          continue;
        } else {
          field += ch;
          continue;
        }
      }
      if (ch === '"' && field === '') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r') skipLf = true;
        row.push(field);
        field = '';
        const out = row;
        row = [];
        if (!(out.length === 1 && out[0] === '')) yield out;
      } else {
        field += ch;
      }
    }
  };

  for await (const chunk of input) {
    let text = decoder.decode(chunk as Buffer, { stream: true });
    if (first) {
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      first = false;
    }
    yield* parse(text);
  }
  yield* parse(decoder.decode());
  if (inQuotes && quotePending) inQuotes = false;
  if (field !== '' || row.length > 0) {
    row.push(field);
    yield row;
  }
}

export interface Csv {
  // Column index by header name; throws when a required column is missing.
  col(name: string): number;
  rows: AsyncGenerator<string[]>;
}

export async function openCsv(input: Readable, encoding = 'utf-8'): Promise<Csv> {
  const rows = csvRows(input, encoding);
  const head = await rows.next();
  if (head.done) throw new Error('empty csv');
  const header = head.value.map((h) => h.trim());
  return {
    col(name: string): number {
      const i = header.indexOf(name);
      if (i < 0) throw new Error(`csv column missing: ${name} (have ${header.join(', ')})`);
      return i;
    },
    rows,
  };
}
