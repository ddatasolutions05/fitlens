import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { formatNutrient, scaleNutrients, type Per100 } from '@fitlens/core';

import { newItem, provenanceForSource, provenanceLabel, sourceNameFor, type DraftItem } from '@/features/meals/model';
import { Button, NumberField, Segmented, Text, radius, space, useTheme } from '@/ui';

import { useFoodServings, type FoodRow, type SearchFoodRow } from './hooks';

export interface PickedFood {
  id: string;
  name: string;
  brand: string | null;
  source: string;
  per100: Per100;
  default_serving_g: number | null;
  attribution: string | null;
  usual_grams: number | null;
}

export function pickedFromSearch(r: SearchFoodRow): PickedFood {
  return {
    id: r.id,
    name: r.name,
    brand: r.brand,
    source: r.source,
    per100: { kcal: n(r.kcal), protein_g: n(r.protein_g), carbs_g: n(r.carbs_g), fat_g: n(r.fat_g), fibre_g: n(r.fibre_g), sodium_mg: n(r.sodium_mg), sat_fat_g: n(r.sat_fat_g) },
    default_serving_g: n(r.default_serving_g),
    attribution: r.attribution,
    usual_grams: n(r.usual_grams),
  };
}

export function pickedFromFood(f: FoodRow, usualGrams: number | null = null): PickedFood {
  return {
    id: f.id,
    name: f.name,
    brand: f.brand,
    source: f.source,
    per100: { kcal: n(f.kcal), protein_g: n(f.protein_g), carbs_g: n(f.carbs_g), fat_g: n(f.fat_g), fibre_g: n(f.fibre_g), sodium_mg: n(f.sodium_mg), sat_fat_g: n(f.sat_fat_g) },
    default_serving_g: n(f.default_serving_g),
    attribution: f.attribution,
    usual_grams: usualGrams,
  };
}

function n(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : null;
}

const GRAM_PRESETS = [50, 100, 150, 200, 250];

export function draftItemFromPicked(food: PickedFood, grams: number, servingLabel: string | null): DraftItem {
  return newItem({
    foodId: food.id,
    name: food.brand ? `${food.name} (${food.brand})` : food.name,
    grams,
    servingLabel,
    per100: food.per100,
    provenance: provenanceForSource(food.source),
    sourceName: sourceNameFor(food.source),
    assumptions: [],
  });
}

/** Bottom sheet to choose a portion for a food before adding it to the draft. */
export function AddFoodSheet({ food, onAdd, onClose, busy }: { food: PickedFood | null; onAdd: (item: DraftItem) => void; onClose: () => void; busy?: boolean }) {
  const { colors } = useTheme();
  const servings = useFoodServings(food?.id ?? null);
  const initialGrams = food?.usual_grams ?? food?.default_serving_g ?? 100;
  const [grams, setGrams] = useState<number | null>(initialGrams);
  const [count, setCount] = useState(1);
  const [serving, setServing] = useState<string>('grams');

  const options = useMemo(() => {
    const list = [{ value: 'grams', label: 'grams' }];
    for (const s of servings.data ?? []) list.push({ value: s.id, label: `${s.label} (${Math.round(Number(s.grams))} g)` });
    return list;
  }, [servings.data]);

  const chosen = servings.data?.find((s) => s.id === serving) ?? null;
  const effectiveGrams = chosen ? Number(chosen.grams) * count : (grams ?? 0);
  const preview = food ? scaleNutrients(food.per100, effectiveGrams, 1) : null;

  if (!food) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
        <ScrollView contentContainerStyle={{ gap: space.md, padding: space.lg }} keyboardShouldPersistTaps="handled">
          <Text variant="heading">{food.name}</Text>
          <Text variant="caption" color="textMuted">
            {provenanceLabel(provenanceForSource(food.source), sourceNameFor(food.source))}
            {food.attribution ? ` · ${food.attribution}` : ''}
          </Text>
          {food.usual_grams ? (
            <Text variant="caption" color="accent">
              Your usual portion is about {Math.round(food.usual_grams)} g.
            </Text>
          ) : null}
          <Segmented<string> label="Portion" wrap value={serving} onChange={setServing} options={options} />
          {chosen ? (
            <Segmented<string>
              label="How many"
              value={String(count)}
              onChange={(v) => setCount(Number(v))}
              options={[0.5, 1, 1.5, 2, 3].map((c) => ({ value: String(c), label: String(c) }))}
            />
          ) : (
            <View style={{ gap: space.sm }}>
              <NumberField label="Grams" value={grams} onChangeNumber={setGrams} decimals={0} testID="portion-grams" />
              <Segmented<string>
                value={grams != null && GRAM_PRESETS.includes(grams) ? String(grams) : null}
                onChange={(v) => setGrams(Number(v))}
                options={GRAM_PRESETS.map((g) => ({ value: String(g), label: `${g} g` }))}
              />
            </View>
          )}
          {preview ? (
            <Text variant="small" color="textMuted" tabular>
              {Math.round(effectiveGrams)} g · {formatNutrient(preview.kcal, 'kcal')} · P {formatNutrient(preview.protein_g, 'g')} · C {formatNutrient(preview.carbs_g, 'g')} · F {formatNutrient(preview.fat_g, 'g')} · Fibre {formatNutrient(preview.fibre_g, 'g')}
            </Text>
          ) : null}
          <Button
            label="Add to meal"
            size="lg"
            disabled={effectiveGrams <= 0}
            loading={busy}
            onPress={() => onAdd(draftItemFromPicked(food, Math.round(effectiveGrams * 10) / 10, chosen ? `${count} × ${chosen.label}` : null))}
            testID="add-to-meal"
          />
          <Button label="Cancel" variant="ghost" onPress={onClose} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '85%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
});
