import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, as, closeDatabase, createUser, expectDenied, resetDatabase, uuid, type TestUser } from './helpers';

let user: TestUser;
let other: TestUser;

beforeAll(async () => {
  await resetDatabase();
  user = await createUser('u');
  other = await createUser('o');
});

afterAll(async () => {
  await closeDatabase();
});

async function insertMeal(
  u: TestUser,
  opts: { key?: string; localDate: string; eatenAt?: string; tz?: string; status?: 'draft' | 'confirmed' },
): Promise<string> {
  const r = await as(u, (c) =>
    c.query(
      `insert into meals (user_id, idempotency_key, local_date, eaten_at, tz, source, status)
       values ($1, $2, $3, coalesce($4::timestamptz, now()), $5, 'manual', $6)
       on conflict (user_id, idempotency_key) do update set updated_at = now()
       returning id`,
      [u.id, opts.key ?? uuid(), opts.localDate, opts.eatenAt ?? null, opts.tz ?? 'America/Toronto', opts.status ?? 'confirmed'],
    ),
  );
  return r.rows[0].id;
}

async function insertItem(u: TestUser, mealId: string, kcal: number | null, protein: number | null = null): Promise<void> {
  await as(u, (c) =>
    c.query(
      `insert into meal_items (user_id, meal_id, name_snapshot, grams, kcal, protein_g, provenance)
       values ($1, $2, 'item', 100, $3, $4, 'database')`,
      [u.id, mealId, kcal, protein],
    ),
  );
}

describe('idempotency', () => {
  it('a double submit with the same key creates one meal', async () => {
    const key = uuid();
    const first = await insertMeal(user, { key, localDate: '2026-10-20' });
    const second = await insertMeal(user, { key, localDate: '2026-10-20' });
    expect(second).toBe(first);
    const count = await as(user, (c) => c.query('select count(*)::int as n from meals where idempotency_key = $1', [key]));
    expect(count.rows[0].n).toBe(1);
  });

  it('a plain duplicate insert is rejected by the unique constraint', async () => {
    const key = uuid();
    await insertMeal(user, { key, localDate: '2026-10-20' });
    const message = await expectDenied(
      as(user, (c) =>
        c.query(`insert into meals (user_id, idempotency_key, local_date, tz, source) values ($1, $2, '2026-10-20', 'UTC', 'manual')`, [
          user.id,
          key,
        ]),
      ),
    );
    expect(message).toMatch(/meals_idempotency/);
  });

  it('a second photo attached to a draft adds a photo row, not a meal', async () => {
    const mealId = await insertMeal(user, { localDate: '2026-10-21', status: 'draft' });
    const before = await as(user, (c) => c.query('select count(*)::int as n from meals where user_id = $1', [user.id]));
    for (const i of [1, 2]) {
      await as(user, (c) =>
        c.query(`insert into meal_photos (user_id, meal_id, storage_path, sort_order) values ($1, $2, $3, $4)`, [
          user.id,
          mealId,
          `${user.id}/${mealId}/${uuid()}.jpg`,
          i,
        ]),
      );
    }
    const after = await as(user, (c) => c.query('select count(*)::int as n from meals where user_id = $1', [user.id]));
    expect(after.rows[0].n).toBe(before.rows[0].n);
    const photos = await as(user, (c) => c.query('select count(*)::int as n from meal_photos where meal_id = $1', [mealId]));
    expect(photos.rows[0].n).toBe(2);
  });

  it('duplicate imported activity records collapse on (source, external_id)', async () => {
    const insert = () =>
      as(user, (c) =>
        c.query(
          `insert into activity_records (user_id, kind, local_date, tz, steps, source, external_id)
           values ($1, 'steps', '2026-10-21', 'UTC', 5000, 'healthkit', 'hk-123')
           on conflict (user_id, source, external_id) do nothing`,
          [user.id],
        ),
      );
    await insert();
    await insert();
    const rows = await as(user, (c) =>
      c.query(`select count(*)::int as n from activity_records where source = 'healthkit' and external_id = 'hk-123'`),
    );
    expect(rows.rows[0].n).toBe(1);
  });
});

