import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAdminOverview, useIsAdmin, type AdminUser } from '@/features/admin/hooks';
import { errorMessage } from '@/lib/net';
import { Button, Card, EmptyState, ErrorState, PageHeader, Screen, Segmented, SkeletonCard, Stat, Text, space, useTheme } from '@/ui';

function when(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function stage(u: AdminUser): string {
  if (u.meals > 0) return 'Logging';
  if (u.onboarding_completed_at) return 'Set up, no meal yet';
  return 'Signed up only';
}

export default function AdminScreen() {
  const { colors } = useTheme();
  const isAdmin = useIsAdmin();
  const [days, setDays] = useState<'1' | '7' | '30'>('7');
  const overview = useAdminOverview(Number(days), isAdmin.data === true);
  const [tab, setTab] = useState<'people' | 'errors' | 'usage' | 'searches'>('people');

  if (isAdmin.isLoading) {
    return (
      <Screen testID="admin-screen">
        <PageHeader title="Admin" backTo="/profile" />
        <SkeletonCard />
      </Screen>
    );
  }
  if (isAdmin.data !== true) {
    return (
      <Screen testID="admin-screen">
        <PageHeader title="Admin" backTo="/profile" />
        <View testID="admin-denied">
          <EmptyState title="Admin only" body="This account is not on the admin list." />
        </View>
      </Screen>
    );
  }

  const o = overview.data;
  return (
    <Screen testID="admin-screen">
      <PageHeader title="Admin" subtitle="Every account, what they did, and what broke. Reads live from the database." backTo="/profile" />
      <Segmented<'1' | '7' | '30'>
        value={days}
        onChange={setDays}
        options={[
          { value: '1', label: 'Today' },
          { value: '7', label: '7 days' },
          { value: '30', label: '30 days' },
        ]}
      />
      {overview.isLoading ? <SkeletonCard /> : null}
      {overview.error ? <ErrorState message={errorMessage(overview.error)} onRetry={() => overview.refetch()} /> : null}
      {o ? (
        <>
          <View style={styles.grid}>
            <Stat tone="inverse" label="Accounts" value={String(o.totals.accounts)} note={`${o.totals.onboarded} finished setup`} style={styles.half} testID="admin-accounts" />
            <Stat label="Logged a meal" value={String(o.totals.logged_a_meal)} note="ever" style={styles.half} />
            <Stat label="Signed in" value={String(o.totals.signed_in_recent)} note={`last ${o.days} d`} style={styles.half} />
            <Stat label="Meals" value={String(o.totals.meals_recent)} note={`last ${o.days} d`} style={styles.half} />
            <Stat label="AI calls" value={String(o.totals.coach_calls_recent + o.totals.analyses_recent)} note={`${o.totals.analyses_recent} photos, ${o.totals.coach_calls_recent} coach`} style={styles.half} />
            <Stat label="Errors" value={String(o.totals.errors_recent)} note={`last ${o.days} d`} tone={o.totals.errors_recent > 0 ? 'on' : undefined} style={styles.half} testID="admin-errors" />
          </View>

          <Segmented<'people' | 'errors' | 'usage' | 'searches'>
            value={tab}
            onChange={setTab}
            wrap
            options={[
              { value: 'people', label: `People (${o.users.length})` },
              { value: 'errors', label: `Errors (${o.errors.length})` },
              { value: 'usage', label: 'Usage' },
              { value: 'searches', label: `Missed searches (${o.misses?.length ?? 0})` },
            ]}
          />

          {tab === 'people' ? (
            <Card style={{ gap: 0 }} testID="admin-people">
              {o.users.map((u, i) => (
                <View key={u.user_id} style={[styles.person, i < o.users.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border } : null]}>
                  <View style={styles.personHead}>
                    <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
                      {u.display_name ?? u.email ?? u.phone ?? 'No name'}
                    </Text>
                    <Text variant="caption" color="textMuted">
                      {stage(u)}
                    </Text>
                  </View>
                  <Text variant="caption" color="textMuted" numberOfLines={1}>
                    {u.email ?? u.phone ?? ''} via {u.provider}
                  </Text>
                  <Text variant="caption" color="textMuted">
                    Joined {when(u.signed_up_at)}. Signed in {when(u.last_sign_in_at)}. Active {when(u.last_active_at)}.
                  </Text>
                  <Text variant="caption" tabular>
                    {u.meals} meals ({u.meals_recent} recent), {u.weights} weigh-ins, {u.activity} activity, {u.water} water, {u.analyses} photos, {u.coach_calls} coach
                    {u.errors_recent > 0 ? `, ${u.errors_recent} errors` : ''}
                  </Text>
                </View>
              ))}
            </Card>
          ) : null}

          {tab === 'errors' ? (
            o.errors.length === 0 ? (
              <EmptyState title="No errors" body={`Nothing was caught on a device in the last ${o.days} days.`} />
            ) : (
              <Card style={{ gap: 0 }} testID="admin-error-list">
                {o.errors.map((e, i) => (
                  <View key={e.id} style={[styles.person, i < o.errors.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border } : null]}>
                    <View style={styles.personHead}>
                      <Text variant="bodyStrong" style={{ flex: 1 }}>
                        {e.scope}
                      </Text>
                      <Text variant="caption" color="textMuted">
                        {when(e.created_at)}
                      </Text>
                    </View>
                    <Text variant="small">{e.message}</Text>
                    <Text variant="caption" color="textMuted" numberOfLines={1}>
                      {[e.email, e.platform, e.route, e.app_version].filter(Boolean).join(' / ')}
                    </Text>
                  </View>
                ))}
              </Card>
            )
          ) : null}

          {tab === 'usage' ? (
            o.events.length === 0 ? (
              <EmptyState title="No usage events" body={`No feature events in the last ${o.days} days.`} />
            ) : (
              <Card style={{ gap: 0 }} testID="admin-usage">
                {o.events.map((ev, i) => (
                  <View key={ev.name} style={[styles.usageRow, i < o.events.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border } : null]}>
                    <Text style={{ flex: 1 }}>{ev.name}</Text>
                    <Text tabular color="textMuted">
                      {ev.count} by {ev.people}
                    </Text>
                  </View>
                ))}
              </Card>
            )
          ) : null}

          {tab === 'searches' ? (
            (o.misses?.length ?? 0) === 0 ? (
              <EmptyState title="No missed searches" body={`Every food search found something in the last ${o.days} days.`} />
            ) : (
              <Card style={{ gap: 0 }} testID="admin-misses">
                <Text variant="caption" color="textMuted" style={{ paddingBottom: space.sm }}>
                  Searches that returned nothing. Add these to the food list or as aliases.
                </Text>
                {o.misses.map((m, i) => (
                  <View key={m.query} style={[styles.usageRow, i < o.misses.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border } : null]}>
                    <Text style={{ flex: 1 }}>{m.query}</Text>
                    <Text tabular color="textMuted">
                      {m.count} by {m.people}, {when(m.last_at)}
                    </Text>
                  </View>
                ))}
              </Card>
            )
          ) : null}

          <Text variant="caption" color="textFaint">
            Generated {when(o.generated_at)}. Function logs (edge failures) are not stored in the database; read them with scripts/telemetry.mjs.
          </Text>
          <Button label="Refresh" variant="secondary" onPress={() => overview.refetch()} testID="admin-refresh" />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  half: { flexBasis: '47%', flexGrow: 1 },
  person: { paddingVertical: space.md, gap: 4 },
  personHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  usageRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, gap: space.sm },
});
