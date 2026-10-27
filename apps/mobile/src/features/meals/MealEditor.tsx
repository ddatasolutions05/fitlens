import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  CONFIDENCE_LABELS,
  formatNutrient,
  localDateTimeToIso,
  postMealFeedback,
  roundKcal,
  timeInZone,
  type Feedback,
} from '@fitlens/core';

import { useDay } from '@/features/day/hooks';
import { setSelectedDate } from '@/features/day/selected-date';
import { MealPhotoThumb } from '@/features/photo/MealPhotoThumb';
import { usePreferences, useProfile } from '@/features/profile/hooks';
import { config } from '@/lib/config';
import { errorMessage } from '@/lib/net';
import { Button, Card, Input, NumberField, Segmented, Text, radius, space, touch, useTheme } from '@/ui';

import { removeItem, setDraft, updateDraft, updateItem, useDraft } from './draft-store';
import { useDeleteMeal, useSaveMeal } from './hooks';
import { draftTotals, itemNutrients, provenanceLabel, type DraftItem, type MealType } from './model';

const FRACTIONS = [
  { value: '1', label: 'All' },
  { value: '0.75', label: '3/4' },
  { value: '0.5', label: '1/2' },
  { value: '0.25', label: '1/4' },
];

export function MealEditor({ mode }: { mode: 'new' | 'existing' }) {
  const { colors } = useTheme();
  const draft = useDraft();
  const save = useSaveMeal();
  const del = useDeleteMeal();
  const profile = useProfile();
  const prefs = usePreferences();
  const day = useDay(draft?.localDate ?? '1970-01-01');
  const [error, setError] = useState<string | null>(null);
  const [confirmedId, setConfirmedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [undoLeft, setUndoLeft] = useState(0);
  const undoTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const totals = useMemo(() => (draft ? draftTotals(draft.items) : null), [draft]);
  const hideNumbers = profile.data?.hide_numbers ?? false;

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearInterval(undoTimer.current);
    };
  }, []);

  if (!draft) {
    return (
      <Card tone="alt">
        <Text color="textMuted">No meal in progress.</Text>
        <Button label="Add food" variant="secondary" onPress={() => router.replace('/food/search')} />
      </Card>
    );
  }

  const allowed = (prefs.data?.allergies ?? []).map((a) => a.toLowerCase()).filter(Boolean);
  const allergenHits = draft.items.filter((it) => allowed.some((a) => it.name.toLowerCase().includes(a)));

  async function confirm() {
    if (!draft || draft.items.length === 0) return;
    setError(null);
    try {
      const result = await save.mutateAsync({ draft, status: 'confirmed' });
      const t = draftTotals(draft.items);
      const dayBeforeRaw = day.data?.totals?.totals ?? null;
      const previous = draft.mealId ? (day.data?.meals.find((m) => m.id === draft.mealId)?.meal_items ?? []) : [];
      const prevSum = (key: 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fibre_g' | 'sodium_mg' | 'sat_fat_g') =>
        previous.reduce<number | null>((acc, mi) => (mi[key] == null ? acc : (acc ?? 0) + Number(mi[key])), null);
      const dayBefore = dayBeforeRaw
        ? {
            kcal: subNullable(dayBeforeRaw.kcal, prevSum('kcal')),
            protein_g: subNullable(dayBeforeRaw.protein_g, prevSum('protein_g')),
            carbs_g: subNullable(dayBeforeRaw.carbs_g, prevSum('carbs_g')),
            fat_g: subNullable(dayBeforeRaw.fat_g, prevSum('fat_g')),
            fibre_g: subNullable(dayBeforeRaw.fibre_g, prevSum('fibre_g')),
            sodium_mg: subNullable(dayBeforeRaw.sodium_mg, prevSum('sodium_mg')),
            sat_fat_g: subNullable(dayBeforeRaw.sat_fat_g, prevSum('sat_fat_g')),
          }
        : null;
      const dayAfter = {
        kcal: addNullable(dayBefore?.kcal ?? null, t.totals.kcal),
        protein_g: addNullable(dayBefore?.protein_g ?? null, t.totals.protein_g),
        carbs_g: addNullable(dayBefore?.carbs_g ?? null, t.totals.carbs_g),
        fat_g: addNullable(dayBefore?.fat_g ?? null, t.totals.fat_g),
        fibre_g: addNullable(dayBefore?.fibre_g ?? null, t.totals.fibre_g),
        sodium_mg: addNullable(dayBefore?.sodium_mg ?? null, t.totals.sodium_mg),
        sat_fat_g: addNullable(dayBefore?.sat_fat_g ?? null, t.totals.sat_fat_g),
      };
      const goal = day.data?.goal ?? null;
      setFeedback(
        postMealFeedback({
          meal: t.totals,
          dayAfter,
          targets: { calorieTarget: goal?.calorie_target ?? null, proteinG: goal?.protein_g ?? 0, fibreG: goal?.fibre_g ?? null },
          preferences: { dietPattern: prefs.data?.diet_pattern ?? null, cuisines: prefs.data?.cuisines ?? [], allergies: prefs.data?.allergies ?? [] },
          hideNumbers,
          mealItemNames: draft.items.map((i) => i.name),
        }),
      );
      setConfirmedId(draft.mealId ?? (result.queued ? 'queued' : 'saved'));
      setSelectedDate(draft.localDate);
      setUndoLeft(draft.previouslyConfirmed ? 0 : Math.round(config.undoWindowMs / 1000));
      if (!draft.previouslyConfirmed) undoTimer.current = setInterval(() => {
        setUndoLeft((s) => {
          if (s <= 1 && undoTimer.current) {
            clearInterval(undoTimer.current);
            undoTimer.current = null;
          }
          return Math.max(0, s - 1);
        });
      }, 1000);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function undo() {
    if (!draft) return;
    if (undoTimer.current) clearInterval(undoTimer.current);
    setUndoLeft(0);
    try {
      // Re-saving as a draft keeps the photos and items but removes it from totals.
      await save.mutateAsync({ draft, status: 'draft' });
      setConfirmedId(null);
      setFeedback(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function saveDraft() {
    if (!draft) return;
    setError(null);
    try {
      await save.mutateAsync({ draft, status: 'draft' });
      setSelectedDate(draft.localDate);
      setDraft(null);
      router.dismissTo('/today');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove() {
    if (!draft) return;
    setError(null);
    try {
      if (draft.mealId) await del.mutateAsync({ mealId: draft.mealId, localDate: draft.localDate });
      setDraft(null);
      router.dismissTo('/today');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function finish() {
    setDraft(null);
    router.dismissTo('/today');
  }

  if (confirmedId) {
    return (
      <View style={{ gap: space.lg }} testID="meal-confirmed">
        <Card tone="accent" style={{ gap: space.sm }}>
          <Text variant="heading">Meal saved</Text>
          {!hideNumbers && totals ? (
            <Text tabular>
              {formatNutrient(roundKcal(totals.totals.kcal), 'kcal')} · P {formatNutrient(totals.totals.protein_g, 'g')} · C {formatNutrient(totals.totals.carbs_g, 'g')} · F {formatNutrient(totals.totals.fat_g, 'g')}
            </Text>
          ) : null}
          {confirmedId === 'queued' ? (
            <Text variant="caption" color="textMuted">
              You are offline. The meal is queued and will sync when you are back online.
            </Text>
          ) : null}
        </Card>
        {feedback ? (
          <Card style={{ gap: space.sm }}>
            <Text>{feedback.observation}</Text>
            <Text color="textMuted">{feedback.suggestion}</Text>
            {feedback.why ? <WhyLine why={feedback.why} /> : null}
          </Card>
        ) : null}
        {undoLeft > 0 ? <Button label={`Undo (${undoLeft})`} variant="ghost" onPress={() => void undo()} testID="undo" /> : null}
        <Button label="Done" size="lg" onPress={finish} testID="done" />
        <Button label="Save as reusable meal" variant="secondary" onPress={() => router.push('/meal/save-template')} />
      </View>
    );
  }

  return (
    <View style={{ gap: space.lg }} testID="meal-editor">
      {draft.photos.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          {draft.photos.map((p) => (
            <MealPhotoThumb key={p.storagePath} storagePath={p.storagePath} localUri={p.localUri} size={88} />
          ))}
        </View>
      ) : null}

      <Card style={{ gap: space.md }}>
        <Segmented<MealType>
          value={draft.mealType}
          onChange={(v) => updateDraft((d) => ({ ...d, mealType: v }))}
          options={[
            { value: 'breakfast', label: 'Breakfast' },
            { value: 'lunch', label: 'Lunch' },
            { value: 'dinner', label: 'Dinner' },
            { value: 'snack', label: 'Snack' },
          ]}
        />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Input
              label="Date"
              value={draft.localDate}
              onChangeText={(v) => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))) {
                  updateDraft((d) => ({ ...d, localDate: v, eatenAt: localDateTimeToIso(v, timeInZone(d.eatenAt, d.tz), d.tz) }));
                }
              }}
              placeholder="YYYY-MM-DD"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Input
              label="Time"
              value={timeInZone(draft.eatenAt, draft.tz)}
              onChangeText={(v) => {
                if (/^\d{2}:\d{2}$/.test(v)) updateDraft((d) => ({ ...d, eatenAt: localDateTimeToIso(d.localDate, v, d.tz) }));
              }}
              placeholder="HH:MM"
            />
          </View>
        </View>
        <Input label="Title (optional)" value={draft.title ?? ''} onChangeText={(v) => updateDraft((d) => ({ ...d, title: v || null }))} placeholder="e.g. Lunch at home" />
      </Card>

      <View style={{ gap: space.sm }}>
        {draft.items.map((item) => (
          <ItemRow key={item.localId} item={item} hideNumbers={hideNumbers} />
        ))}
        <Button label="Add another item" variant="secondary" onPress={() => router.push({ pathname: '/food/search', params: { date: draft.localDate } })} testID="add-item" />
      </View>

      {allergenHits.length > 0 ? (
        <Card tone="alt">
          <Text variant="small">
            {allergenHits.map((i) => i.name).join(', ')} may contain something on your allergy list. A photo or database entry cannot confirm an allergen is absent.
          </Text>
        </Card>
      ) : null}

      {totals ? (
        <Card style={{ gap: space.xs }} testID="meal-totals">
          <Text variant="small" color="textMuted">
            Meal total{draft.items.length === 0 ? ' (no items yet)' : ''}
          </Text>
          {hideNumbers ? (
            <Text tabular>
              Protein {formatNutrient(totals.totals.protein_g, 'g')} · Fibre {formatNutrient(totals.totals.fibre_g, 'g')}
            </Text>
          ) : (
            <>
              <Text variant="heading" tabular testID="meal-kcal">
                {formatNutrient(roundKcal(totals.totals.kcal), 'kcal')}
                {totals.kcalRange ? (
                  <Text variant="small" color="textMuted">
                    {' '}
                    ({roundKcal(totals.kcalRange[0])} to {roundKcal(totals.kcalRange[1])})
                  </Text>
                ) : null}
              </Text>
              <Text tabular color="textMuted">
                P {formatNutrient(totals.totals.protein_g, 'g')} · C {formatNutrient(totals.totals.carbs_g, 'g')} · F {formatNutrient(totals.totals.fat_g, 'g')} · Fibre {formatNutrient(totals.totals.fibre_g, 'g')}
              </Text>
              {totals.totals.sodium_mg != null || totals.totals.sat_fat_g != null ? (
                <Text variant="small" color="textFaint" tabular>
                  {totals.totals.sodium_mg != null ? `Sodium ${formatNutrient(totals.totals.sodium_mg, 'mg')}` : ''}
                  {totals.totals.sodium_mg != null && totals.totals.sat_fat_g != null ? ' · ' : ''}
                  {totals.totals.sat_fat_g != null ? `Sat. fat ${formatNutrient(totals.totals.sat_fat_g, 'g')}` : ''}
                </Text>
              ) : null}
            </>
          )}
          {Object.entries(totals.unknown).some(([, c]) => c > 0) ? (
            <Text variant="caption" color="textFaint">
              Unknown values are left out of the totals, not counted as zero.
            </Text>
          ) : null}
        </Card>
      ) : null}

      {error ? (
        <Text color="danger" variant="small">
          {error}
        </Text>
      ) : null}

      <Button label={mode === 'existing' && draft.mealId ? 'Save changes' : 'Confirm meal'} size="lg" onPress={() => void confirm()} loading={save.isPending} disabled={draft.items.length === 0 || save.isPending} testID="confirm-meal" />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button label="Keep as draft" variant="ghost" style={{ flex: 1 }} onPress={() => void saveDraft()} disabled={save.isPending} testID="save-draft" />
        <Button label={draft.mealId ? 'Delete meal' : 'Discard'} variant="ghost" style={{ flex: 1 }} onPress={() => void remove()} disabled={del.isPending} testID="delete-meal" />
      </View>
      <Text variant="caption" style={{ color: colors.textFaint }}>
        Drafts never count toward daily totals until confirmed.
      </Text>
    </View>
  );
}

function ItemRow({ item, hideNumbers }: { item: DraftItem; hideNumbers: boolean }) {
  const { colors } = useTheme();
  const { nutrients, kcalRange } = itemNutrients(item);
  const [open, setOpen] = useState(false);
  return (
    <Card style={{ gap: space.sm }} testID={`item-${item.localId}`}>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityLabel={`${item.name}, ${open ? 'collapse' : 'edit'}`} style={styles.itemHead}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong">{item.name}</Text>
          <Text variant="caption" color="textMuted">
            {item.servingLabel ? `${item.servingLabel} · ` : ''}
            {Math.round(item.grams)} g{item.fractionEaten < 1 ? ` · ate ${Math.round(item.fractionEaten * 100)}%` : ''}
          </Text>
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', alignItems: 'center' }}>
            <View style={[styles.badge, { backgroundColor: item.provenance === 'ai_estimate' ? colors.surfaceAlt : colors.accentSoft }]}>
              <Text variant="caption" color={item.provenance === 'ai_estimate' ? 'textMuted' : 'accent'}>
                {provenanceLabel(item.provenance, item.sourceName)}
              </Text>
            </View>
            {item.confidence ? (
              <Text variant="caption" color="textFaint">
                Confidence: {CONFIDENCE_LABELS[item.confidence]}
              </Text>
            ) : null}
          </View>
        </View>
        {!hideNumbers ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="bodyStrong" tabular>
              {formatNutrient(roundKcal(nutrients.kcal), 'kcal')}
            </Text>
            {kcalRange ? (
              <Text variant="caption" color="textFaint" tabular>
                {roundKcal(kcalRange[0])} to {roundKcal(kcalRange[1])}
              </Text>
            ) : null}
            <Text variant="caption" color="textMuted" tabular>
              P {formatNutrient(nutrients.protein_g, 'g')}
            </Text>
          </View>
        ) : null}
      </Pressable>
      {open ? (
        <View style={{ gap: space.md }}>
          <NumberField label="Grams" value={item.grams} onChangeNumber={(g) => updateItem(item.localId, { grams: g ?? 0, servingLabel: null, gramsRange: null })} decimals={0} testID={`grams-${item.localId}`} />
          <Segmented<string> label="Fraction eaten" value={String(item.fractionEaten)} onChange={(v) => updateItem(item.localId, { fractionEaten: Number(v) })} options={FRACTIONS} />
          {item.assumptions.length > 0 ? (
            <View style={{ gap: 2 }}>
              <Text variant="caption" color="textMuted">
                Assumptions
              </Text>
              {item.assumptions.map((a) => (
                <Text key={a} variant="caption" color="textFaint">
                  • {a}
                </Text>
              ))}
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label="Change food" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/food/search', params: { replace: item.localId } })} />
            <Button label="Remove" variant="ghost" size="sm" style={{ flex: 1 }} onPress={() => removeItem(item.localId)} testID={`remove-${item.localId}`} />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

function WhyLine({ why }: { why: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" style={{ minHeight: touch.min, justifyContent: 'center' }}>
      <Text variant="caption" color="accent">
        {open ? 'Hide why' : 'Why?'}
      </Text>
      {open ? (
        <Text variant="small" color="textMuted">
          {why}
        </Text>
      ) : null}
    </Pressable>
  );
}

function addNullable(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  return (a ?? 0) + (b ?? 0);
}

function subNullable(a: number | null, b: number | null): number | null {
  if (a == null) return null;
  return a - (b ?? 0);
}

const styles = StyleSheet.create({
  itemHead: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', minHeight: touch.min },
  badge: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill },
});
