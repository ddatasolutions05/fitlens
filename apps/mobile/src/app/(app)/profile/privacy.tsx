import { useState } from 'react';

import { goBack } from '@/lib/nav';
import { usePreferences, useUpsertPreferences, type PreferencesRow } from '@/features/profile/hooks';
import { config } from '@/lib/config';
import { errorMessage } from '@/lib/net';
import { Button, Card, Chips, Input, PageHeader, Screen, Segmented, SkeletonCard, Text, space } from '@/ui';

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
      <PageHeader title="Diet and AI consent" backTo="/profile" />
      {prefs.isLoading ? (
        <SkeletonCard lines={5} />
      ) : (
        <>
          <ConsentCard p={prefs.data ?? null} />
          <DietForm key={prefs.data?.updated_at ?? 'new'} p={prefs.data ?? null} />
        </>
      )}
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
      <Text variant="heading">Photo analysis and Coach</Text>
      <Text variant="small" color="textMuted">
        With consent, Scan meal sends the photo you choose (resized to 1,600 px, location metadata removed) plus your diet pattern and allergies to the AI provider (Anthropic) to identify foods and estimate portions. The Coach sends a summary of your last 14 days of logs with each question, never photos. Photos stay in your own private storage. Under the provider&apos;s commercial terms, requests are not used to train its models. Consent is versioned ({config.aiConsentVersion}); withdrawing it turns both features off at once. Everything else keeps working.
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
      <Chips label="Cuisines" options={CUISINES} value={cuisines} onChange={setCuisines} />
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

