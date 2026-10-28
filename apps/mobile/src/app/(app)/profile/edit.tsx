import { useState } from 'react';
import { View } from 'react-native';
import { cmToFtIn, ftInToCm, kgToLb, lbToKg, type SexForEquation, type UnitSystem } from '@fitlens/core';

import { goBack } from '@/lib/nav';
import { useProfile, useUpsertProfile, type ProfileRow } from '@/features/profile/hooks';
import { errorMessage } from '@/lib/net';
import { Button, Card, DateField, Input, NumberField, PageHeader, Screen, Segmented, SkeletonCard, Text, space } from '@/ui';

export default function EditProfile() {
  const profile = useProfile();
  return (
    <Screen testID="edit-profile">
      <PageHeader title="Edit profile" backTo="/profile" />
      {profile.isLoading ? <SkeletonCard lines={6} /> : profile.data ? <EditForm key={profile.data.updated_at} p={profile.data} /> : <EditForm p={null} />}
      <Button label="Cancel" variant="ghost" onPress={() => goBack('/profile')} />
    </Screen>
  );
}

function EditForm({ p }: { p: ProfileRow | null }) {
  const upsert = useUpsertProfile();
  const startUnit = (p?.unit_system ?? 'metric') as UnitSystem;
  const startFtIn = p?.height_cm != null ? cmToFtIn(Number(p.height_cm)) : null;
  const [displayName, setDisplayName] = useState(p?.display_name ?? '');
  const [birthDate, setBirthDate] = useState(p?.birth_date ?? '');
  const [sex, setSex] = useState<SexForEquation>((p?.sex_for_equation as SexForEquation) ?? 'unspecified');
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(startUnit);
  const [heightCm, setHeightCm] = useState<number | null>(p?.height_cm == null ? null : Number(p.height_cm));
  const [heightFt, setHeightFt] = useState<number | null>(startFtIn?.ft ?? null);
  const [heightIn, setHeightIn] = useState<number | null>(startFtIn ? Math.round(startFtIn.in) : null);
  const [goalWeight, setGoalWeight] = useState<number | null>(
    p?.goal_weight_kg == null ? null : startUnit === 'imperial' ? Math.round(kgToLb(Number(p.goal_weight_kg)) * 10) / 10 : Number(p.goal_weight_kg),
  );
  const [typicalSteps, setTypicalSteps] = useState<number | null>(p?.typical_steps ?? null);
  const [mode, setMode] = useState<'standard' | 'tracking_only'>((p?.mode as 'standard' | 'tracking_only') ?? 'standard');
  const [pregnant, setPregnant] = useState(p?.tracking_only_reasons.includes('pregnant') ?? false);
  const [breastfeeding, setBreastfeeding] = useState(p?.tracking_only_reasons.includes('breastfeeding') ?? false);
  const [error, setError] = useState<string | null>(null);
  const under18 = p?.tracking_only_reasons.includes('under_18') ?? false;

  async function save() {
    setError(null);
    const cm = unitSystem === 'imperial' ? (heightFt == null ? null : ftInToCm(heightFt, heightIn ?? 0)) : heightCm;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      setError('Date of birth must be YYYY-MM-DD.');
      return;
    }
    const reasons = [under18 ? 'under_18' : null, pregnant ? 'pregnant' : null, breastfeeding ? 'breastfeeding' : null].filter((r): r is string => Boolean(r));
    const finalMode = reasons.length > 0 ? 'tracking_only' : mode;
    try {
      await upsert.mutateAsync({
        display_name: displayName.trim() || null,
        birth_date: birthDate,
        sex_for_equation: sex,
        unit_system: unitSystem,
        height_cm: cm == null ? null : Math.round(cm * 10) / 10,
        goal_weight_kg: goalWeight == null ? null : Math.round((unitSystem === 'imperial' ? lbToKg(goalWeight) : goalWeight) * 100) / 100,
        typical_steps: typicalSteps,
        mode: finalMode,
        tracking_only_reasons: reasons,
      });
      goBack('/profile');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <Card style={{ gap: space.lg }}>
        <Input label="Name" value={displayName} onChangeText={setDisplayName} />
        <DateField label="Date of birth" value={birthDate} onChange={setBirthDate} min="1900-01-01" max={new Date().toLocaleDateString('en-CA')} testID="birth-date" />
        <Segmented<SexForEquation>
          label="Sex for the metabolic equation"
          wrap
          value={sex}
          onChange={setSex}
          options={[
            { value: 'female', label: 'Female' },
            { value: 'male', label: 'Male' },
            { value: 'unspecified', label: 'Prefer not to say' },
          ]}
        />
        <Segmented<UnitSystem>
          label="Units"
          value={unitSystem}
          onChange={setUnitSystem}
          options={[
            { value: 'metric', label: 'Metric' },
            { value: 'imperial', label: 'Imperial' },
          ]}
        />
        {unitSystem === 'imperial' ? (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}>
              <NumberField label="Height (ft)" value={heightFt} onChangeNumber={setHeightFt} decimals={0} />
            </View>
            <View style={{ flex: 1 }}>
              <NumberField label="(in)" value={heightIn} onChangeNumber={setHeightIn} decimals={0} />
            </View>
          </View>
        ) : (
          <NumberField label="Height (cm)" value={heightCm} onChangeNumber={setHeightCm} decimals={0} />
        )}
        <NumberField label={`Goal weight (${unitSystem === 'imperial' ? 'lb' : 'kg'})`} value={goalWeight} onChangeNumber={setGoalWeight} />
        <NumberField label="Typical daily steps" value={typicalSteps} onChangeNumber={setTypicalSteps} decimals={0} />
      </Card>
      <Card style={{ gap: space.md }}>
        <Segmented<'yes' | 'no'>
          label="Pregnant"
          value={pregnant ? 'yes' : 'no'}
          onChange={(v) => setPregnant(v === 'yes')}
          options={[
            { value: 'no', label: 'No' },
            { value: 'yes', label: 'Yes' },
          ]}
        />
        <Segmented<'yes' | 'no'>
          label="Breastfeeding"
          value={breastfeeding ? 'yes' : 'no'}
          onChange={(v) => setBreastfeeding(v === 'yes')}
          options={[
            { value: 'no', label: 'No' },
            { value: 'yes', label: 'Yes' },
          ]}
        />
        {!pregnant && !breastfeeding && !under18 ? (
          <Segmented<'standard' | 'tracking_only'>
            label="Mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'standard', label: 'Standard' },
              { value: 'tracking_only', label: 'Tracking only' },
            ]}
          />
        ) : (
          <Text variant="caption" color="textMuted">
            Tracking-only mode is on because of the circumstances above.
          </Text>
        )}
      </Card>
      {error ? (
        <Text color="danger" variant="small">
          {error}
        </Text>
      ) : null}
      <Button label="Save" size="lg" onPress={() => void save()} loading={upsert.isPending} testID="save-profile" />
      <Text variant="caption" color="textFaint">
        Changing height, weight or mode does not change your targets by itself. Review them under Targets afterwards.
      </Text>
    </>
  );
}
