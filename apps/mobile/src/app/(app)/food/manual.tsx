import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { todayLocal } from '@fitlens/core';

import { useCreateUserFood } from '@/features/food/hooks';
import { addItem, ensureDraft, setDraft, updateItem } from '@/features/meals/draft-store';
import { newItem } from '@/features/meals/model';
import { errorMessage } from '@/lib/net';
import { Button, Card, Input, NumberField, Screen, Segmented, Text, space } from '@/ui';

type Basis = 'serving' | 'per100';

export default function ManualFood() {
  const params = useLocalSearchParams<{ date?: string; fresh?: string; replace?: string }>();
  const localDate = params.date ?? todayLocal();
  const create = useCreateUserFood();
  const [name, setName] = useState('');
  const [basis, setBasis] = useState<Basis>('serving');
  const [servingG, setServingG] = useState<number | null>(null);
  const [kcal, setKcal] = useState<number | null>(null);
  const [protein, setProtein] = useState<number | null>(null);
  const [carbs, setCarbs] = useState<number | null>(null);
  const [fat, setFat] = useState<number | null>(null);
  const [fibre, setFibre] = useState<number | null>(null);
  const [sodium, setSodium] = useState<number | null>(null);
  const [satFat, setSatFat] = useState<number | null>(null);
  const [save, setSave] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const factor = basis === 'per100' ? 1 : servingG && servingG > 0 ? 100 / servingG : null;
  const per100 = (v: number | null) => (v == null || factor == null ? null : Math.round(v * factor * 100) / 100);

  async function add() {
    setError(null);
    if (!name.trim()) {
      setError('Give the food a name.');
      return;
    }
    if (basis === 'serving' && (!servingG || servingG <= 0)) {
      setError('Enter the serving weight in grams.');
      return;
    }
    const p = { kcal: per100(kcal), protein_g: per100(protein), carbs_g: per100(carbs), fat_g: per100(fat), fibre_g: per100(fibre), sodium_mg: per100(sodium), sat_fat_g: per100(satFat) };
    try {
      let foodId: string | null = null;
      if (save) {
        const food = await create.mutateAsync({
          source: 'user',
          name: name.trim(),
          kcal: p.kcal,
          protein_g: p.protein_g,
          carbs_g: p.carbs_g,
          fat_g: p.fat_g,
          fibre_g: p.fibre_g,
          sodium_mg: p.sodium_mg,
          sat_fat_g: p.sat_fat_g,
          default_serving_g: basis === 'serving' ? servingG : 100,
        });
        foodId = food.id;
      }
      if (params.fresh === '1') setDraft(null);
      ensureDraft({ localDate, source: 'manual' });
      const item = newItem({
          foodId,
          name: name.trim(),
          grams: basis === 'serving' ? (servingG as number) : 100,
          servingLabel: basis === 'serving' ? '1 serving' : null,
          per100: p,
          provenance: 'user',
          sourceName: null,
        });
      if (params.replace) updateItem(params.replace, { ...item, localId: params.replace });
      else addItem(item);
      router.replace('/meal/edit');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Screen testID="manual-food">
      <View style={{ marginTop: space.md }}>
        <Text variant="title">Enter food manually</Text>
        <Text color="textMuted" variant="small">
          Leave a field empty when you do not know it. Unknown values are shown as unknown and never counted as zero.
        </Text>
      </View>
      <Card style={{ gap: space.lg }}>
        <Input label="Name" value={name} onChangeText={setName} placeholder="Protein bar, homemade sabzi…" autoFocus testID="manual-name" />
        <Segmented<Basis>
          label="Values are for"
          value={basis}
          onChange={setBasis}
          options={[
            { value: 'serving', label: 'One serving' },
            { value: 'per100', label: 'Per 100 g' },
          ]}
        />
        {basis === 'serving' ? <NumberField label="Serving weight (g)" value={servingG} onChangeNumber={setServingG} decimals={0} testID="manual-serving" /> : null}
        <NumberField label="Calories (kcal)" value={kcal} onChangeNumber={setKcal} decimals={0} testID="manual-kcal" />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <NumberField label="Protein (g)" value={protein} onChangeNumber={setProtein} testID="manual-protein" />
          </View>
          <View style={{ flex: 1 }}>
            <NumberField label="Carbs (g)" value={carbs} onChangeNumber={setCarbs} />
          </View>
          <View style={{ flex: 1 }}>
            <NumberField label="Fat (g)" value={fat} onChangeNumber={setFat} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <NumberField label="Fibre (g)" value={fibre} onChangeNumber={setFibre} />
          </View>
          <View style={{ flex: 1 }}>
            <NumberField label="Sodium (mg)" value={sodium} onChangeNumber={setSodium} decimals={0} />
          </View>
          <View style={{ flex: 1 }}>
            <NumberField label="Sat. fat (g)" value={satFat} onChangeNumber={setSatFat} />
          </View>
        </View>
        <Segmented<'yes' | 'no'>
          label="Save to my foods for next time"
          value={save ? 'yes' : 'no'}
          onChange={(v) => setSave(v === 'yes')}
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'Just this once' },
          ]}
        />
        {error ? (
          <Text color="danger" variant="small">
            {error}
          </Text>
        ) : null}
        <Button label="Add to meal" size="lg" onPress={() => void add()} loading={create.isPending} testID="manual-add" />
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      </Card>
    </Screen>
  );
}
