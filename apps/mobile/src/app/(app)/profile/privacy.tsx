import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { goBack } from '@/lib/nav';
import { usePreferences, useUpsertPreferences, type PreferencesRow } from '@/features/profile/hooks';
import { config } from '@/lib/config';
import { errorMessage } from '@/lib/net';
import { Button, Card, Input, Screen, Segmented, SkeletonCard, Text, radius, space, touch, useTheme } from '@/ui';

const CUISINES = ['Indian', 'Canadian', 'Mediterranean', 'East Asian', 'Mexican', 'Middle Eastern', 'Other'];
const DIETS = [
  { value: 'omnivore', label: 'Everything' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'eggetarian', label: 'Eggetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'jain', label: 'Jain' },
  { value: 'halal', label: 'Halal' },
  { value: 'pescatarian', label: 'Pescatarian' },
];

export default function PrivacyAndDiet() {
  const prefs = usePreferences();
  return (
    <Screen testID="privacy-screen">
      <Text variant="title" style={{ marginTop: space.lg }}>
        Diet and AI consent
      </Text>
      {prefs.isLoading ? (
        <SkeletonCard lines={5} />
      ) : (
        <>
          <ConsentCard p={prefs.data ?? null} />
          <DietForm key={prefs.data?.updated_at ?? 'new'} p={prefs.data ?? null} />
        </>
      )}
      <Button label="Back" variant="ghost" onPress={() => goBack('/profile')} />
    </Screen>
  );
}

function ConsentCard({ p }: { p: PreferencesRow | null }) {
  const upsert = useUpsertPreferences();
  const [error, setError] = useState<string | null>(null);
  const consented = Boolean(p?.ai_photo_consent_at);

  async function setConsent(on: boolean) {
    setError(null);
    try {
      await upsert.mutateAsync({
        ai_photo_consent_at: on ? new Date().toISOString() : null,
        ai_consent_version: on ? config.aiConsentVersion : null,
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Card style={{ gap: space.md }}>
      <Text variant="heading">Photo analysis</Text>
      <Text variant="small" color="textMuted">
        With consent, Scan Meal sends the photo you choose (resized to 1,600 px, location metadata removed) plus your diet pattern and allergies to the configured AI provider (Anthropic) to identify foods and estimate portions. The photo itself is kept only in your private storage in your own Supabase project. The provider&apos;s data-use terms and retention are summarised in docs/PRIVACY.md with links. Consent is versioned ({config.aiConsentVersion}); withdrawing it turns photo analysis off immediately. Everything else keeps working.
      </Text>
      <Segmented<'on' | 'off'>
        value={consented ? 'on' : 'off'}
        onChange={(v) => void setConsent(v === 'on')}
        options={[
          { value: 'on', label: 'Allowed' },
          { value: 'off', label: 'Not allowed' },
        ]}
      />
      {p?.ai_photo_consent_at ? (
        <Text variant="caption" color="textFaint">
          Consent given {new Date(p.ai_photo_consent_at).toLocaleString()} (version {p.ai_consent_version}).
        </Text>
      ) : null}
      {error ? (
        <Text color="danger" variant="small">
          {error}
        </Text>
      ) : null}
    </Card>
  );
}

function DietForm({ p }: { p: PreferencesRow | null }) {
  const { colors } = useTheme();
  const upsert = useUpsertPreferences();
  const [diet, setDiet] = useState<string | null>(p?.diet_pattern ?? null);
  const [allergies, setAllergies] = useState((p?.allergies ?? []).join(', '));
  const [cuisines, setCuisines] = useState<string[]>(p?.cuisines ?? []);
  const [avoid, setAvoid] = useState((p?.avoid_foods ?? []).join(', '));
  const [error, setError] = useState<string | null>(null);

  async function saveDiet() {
    setError(null);
    try {
      await upsert.mutateAsync({ diet_pattern: diet, allergies: split(allergies), cuisines, avoid_foods: split(avoid) });
      goBack('/profile');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Card style={{ gap: space.lg }}>
      <Text variant="heading">Diet</Text>
      <Segmented<string> label="Pattern" wrap value={diet} onChange={setDiet} options={DIETS} />
      <Input label="Allergies (comma separated)" value={allergies} onChangeText={setAllergies} hint="Items that may contain these are flagged neutrally. A photo can never confirm an allergen is absent." />
      <View style={{ gap: space.sm }}>
        <Text variant="small" color="textMuted">
          Cuisines
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {CUISINES.map((c) => {
            const on = cuisines.includes(c);
            return (
              <Pressable
                key={c}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => setCuisines(on ? cuisines.filter((x) => x !== c) : [...cuisines, c])}
                style={[styles.chip, { backgroundColor: on ? colors.accent : colors.surface, borderColor: on ? colors.accent : colors.border }]}
              >
                <Text style={{ color: on ? colors.onAccent : colors.text }}>{c}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Input label="Foods to avoid" value={avoid} onChangeText={setAvoid} />
      {error ? (
        <Text color="danger" variant="small">
          {error}
        </Text>
      ) : null}
      <Button label="Save diet" onPress={() => void saveDiet()} loading={upsert.isPending} />
    </Card>
  );
}

function split(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

const styles = StyleSheet.create({
  chip: { minHeight: touch.min, paddingHorizontal: space.md, justifyContent: 'center', borderRadius: radius.md, borderWidth: 1 },
});