describe('daily totals', () => {
  it('drafts never count and null nutrients are excluded, not zeroed', async () => {
    const date = '2026-10-22';
    const confirmed = await insertMeal(user, { localDate: date, status: 'confirmed' });
    await insertItem(user, confirmed, 300, 20);
    await insertItem(user, confirmed, null, 10);
    const draft = await insertMeal(user, { localDate: date, status: 'draft' });
    await insertItem(user, draft, 900, 50);

    const totals = await as(user, (c) =>
      c.query('select * from daily_totals where user_id = $1 and local_date = $2', [user.id, date]),
    );
    const row = totals.rows[0];
    expect(Number(row.kcal)).toBe(300);
    expect(Number(row.kcal_unknown)).toBe(1);
    expect(Number(row.protein_g)).toBe(30);
    expect(Number(row.protein_unknown)).toBe(0);
    expect(Number(row.meal_count)).toBe(1);
  });

  it('a day with no confirmed meals has no totals row (not logged, not zero)', async () => {
    const totals = await as(user, (c) =>
      c.query('select * from daily_totals where user_id = $1 and local_date = $2', [user.id, '2001-01-01']),
    );
    expect(totals.rowCount).toBe(0);
  });

  it('a day where every item is unknown reports null kcal with the unknown count', async () => {
    const date = '2026-10-23';
    const meal = await insertMeal(user, { localDate: date });
    await insertItem(user, meal, null);
    const totals = await as(user, (c) =>
      c.query('select kcal, kcal_unknown from daily_totals where user_id = $1 and local_date = $2', [user.id, date]),
    );
    expect(totals.rows[0].kcal).toBeNull();
    expect(Number(totals.rows[0].kcal_unknown)).toBe(1);
  });

  it('the kcal range covers every item, with point estimates for items without a range', async () => {
    const date = '2026-10-25';
    const meal = await insertMeal(user, { localDate: date });
    await insertItem(user, meal, 300);
    await as(user, (c) =>
      c.query(
        `insert into meal_items (user_id, meal_id, name_snapshot, grams, kcal, kcal_low, kcal_high, provenance)
         values ($1, $2, 'ranged', 100, 200, 150, 260, 'ai_estimate')`,
        [user.id, meal],
      ),
    );
    const totals = await as(user, (c) =>
      c.query('select kcal, kcal_low, kcal_high, ranged_count from daily_totals where user_id = $1 and local_date = $2', [user.id, date]),
    );
    expect(Number(totals.rows[0].kcal)).toBe(500);
    expect(Number(totals.rows[0].kcal_low)).toBe(450);
    expect(Number(totals.rows[0].kcal_high)).toBe(560);
    expect(Number(totals.rows[0].ranged_count)).toBe(1);
  });

  it('other users never see my totals', async () => {
    const totals = await as(other, (c) => c.query('select * from daily_totals where user_id = $1', [user.id]));
    expect(totals.rowCount).toBe(0);
  });
});

describe('timezone', () => {
  it('an entry at 23:30 local stays on that local date regardless of UTC', async () => {
    // 23:30 Toronto on 2026-10-24 is 03:30 UTC on 2026-10-25
    const mealId = await insertMeal(user, {
      localDate: '2026-10-24',
      eatenAt: '2026-10-25T03:30:00Z',
      tz: 'America/Toronto',
    });
    const row = await as(user, (c) =>
      c.query(`select local_date::text as local_date, (eaten_at at time zone 'UTC')::text as utc from meals where id = $1`, [mealId]),
    );
    expect(row.rows[0].local_date).toBe('2026-10-24');
    expect(row.rows[0].utc).toBe('2026-10-25 03:30:00');
  });

  it('changing the profile timezone later does not move past entries', async () => {
    await as(user, (c) =>
      c.query(`insert into profiles (user_id, timezone) values ($1, 'America/Toronto') on conflict (user_id) do update set timezone = excluded.timezone`, [
        user.id,
      ]),
    );
    const mealId = await insertMeal(user, { localDate: '2026-10-24', eatenAt: '2026-10-25T03:30:00Z', tz: 'America/Toronto' });
    await as(user, (c) => c.query(`update profiles set timezone = 'Asia/Kolkata' where user_id = $1`, [user.id]));
    const row = await as(user, (c) => c.query('select local_date::text as local_date, tz from meals where id = $1', [mealId]));
    expect(row.rows[0].local_date).toBe('2026-10-24');
    expect(row.rows[0].tz).toBe('America/Toronto');
  });
});

describe('target history', () => {
  it('changing the goal leaves past days on the old version', async () => {
    await as(user, (c) =>
      c.query(
        `insert into goal_versions (user_id, effective_from, goal_type, calorie_target, source)
         values ($1, '2026-10-01', 'fat_loss', 1800, 'calculated')`,
        [user.id],
      ),
    );
    await as(user, (c) =>
      c.query(
        `insert into goal_versions (user_id, effective_from, goal_type, calorie_target, source)
         values ($1, '2026-10-15', 'maintenance', 2200, 'manual')`,
        [user.id],
      ),
    );
    const early = await as(user, (c) => c.query(`select calorie_target from goal_for_date('2026-10-10')`));
    const late = await as(user, (c) => c.query(`select calorie_target from goal_for_date('2026-10-20')`));
    const before = await as(user, (c) => c.query(`select calorie_target from goal_for_date('2026-09-01')`));
    expect(early.rows[0].calorie_target).toBe(1800);
    expect(late.rows[0].calorie_target).toBe(2200);
    expect(before.rowCount).toBe(0);
  });

  it('goal_for_date is scoped to the caller', async () => {
    const rows = await as(other, (c) => c.query(`select calorie_target from goal_for_date('2026-10-20')`));
    expect(rows.rowCount).toBe(0);
  });
});

