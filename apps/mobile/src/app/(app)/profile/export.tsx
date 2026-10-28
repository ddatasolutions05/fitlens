import { useState } from 'react';
import { Linking, Platform } from 'react-native';
import { exportDataResultSchema, functionErrorSchema, type ExportDataResult } from '@fitlens/schemas';

import { goBack } from '@/lib/nav';
import { errorMessage } from '@/lib/net';
import { supabase } from '@/lib/supabase';
import { Button, Card, Screen, Text, space } from '@/ui';

export default function ExportScreen() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExportDataResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke('export-data', { method: 'POST' });
      if (err) {
        let payload: unknown = data;
        if (payload == null && 'context' in err && err.context instanceof Response) payload = await err.context.json().catch(() => null);
        const body = functionErrorSchema.safeParse(payload);
        throw new Error(body.success ? body.data.error.message : err.message);
      }
      const parsed = exportDataResultSchema.parse(data);
      setResult(parsed);
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(parsed.signed_url, '_blank');
      else await Linking.openURL(parsed.signed_url);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen testID="export-screen">
      <Text variant="title" style={{ marginTop: space.lg }}>
        Export my data
      </Text>
      <Card style={{ gap: space.md }}>
        <Text color="textMuted" variant="small">
          Builds a zip with a JSON file and a CSV file for every table (profile, preferences, goals, foods you created, meals and items, photos index, weight, activity, water, day status) plus the original photos. The link expires after five minutes.
        </Text>
        <Button label="Create export" size="lg" onPress={() => void run()} loading={busy} testID="create-export" />
        {result ? (
          <Card tone="accent" style={{ gap: space.xs }}>
            <Text variant="bodyStrong">Export ready ({Math.round(result.bytes / 1024)} KB)</Text>
            <Text variant="small" color="textMuted">
              {Object.entries(result.tables)
                .map(([t, n]) => `${t}: ${n}`)
                .join(', ')}
              ; photos: {result.photos}
            </Text>
            <Button label="Download again" variant="secondary" onPress={() => void Linking.openURL(result.signed_url)} />
          </Card>
        ) : null}
        {error ? (
          <Text color="danger" variant="small">
            {error}
          </Text>
        ) : null}
      </Card>
      <Button label="Back" variant="ghost" onPress={() => goBack('/profile')} />
    </Screen>
  );
}
