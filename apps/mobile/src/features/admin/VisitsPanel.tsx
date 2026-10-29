import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { config } from '@/lib/config';
import { Button, Card, EmptyState, Input, Text, space, toast, useTheme } from '@/ui';

import type { AdminOverview } from './hooks';

function when(iso: string): string {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function device(ua: string | null, platform: string | null): string {
  const s = ua ?? '';
  if (/iPhone/.test(s)) return 'iPhone';
  if (/iPad/.test(s)) return 'iPad';
  if (/Android/.test(s)) return 'Android';
  if (/Windows/.test(s)) return 'Windows';
  if (/Macintosh/.test(s)) return 'Mac';
  return platform ?? 'web';
}

function place(v: { city: string | null; region: string | null; country: string | null }): string {
  const parts = [v.city, v.region, v.country].filter(Boolean);
  return parts.length ? parts.join(', ') : 'location unknown';
}

export function InviteLinks() {
  const [tag, setTag] = useState('');
  const clean = tag.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const base = Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}${config.basePath}/` : `https://ddatasolutions05.github.io${config.basePath}/`;
  const link = clean ? `${base}?s=${clean}` : base;
  return (
    <Card style={{ gap: space.md }} testID="invite-links">
      <Text variant="bodyStrong">Invite links</Text>
      <Text variant="small" color="textMuted">
        Give each person or group its own tag. Opens, sign-ups and locations then show against that tag below.
      </Text>
      <Input label="Tag" value={tag} onChangeText={setTag} placeholder="e.g. mom, rahul, gym-whatsapp" autoCapitalize="none" autoCorrect={false} testID="invite-tag" />
      <Text tabular selectable testID="invite-link">
        {link}
      </Text>
      <Button
        label="Copy link"
        variant="secondary"
        onPress={async () => {
          try {
            await navigator.clipboard.writeText(link);
            toast('Link copied');
          } catch {
            toast('Select the link and copy it');
          }
        }}
        testID="invite-copy"
      />
    </Card>
  );
}

export function VisitsPanel({ o }: { o: AdminOverview }) {
  const { colors } = useTheme();
  const visits = o.visits ?? [];
  const sources = o.sources ?? [];
  const places = o.places ?? [];
  return (
    <View style={{ gap: space.lg }}>
      <InviteLinks />
      {visits.length === 0 ? (
        <EmptyState title="No opens yet" body={`Nobody opened the app in the last ${o.days} days, or they opened it before tracking went live.`} />
      ) : (
        <>
          <Card style={{ gap: 0 }} testID="admin-sources">
            <Text variant="label" color="textMuted" style={{ paddingBottom: space.sm }}>
              By link
            </Text>
            {sources.map((s, i) => (
              <View key={s.source} style={[styles.row, i < sources.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border } : null]}>
                <Text style={{ flex: 1 }}>{s.source}</Text>
                <Text tabular color="textMuted">
                  {s.visitors} people, {s.visits} opens, {s.signed_in} signed in
                </Text>
              </View>
            ))}
          </Card>
          <Card style={{ gap: 0 }} testID="admin-places">
            <Text variant="label" color="textMuted" style={{ paddingBottom: space.sm }}>
              By place
            </Text>
            {places.map((p, i) => (
              <View key={`${p.city}|${p.region}|${p.country}`} style={[styles.row, i < places.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border } : null]}>
                <Text style={{ flex: 1 }}>{[p.city, p.region, p.country].filter((x) => x && x !== '?').join(', ') || 'Unknown'}</Text>
                <Text tabular color="textMuted">
                  {p.visitors} people, {p.visits} opens
                </Text>
              </View>
            ))}
          </Card>
          <Card style={{ gap: 0 }} testID="admin-visits">
            <Text variant="label" color="textMuted" style={{ paddingBottom: space.sm }}>
              Recent opens
            </Text>
            {visits.map((v, i) => (
              <View key={v.id} style={[styles.visit, i < visits.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border } : null]}>
                <View style={styles.head}>
                  <Text variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                    {v.display_name ?? v.email ?? `Visitor ${v.visitor_id.slice(0, 6)}`}
                  </Text>
                  <Text variant="caption" color="textMuted">
                    {when(v.created_at)}
                  </Text>
                </View>
                <Text variant="caption" color="textMuted" numberOfLines={1}>
                  {place(v)}. {device(v.user_agent, v.platform)}. {v.source ? `Link: ${v.source}` : 'No tag'}
                  {v.referrer ? `. From ${v.referrer.replace(/^https?:\/\//, '').split('/')[0]}` : ''}
                </Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, gap: space.sm },
  visit: { paddingVertical: space.md, gap: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
