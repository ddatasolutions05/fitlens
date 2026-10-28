import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { reportError, track } from '@/lib/telemetry';
import { BrandMark, Button, Card, Chips, DateField, Input, Note, NumberField, Screen, Segmented, Stat, Text, radius, space, useTheme } from '@/ui';

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

// Four screens. Diet, allergies, steps and training details live in Profile.
const STEPS = [
  { key: 'about', title: 'About you', lead: 'Four answers, under a minute. Everything stays editable in Profile.' },
  { key: 'body', title: 'Your body', lead: 'Weight drives resting energy, protein and water targets.' },
  { key: 'goal', title: 'Goal and activity', lead: 'Decides the gap between what you burn and what you aim to eat.' },
  { key: 'numbers', title: 'Your numbers', lead: 'Calculated from your answers. Change any of it later under Targets.' },
] as const;


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
  const weightId = useRef(newIdempotencyKey());
  useEffect(() => {
    track('onboarding_started');
  }, []);

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
      case 0:
        return birthValid && a.sex != null;
      case 1:
        return heightCm != null && heightCm > 50 && kg != null && kg > 20;
      case 2:
        return a.activityLevel != null && (trackingOnly || a.goalType != null);
      default:
        return true;
    }
  })();
  const canFinish = plan != null && a.aiConsent != null;

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
      });
      await upsertPrefs.mutateAsync({
        diet_pattern: a.dietPattern,
        allergies: splitList(a.allergies),
        cuisines: a.cuisines,
        avoid_foods: splitList(a.avoidFoods),
        ai_photo_consent_at: a.aiConsent ? new Date().toISOString() : null,
        ai_consent_version: a.aiConsent ? config.aiConsentVersion : null,
      });
      await logWeight.mutateAsync({ id: weightId.current, kg: Math.round(kg * 100) / 100, measuredAt: new Date().toISOString(), localDate: today, tz, note: 'Entered during setup' });
      await addGoal.mutateAsync(plan.row);
      await upsertProfile.mutateAsync({ onboarding_completed_at: new Date().toISOString() });
      track('onboarding_finished', { tracking_only: trackingOnly, ai_consent: Boolean(a.aiConsent) });
      router.replace({ pathname: '/food/search', params: { fresh: '1', first: '1' } });
    } catch (err) {
      reportError('onboarding.save', err);
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const weightUnit = a.unitSystem === 'imperial' ? 'lb' : 'kg';
  const current = STEPS[step]!;
  const fg = colors.onInverse;

  return (
    <Screen testID={`onboarding-step-${step}`}>
      <View style={styles.progressWrap}>
        <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
          <View style={[styles.fill, { width: `${((step + 1) / STEPS.length) * 100}%`, backgroundColor: colors.text }]} />
        </View>
        <Text variant="label" color="textMuted">
          Step {step + 1} of {STEPS.length}
        </Text>
      </View>

      <View style={{ gap: space.xs }}>
        {step === 0 ? (
          <View style={{ marginBottom: space.sm }}>
            <BrandMark size={40} />
          </View>
        ) : null}
        <Text variant="title">{step === 0 ? `Welcome to ${config.brandName}` : current.title}</Text>
        <Text color="textMuted">{current.lead}</Text>
      </View>

      {step === 0 ? (
        <View style={styles.fields}>
          <Input label="What should we call you? (optional)" value={a.displayName} onChangeText={(v) => set('displayName', v)} placeholder="First name" />
          <DateField label="Date of birth" value={a.birthDate} onChange={(v) => set('birthDate', v)} min="1900-01-01" max={today} hint={age != null ? `That makes you ${age}.` : 'Opens a calendar; pick the year first.'} testID="birth-date" />
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
          <Note label="Why we ask">
            Age is part of the resting energy formula. Mifflin-St Jeor uses different constants by sex (+5 for male, -161 for female); prefer not to say averages both and adds about 80 kcal of uncertainty.
          </Note>
        
        </View>
      ) : null}

      {step === 1 ? (
        <View style={styles.fields}>
          <Segmented<UnitSystem>
            label="Units"
            value={a.unitSystem}
            onChange={(v) => set('unitSystem', v)}
            options={[
              { value: 'metric', label: 'Metric', hint: 'kg, cm' },
              { value: 'imperial', label: 'Imperial', hint: 'lb, ft and in' },
            ]}
          />
          {a.unitSystem === 'imperial' ? (
            <View style={styles.row}>
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
          <NumberField label={`Current weight (${weightUnit})`} value={a.weight} onChangeNumber={(v) => set('weight', v)} placeholder={a.unitSystem === 'imperial' ? '165' : '75'} testID="weight" hint="Logged as your first weigh-in." />
          <NumberField label={`Goal weight (${weightUnit}, optional)`} value={a.goalWeight} onChangeNumber={(v) => set('goalWeight', v)} />
          <Note label="Why we ask">Goal weight is used for protein when BMI is over 30 and to check the goal is safe.</Note>
        </View>
      ) : null}

      {step === 2 ? (
        <View style={styles.fields}>
          <Segmented<ActivityLevel>
            label="Typical activity level"
            wrap
            value={a.activityLevel}
            onChange={(v) => set('activityLevel', v)}
            options={(Object.keys(ACTIVITY_LEVEL_LABELS) as ActivityLevel[]).map((k) => ({ value: k, label: ACTIVITY_LEVEL_LABELS[k] }))}
          />
          {trackingOnly ? (
            <Card tone="alt" style={{ gap: space.xs }}>
              <Text variant="bodyStrong">Tracking-only mode</Text>
              <Text variant="small" color="textMuted">
                Because of what you told us, the app will track intake, nutrients, activity and weight without setting a deficit or a pace. Targets are best set with your care provider. You can change this later in Profile.
              </Text>
            </Card>
          ) : (
            <>
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
            </>
          )}
        
          <Chips
            label="Anything that applies (optional)"
            options={['Pregnant', 'Breastfeeding']}
            value={[a.pregnant ? 'Pregnant' : null, a.breastfeeding ? 'Breastfeeding' : null].filter((x): x is string => x != null)}
            onChange={(v) => {
              set('pregnant', v.includes('Pregnant'));
              set('breastfeeding', v.includes('Breastfeeding'));
            }}
          />
          {under18 || a.pregnant || a.breastfeeding ? (
            <Note>Tracking-only mode: intake, nutrients, activity and weight are tracked with no deficit or pace. Targets are best set with your care provider.</Note>
          ) : null}
          <Note label="Why we ask">Logged steps and workouts are shown but not added on top of the multiplier, so nothing is counted twice. Steps, training days and diet can be added later in Profile.</Note>
        </View>
      ) : null}

      {step === 3 ? (
        <View style={styles.fields}>
          <Card style={{ gap: space.sm }}>
            <Text variant="bodyStrong">Photo analysis and Coach</Text>
            <Text variant="small" color="textMuted">
              With your consent, Scan meal sends the photo you choose (resized, location removed) plus your diet pattern and allergies to the AI provider (Anthropic) to identify foods; the Coach sends a summary of your logs, never photos. Withdraw any time under Profile.
            </Text>
            <Segmented<'yes' | 'no'>
              value={a.aiConsent == null ? null : a.aiConsent ? 'yes' : 'no'}
              onChange={(v) => set('aiConsent', v === 'yes')}
              options={[
                { value: 'yes', label: 'Allow AI features' },
                { value: 'no', label: 'Not now' },
              ]}
            />
          </Card>
          {plan ? (
            <>
              <Card tone="inverse" style={{ gap: space.sm }}>
                <Text variant="label" style={{ color: fg, opacity: 0.6 }}>
                  Daily food target
                </Text>
                <Text variant="display" tabular style={{ color: fg, fontSize: 48, lineHeight: 52 }} testID="target-value">
                  {plan.targets.calorieTarget != null ? `${plan.targets.calorieTarget.toLocaleString()} kcal` : 'No calorie target'}
                </Text>
                <Text variant="small" style={{ color: fg }}>
                  {plan.targets.calorieTarget != null ? plan.targets.rationale : 'Tracking only: intake, nutrients, activity and weight, with no deficit or pace.'}
                </Text>
                <View style={[styles.plateLine, { borderTopColor: colors.inverseLine }]}>
                  <Text variant="small" style={{ color: fg }} tabular>
                    Protein {plan.targets.proteinG} g{plan.targets.carbsG != null ? `, carbs ${plan.targets.carbsG} g` : ''}
                    {plan.targets.fatG != null ? `, fat ${plan.targets.fatG} g` : ''}
                    {plan.targets.fibreG != null ? `, fibre ${plan.targets.fibreG} g` : ''}
                  </Text>
                  <Text variant="small" style={{ color: fg }} tabular>
                    Water {plan.targets.waterMl.toLocaleString()} ml, steps {plan.targets.stepGoal.toLocaleString()}
                  </Text>
                </View>
              </Card>
              <View style={styles.row}>
                <Stat label="Resting energy" value={`${Math.round(plan.ree.ree).toLocaleString()} kcal`} note="Mifflin-St Jeor" testID="ree-value" style={{ minWidth: 0 }} />
                <Stat label="Daily burn (TDEE)" value={`${plan.tdee.toLocaleString()} kcal`} note={`${ACTIVITY_LEVEL_LABELS[a.activityLevel ?? 'sedentary']} multiplier`} testID="tdee-value" style={{ minWidth: 0 }} />
              </View>
              <Note label="How it is built">
                {`Resting energy: ${plan.ree.formula}.${plan.ree.note ? ` ${plan.ree.note}` : ''} It commonly varies by about 10% between people. TDEE is what you burn; the target is what you aim to eat.`}
              </Note>
              {plan.targets.notes.length > 0 ? <Note>{plan.targets.notes.join(' ')}</Note> : null}
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
        </View>
      ) : null}

      <View style={styles.nav}>
        {step > 0 ? <Button label="Back" variant="ghost" onPress={() => setStep(step - 1)} style={{ flex: 1 }} /> : null}
        {step < STEPS.length - 1 ? (
          <Button
            label="Continue"
            size="lg"
            onPress={() => {
              track('onboarding_step', { step: STEPS[step + 1]?.key ?? '' });
              setStep(step + 1);
            }}
            disabled={!canContinue}
            style={{ flex: 2 }}
            testID="continue"
          />
        ) : (
          <Button label="Start tracking" size="lg" onPress={() => void finish()} disabled={!canFinish} loading={saving} style={{ flex: 2 }} testID="finish" />
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
  progressWrap: { gap: space.sm, marginTop: space.md },
  track: { height: 3, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%' },
  fields: { gap: space.lg },
  row: { flexDirection: 'row', gap: space.sm },
  plateLine: { borderTopWidth: 1, paddingTop: space.sm, marginTop: space.xs, gap: 2 },
  nav: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
});