describe('parent ownership', () => {
  it('rejects a meal item pointing at another user\'s meal even with a matching user_id', async () => {
    const theirs = await insertMeal(other, { localDate: '2026-10-22' });
    const message = await expectDenied(
      as(user, (c) =>
        c.query(
          `insert into meal_items (user_id, meal_id, name_snapshot, grams, provenance) values ($1, $2, 'x', 10, 'user')`,
          [user.id, theirs],
        ),
      ),
    );
    expect(message).toMatch(/parent row not found/);
  });
});

describe('search_foods', () => {
  it('ranks own recents, then verified, then community, and handles typos', async () => {
    await admin((c) =>
      c.query(`
        insert into foods (source, source_ref, name, kcal, verified) values
          ('usda', 's1', 'Chicken breast, roasted', 165, true),
          ('off', 's2', 'Chicken breast strips (brand)', 150, false),
          ('cnf', 's3', 'Chicken thigh, roasted', 209, true)
      `),
    );
    const community = await admin((c) => c.query(`select id from foods where source_ref = 's2'`));
    await as(user, (c) => c.query(`select touch_food_usage($1, 120)`, [community.rows[0].id]));

    const rows = await as(user, (c) => c.query(`select name, rank_bucket from search_foods('chiken breast', 10)`));
    const names = rows.rows.map((r) => r.name as string);
    expect(names[0]).toBe('Chicken breast strips (brand)');
    expect(names).toContain('Chicken breast, roasted');
    expect(rows.rows[0].rank_bucket).toBe(0);
  });

  it('does not surface other users\' private foods', async () => {
    await as(other, (c) => c.query(`insert into foods (owner_user_id, source, name) values ($1, 'user', 'Secret sandwich')`, [other.id]));
    const rows = await as(user, (c) => c.query(`select name from search_foods('secret sandwich', 10)`));
    expect(rows.rowCount).toBe(0);
  });

  it('learns the usual portion without rewriting history', async () => {
    const f = await as(user, (c) =>
      c.query(`insert into foods (owner_user_id, source, name) values ($1, 'user', 'Roti') returning id`, [user.id]),
    );
    const id = f.rows[0].id;
    await as(user, (c) => c.query(`select touch_food_usage($1, 40)`, [id]));
    await as(user, (c) => c.query(`select touch_food_usage($1, 60)`, [id]));
    const usage = await as(user, (c) => c.query(`select use_count, usual_grams from user_food_usage where food_id = $1`, [id]));
    expect(usage.rows[0].use_count).toBe(2);
    expect(Number(usage.rows[0].usual_grams)).toBe(46);
  });
});

describe('ai usage cap', () => {
  it('increments until the cap and then refuses', async () => {
    const call = () =>
      admin((c) => c.query(`select fitlens.increment_ai_usage($1, '2026-10-27', 'analyses', 3, 0.01) as ok`, [user.id]));
    const results: boolean[] = [];
    for (let i = 0; i < 5; i += 1) results.push((await call()).rows[0].ok);
    expect(results).toEqual([true, true, true, false, false]);
    const row = await admin((c) => c.query(`select analyses, est_cost_usd from ai_usage where user_id = $1 and local_date = '2026-10-27'`, [user.id]));
    expect(row.rows[0].analyses).toBe(3);
    expect(Number(row.rows[0].est_cost_usd)).toBeCloseTo(0.03);
  });

  it('is not callable by users', async () => {
    const message = await expectDenied(
      as(user, (c) => c.query(`select fitlens.increment_ai_usage($1, '2026-10-27', 'analyses', 3)`, [user.id])),
    );
    expect(message).toMatch(/permission denied/);
  });
});

describe('daily activity', () => {
  it('takes steps from one preferred source per day and never sums across sources', async () => {
    const date = '2026-10-26';
    await as(user, (c) =>
      c.query(
        `insert into integration_connections (user_id, provider, status, priority) values ($1, 'healthkit', 'connected', 0)`,
        [user.id],
      ),
    );
    const rows = [
      ['manual', 'm1', 4000],
      ['healthkit', 'h1', 6000],
      ['healthkit', 'h2', 1500],
      ['health_connect', 'c1', 9000],
    ] as const;
    for (const [source, ext, steps] of rows) {
      await as(user, (c) =>
        c.query(
          `insert into activity_records (user_id, kind, local_date, tz, steps, source, external_id) values ($1, 'steps', $2, 'UTC', $3, $4, $5)`,
          [user.id, date, steps, source, ext],
        ),
      );
    }
    await as(user, (c) =>
      c.query(
        `insert into activity_records (user_id, kind, local_date, tz, workout_type, duration_min, kcal_estimate) values ($1, 'workout', $2, 'UTC', 'running', 30, 300)`,
        [user.id, date],
      ),
    );
    const day = await as(user, (c) => c.query('select * from daily_activity where user_id = $1 and local_date = $2', [user.id, date]));
    expect(Number(day.rows[0].steps)).toBe(7500);
    expect(day.rows[0].steps_source).toBe('healthkit');
    expect(Number(day.rows[0].workout_count)).toBe(1);
    expect(Number(day.rows[0].workout_kcal)).toBe(300);
  });
});
