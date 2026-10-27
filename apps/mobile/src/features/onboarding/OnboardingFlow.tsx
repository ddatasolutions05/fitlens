import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  ACTIVITY_LEVEL_LABELS,
  PACE_DEFAULT,
  SURPLUS_DEFAULT,
  ageOn,
  deviceTimeZone,
  ftInToCm,
  lbToKg,
  todayLocal,
  type ActivityLevel,
  type GoalType,
  type SexForEquation,
  type UnitSystem,
} from '@fitlens/core';

import { useLogWeight } from '@/features/logs/hooks';
import { newIdempotencyKey } from '@/features/meals/model';
import { useAddGoalVersion, useUpsertPreferences, useUpsertProfile } from '@/features/profile/hooks';
import { planGoal } from '@/features/profile/targets';
import { config } from '@/lib/config';
import { errorMessage } from '@/lib/net';
import { Button, Card, Input, NumberField, Screen, Segmented, Text, radius, space, touch, useTheme } from '@/ui';

interface Answers {
  unitSystem: UnitSystem;
  displayName: string;
  birthDate: string;
  sex: SexForEquation | null;
  heightCm: number | null;
  heightFt: number | null;
  heightIn: number | null;
  weight: number | null;
  goalWeight: number | null;
  activityLevel: ActivityLevel | null;
  typicalSteps: number | null;
  trainingDays: number | null;
  trainingType: string;
  trainingMinutes: number | null;
  goalType: GoalType | null;
  pace: number;
  surplus: number;
  dietPattern: string | null;
  allergies: string;
  cuisines: string[];
  avoidFoods: string;
  pregnant: boolean;
  breastfeeding: boolean;
  aiConsent: boolean | null;
}

const STEPS = ['Welcome', 'About you', 'Body', 'Activity', 'Goal', 'Food', 'Circumstances', 'Photos and AI', 'Your numbers'] as const;

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

const initial: Answers = {
  unitSystem: 'metric',
  displayName: '',
  birthDate: '',
  sex: null,
  heightCm: null,
  heightFt: null,
  heightIn: null,
  weight: null,
  goalWeight: null,
  activityLevel: null,
  typicalSteps: null,
  trainingDays: null,
  trainingType: '',
  trainingMinutes: null,
  goalType: null,
  pace: PACE_DEFAULT,
  surplus: SURPLUS_DEFAULT,
  dietPattern: null,
  allergies: '',
  cuisines: [],
  avoidFoods: '',
  pregnant: false,
  breastfeeding: false,
  aiConsent: null,
};

function heightCmOf(a: Answers): number | null {
  if (a.unitSystem === 'imperial') return a.heightFt == null ? null : ftInToCm(a.heightFt, a.heightIn ?? 0);
  return a.heightCm;
}
function kgOf(v: number | null, unit: UnitSystem): number | null {
  if (v == null) return null;
  return unit === 'imperial' ? lbToKg(v) : v;
}

export function OnboardingFlow() {
  const { colors } = useTheme();
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Answers>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upsertProfile = useUpsertProfile();
  const upsertPrefs = useUpsertPreferences();
  const addGoal = useAddGoalVersion();
  const logWeight = useLogWeight();
  const tz = deviceTimeZone();
  const today = todayLocal(tz);

  const set = <K extends keyof Answers>(key: K, value: Answers[K]) => setA((prev) => ({ ...prev, [key]: value }));

  const birthValid = /^\d{4}-\d{2}-\d{2}$/.test(a.birthDate) && !Number.isNaN(Date.parse(a.birthDate)) && a.birthDate < today;
  const age = birthValid ? ageOn(a.birthDate, today) : null;
  const under18 = age != null && age < 18;
  const trackingOnly = under18 || a.pregnant || a.breastfeeding;
  const heightCm = heightCmOf(a);
  const kg = kgOf(a.weight, a.unitSystem);
  const goalKg = kgOf(a.goalWeight, a.unitSystem);

  const plan = useMemo(() => {
    if (!birthValid || !a.sex || heightCm == null || kg == null || !a.activityLevel) return null;
    return planGoal({
      localDate: today,
      birthDate: a.birthDate,
      sex: a.sex,
      heightCm,
      kg,
      goalKg,
      mode: trackingOnly ? 'tracking_only' : 'standard',
      goalType: a.goalType ?? 'maintenance',
      pace: a.pace,
      surplusKcal: a.surplus,
      activityMode: 'activity_level',
      activityLevel: a.activityLevel,
      typicalSteps: a.typicalSteps,
      stepGoalOverride: null,
    });
  }, [a, birthValid, heightCm, kg, goalKg, trackingOnly, today]);

  const canContinue = (() => {
    switch (step) {
      case 1:
        return birthValid && a.sex != null;
      case 2:
        return heightCm != null && heightCm > 50 && kg != null && kg > 20;
      case 3:
        return a.activityLevel != null;
      case 4:
        return trackingOnly || a.goalType != null;
      case 7:
        return a.aiConsent != null;
      default:
        return true;
    }
  })();

  async function finish() {
    if (!plan || kg == null || heightCm == null) return;
    setSaving(true);
    setError(null);
    try {
      const reasons = [under18 ? 'under_18' : null, a.pregnant ? 'pregnant' : null, a.breastfeeding ? 'breastfeeding' : null].filter((r): r is string => Boolean(r));
      await upsertProfile.mutateAsync({
        display_name: a.displayName.trim() || null,
        birth_date: a.birthDate,
        sex_for_equation: a.sex ?? 'unspecified',
        height_cm: Math.round(heightCm * 10) / 10,
        unit_system: a.unitSystem,
        timezone: tz,
        mode: trackingOnly ? 'tracking_only' : 'standard',
        tracking_only_reasons: reasons,
        goal_weight_kg: goalKg == null ? null : Math.round(goalKg * 100) / 100,
        typical_steps: a.typicalSteps,
        training_days_per_week: a.trainingDays,
        training_type: a.trainingType.trim() || null,
        training_minutes: a.trainingMinutes,
        onboarding_completed_at: new Date().toISOString(),
      });
      await upsertPrefs.mutateAsync({
        diet_pattern: a.dietPattern,
        allergies: splitList(a.allergies),
        cuisines: a.cuisines,
        avoid_foods: splitList(a.avoidFoods),
        ai_photo_consent_at: a.aiConsent ? new Date().toISOString() : null,
        ai_consent_version: a.aiConsent ? config.aiConsentVersion : null,
      });
      await logWeight.mutateAsync({ id: newIdempotencyKey(), kg: Math.round(kg * 100) / 100, measuredAt: new Date().toISOString(), localDate: today, tz, note: 'Entered during setup' });
      await addGoal.mutateAsync(plan.row);
      router.replace('/(tabs)/today');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const weightUnit = a.unitSystem === 'imperial' ? 'lb' : 'kg';

  return (
    <Screen testID={`onboarding-step-${step}`}>
      <View style={styles.progress}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i <= step ? colors.accent : colors.border }]} />
        ))}
      </View>
      <Text variant="caption" color="textMuted">
        Step {step + 1} of {STEPS.length}
      </Text>

      {step === 0 ? (
        <>
          <Text variant="title">Welcome to FitLens</Text>
          <Text color="textMuted">A few questions, under three minutes. Everything stays editable in Profile.</Text>
          <Card style={{ gap: space.lg }}>
            <Input label="What should we call you? (optional)" value={a.displayName} onChangeText={(v) => set('displayName', v)} placeholder="First name" />
            <Segmented<UnitSystem>
              label="Units"
              value={a.unitSystem}
              onChange={(v) => set('unitSystem', v)}
              options={[
                { value: 'metric', label: 'Metric', hint: 'kg, cm' },
                { value: 'imperial', label: 'Imperial', hint: 'lb, ft' },
              ]}
            />
          </Card>
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Text variant="title">About you</Text>
          <Card style={{ gap: space.lg }}>
            <Input label="Date of birth" value={a.birthDate} onChangeText={(v) => set('birthDate', v)} placeholder="YYYY-MM-DD" inputMode="numeric" hint="Why we ask: age is part of the resting energy formula." testID="birth-date" />
            {age != null ? (
              <Text variant="caption" color="textMuted">
                That makes you {age}.
              </Text>
            ) : null}
            <Segmented<SexForEquation>
              label="Sex for the metabolic equation"
              value={a.sex}
              onChange={(v) => set('sex', v)}
              options={[
                { value: 'female', label: 'Female' },
                { value: 'male', label: 'Male' },
                { value: 'unspecified', label: 'Prefer not to say' },
              ]}
              wrap
            />
            <Text variant="caption" color="textMuted">
              Why we ask: Mifflin-St Jeor uses different constants (+5 for male, -161 for female). &quot;Prefer not to say&quot; uses the average of both and adds about 80 kcal of uncertainty.
            </Text>
          </Card>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Text variant="title">Body</Text>
          <Card style={{ gap: space.lg }}>
            {a.unitSystem === 'imperial' ? (
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <View style={{ flex: 1 }}>
                  <NumberField label="Height (ft)" value={a.heightFt} onChangeNumber={(v) => set('heightFt', v)} decimals={0} />
                </View>
                <View style={{ flex: 1 }}>
                  <NumberField label="(in)" value={a.heightIn} onChangeNumber={(v) => set('heightIn', v)} decimals={0} />
                </View>
              </View>
            ) : (
              <NumberField label="Height (cm)" value={a.heightCm} onChangeNumber={(v) => set('heightCm', v)} decimals={0} placeholder="170" testID="height" />
            )}
            <NumberField label={`Current weight (${weightUnit})`} value={a.weight} onChangeNumber={(v) => set('weight', v)} placeholder={a.unitSystem === 'imperial' ? '165' : '75'} testID="weight" hint="Why we ask: weight drives resting energy, protein and water targets. Logged as your first weigh-in." />
            <NumberField label={`Goal weight (${weightUnit}, optional)`} value={a.goalWeight} onChangeNumber={(v) => set('goalWeight', v)} hint="Why we ask: used for protein when BMI is over 30 and to check the goal is safe." />
          </Card>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <Text variant="title">Activity</Text>
          <Card style={{ gap: space.lg }}>
            <Segmented<ActivityLevel>
              label="Typical activity level"
              wrap
              value={a.activityLevel}
              onChange={(v) => set('activityLevel', v)}
              options={(Object.keys(ACTIVITY_LEVEL_LABELS) as ActivityLevel[]).map((k) => ({ value: k, label: ACTIVITY_LEVEL_LABELS[k] }))}
            />
            <Text variant="caption" color="textMuted">
              Why we ask: the level sets the multiplier on resting energy. Logged steps and workouts are shown but not added on top, so nothing is counted twice.
            </Text>
            <NumberField label="Typical daily steps (optional)" value={a.typicalSteps} onChangeNumber={(v) => set('typicalSteps', v)} decimals={0} placeholder="6000" hint="Your step goal starts 1,000 above this." />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <NumberField label="Training days / week" value={a.trainingDays} onChangeNumber={(v) => set('trainingDays', v)} decimals={0} />
              </View>
              <View style={{ flex: 1 }}>
                <NumberField label="Minutes / session" value={a.trainingMinutes} onChangeNumber={(v) => set('trainingMinutes', v)} decimals={0} />
              </View>
            </View>
            <Input label="Training type (optional)" value={a.trainingType} onChangeText={(v) => set('trainingType', v)} placeholder="strength, running, yoga…" />
          </Card>
        </>
      ) : null}

      {step === 4 ? (
        <>
          <Text variant="title">Goal</Text>
          {trackingOnly ? (
            <Card tone="alt">
              <Text variant="bodyStrong">Tracking-only mode</Text>
              <Text variant="small" color="textMuted">
                Because of what you told us, FitLens will track intake, nutrients, activity and weight without setting a deficit or a pace. Targets are best set with your care provider. You can edit this later in Profile.
              </Text>
            </Card>
          ) : (
            <Card style={{ gap: space.lg }}>
              <Segmented<GoalType>
                label="What are you working toward?"
                wrap
                value={a.goalType}
                onChange={(v) => set('goalType', v)}
                options={[
                  { value: 'fat_loss', label: 'Fat loss' },
                  { value: 'maintenance', label: 'Maintain' },
                  { value: 'muscle_gain', label: 'Muscle gain' },
                ]}
              />
              {a.goalType === 'fat_loss' ? (
                <Segmented<string>
                  label="Pace (of body weight per week)"
                  wrap
                  value={String(a.pace)}
                  onChange={(v) => set('pace', Number(v))}
                  options={[
                    { value: '0.0025', label: '0.25%', hint: 'gentle' },
                    { value: '0.005', label: '0.5%', hint: 'default' },
                    { value: '0.0075', label: '0.75%' },
                    { value: '0.01', label: '1%', hint: 'brisk' },
                  ]}
                />
              ) : null}
              {a.goalType === 'muscle_gain' ? (
                <Segmented<string>
                  label="Daily surplus"
                  value={String(a.surplus)}
                  onChange={(v) => set('surplus', Number(v))}
                  options={[
                    { value: '150', label: '+150' },
                    { value: '250', label: '+250', hint: 'default' },
                    { value: '350', label: '+350' },
                  ]}
                />
              ) : null}
            </Card>
          )}
        </>
      ) : null}

      {step === 5 ? (
        <>
          <Text variant="title">Food</Text>
          <Card style={{ gap: space.lg }}>
            <Segmented<string> label="Diet pattern" wrap value={a.dietPattern} onChange={(v) => set('dietPattern', v)} options={DIETS} />
            <Input label="Allergies (comma separated)" value={a.allergies} onChangeText={(v) => set('allergies', v)} placeholder="peanuts, shellfish" hint="Why we ask: items that may contain these are flagged. A photo can never confirm an allergen is absent." />
            <View style={{ gap: space.sm }}>
              <Text variant="small" color="textMuted">
                Cuisines you eat most
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {CUISINES.map((c) => {
                  const on = a.cuisines.includes(c);
                  return (
                    <Pressable
                      key={c}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      onPress={() => set('cuisines', on ? a.cuisines.filter((x) => x !== c) : [...a.cuisines, c])}
                      style={[styles.chip, { backgroundColor: on ? colors.accent : colors.surface, borderColor: on ? colors.accent : colors.border }]}
                    >
                      <Text style={{ color: on ? colors.onAccent : colors.text }}>{c}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Input label="Foods to avoid (optional)" value={a.avoidFoods} onChangeText={(v) => set('avoidFoods', v)} placeholder="mushrooms, cilantro" />
          </Card>
        </>
      ) : null}

      {step === 6 ? (
        <>
          <Text variant="title">Circumstances</Text>
          <Text color="textMuted">These change the guidance. Any of them switches FitLens to tracking-only mode.</Text>
          <Card style={{ gap: space.md }}>
            {under18 ? (
              <Text variant="small" color="textMuted">
                You are under 18, so tracking-only mode is on.
              </Text>
            ) : null}
            <Segmented<'yes' | 'no'>
              label="Pregnant"
              value={a.pregnant ? 'yes' : 'no'}
              onChange={(v) => set('pregnant', v === 'yes')}
              options={[
                { value: 'no', label: 'No' },
                { value: 'yes', label: 'Yes' },
              ]}
            />
            <Segmented<'yes' | 'no'>
              label="Breastfeeding"
              value={a.breastfeeding ? 'yes' : 'no'}
              onChange={(v) => set('breastfeeding', v === 'yes')}
              options={[
                { value: 'no', label: 'No' },
                { value: 'yes', label: 'Yes' },
              ]}
            />
          </Card>
        </>
      ) : null}

      {step === 7 ? (
        <>
          <Text variant="title">Photos and AI</Text>
          <Card style={{ gap: space.md }}>
            <Text>Scan Meal sends your meal photo to an AI provider to identify foods and estimate portions.</Text>
            <Text variant="small" color="textMuted">
              What is sent: the photo you choose (resized, location data removed) and your diet pattern and allergies, so the suggestions fit. Where: Anthropic&apos;s API, the provider configured for this app. Retention: the photo is stored in your own private storage; the provider&apos;s data-use terms are summarised in Profile, Privacy. You can withdraw consent at any time, which turns photo analysis off. Everything else works without it.
            </Text>
            <Segmented<'yes' | 'no'>
              value={a.aiConsent == null ? null : a.aiConsent ? 'yes' : 'no'}
              onChange={(v) => set('aiConsent', v === 'yes')}
              options={[
                { value: 'yes', label: 'Allow photo analysis' },
                { value: 'no', label: 'Not now' },
              ]}
            />
          </Card>
        </>
      ) : null}

      {step === 8 ? (
        <>
          <Text variant="title">Your numbers</Text>
          {plan ? (
            <>
              <Card style={{ gap: space.sm }}>
                <Text variant="small" color="textMuted">
                  Resting energy (Mifflin-St Jeor)
                </Text>
                <Text variant="heading" tabular testID="ree-value">
                  {Math.round(plan.ree.ree).toLocaleString()} kcal
                </Text>
                <Text variant="small" color="textMuted">
                  {plan.ree.formula}
                </Text>
                {plan.ree.note ? (
                  <Text variant="caption" color="textFaint">
                    {plan.ree.note}
                  </Text>
                ) : null}
                <Text variant="caption" color="textFaint">
                  Individual resting energy commonly varies by about ±10%.
                </Text>
              </Card>
              <Card style={{ gap: space.sm }}>
                <Text variant="small" color="textMuted">
                  Estimated daily energy use (TDEE)
                </Text>
                <Text variant="heading" tabular testID="tdee-value">
                  {plan.tdee.toLocaleString()} kcal
                </Text>
                <Text variant="small" color="textMuted">
                  Resting energy × {ACTIVITY_LEVEL_LABELS[a.activityLevel ?? 'sedentary']} multiplier. This is what you burn, not what you should eat.
                </Text>
              </Card>
              <Card tone="accent" style={{ gap: space.sm }}>
                <Text variant="small" color="accent">
                  Daily food target
                </Text>
                <Text variant="title" tabular testID="target-value">
                  {plan.targets.calorieTarget != null ? `${plan.targets.calorieTarget.toLocaleString()} kcal` : 'No calorie target (tracking only)'}
                </Text>
                <Text variant="small">{plan.targets.rationale}</Text>
                <Text variant="small" color="textMuted">
                  Protein {plan.targets.proteinG} g{plan.targets.carbsG != null ? ` · Carbs ${plan.targets.carbsG} g` : ''}
                  {plan.targets.fatG != null ? ` · Fat ${plan.targets.fatG} g` : ''}
                  {plan.targets.fibreG != null ? ` · Fibre ${plan.targets.fibreG} g` : ''} · Water {plan.targets.waterMl} ml · Steps {plan.targets.stepGoal.toLocaleString()}
                </Text>
                {plan.targets.notes.map((n) => (
                  <Text key={n} variant="caption" color="textMuted">
                    {n}
                  </Text>
                ))}
              </Card>
            </>
          ) : (
            <Card tone="alt">
              <Text color="textMuted">Some answers are missing. Go back to fill in your birth date, sex, height, weight and activity level.</Text>
            </Card>
          )}
          {error ? (
            <Text color="danger" variant="small">
              {error}
            </Text>
          ) : null}
        </>
      ) : null}

      <View style={styles.nav}>
        {step > 0 ? <Button label="Back" variant="ghost" onPress={() => setStep(step - 1)} style={{ flex: 1 }} /> : null}
        {step < STEPS.length - 1 ? (
          <Button label="Continue" onPress={() => setStep(step + 1)} disabled={!canContinue} style={{ flex: 2 }} testID="continue" />
        ) : (
          <Button label="Start tracking" onPress={() => void finish()} disabled={!plan} loading={saving} style={{ flex: 2 }} testID="finish" />
        )}
      </View>
    </Screen>
  );
}

function splitList(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: 4, marginTop: space.lg },
  dot: { flex: 1, height: 4, borderRadius: 2 },
  nav: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  chip: { minHeight: touch.min, paddingHorizontal: space.md, justifyContent: 'center', borderRadius: radius.md, borderWidth: 1 },
});
