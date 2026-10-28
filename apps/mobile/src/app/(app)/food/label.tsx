import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { formatNutrient, todayLocal, type Per100 } from '@fitlens/core';
import { functionErrorSchema, readLabelResultSchema, type LabelRead } from '@fitlens/schemas';

import { useUserId } from '@/features/auth/session';
import { saveMeal } from '@/features/meals/api';
import { addItem, addPhoto, ensureDraft, getDraft, updateDraft } from '@/features/meals/draft-store';
import { newItem } from '@/features/meals/model';
import { CaptureFailure, pickPhoto, uploadPhoto } from '@/features/photo/capture';
import { MealPhotoThumb } from '@/features/photo/MealPhotoThumb';
import { usePreferences } from '@/features/profile/hooks';
import { errorMessage } from '@/lib/net';
import { supabase } from '@/lib/supabase';
import { reportError, track } from '@/lib/telemetry';
import { Button, Card, Note, NumberField, PageHeader, Screen, Skeleton, Text, space } from '@/ui';

async function readLabel(storagePath: string, mealId: string) {
  const { data, error } = await supabase.functions.invoke('read-label', { method: 'POST', body: { storage_path: storagePath, meal_id: mealId } });
  if (error) {
    let body: unknown = data;
    if (body == null && 'context' in error && error.context instanceof Response) body = await error.context.json().catch(() => null);
    const parsed = functionErrorSchema.safeParse(body);
    throw new Error(parsed.success ? parsed.data.error.message : error.message);
  }
  return readLabelResultSchema.parse(data);
}

export default function LabelScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const localDate = params.date ?? todayLocal();
  const userId = useUserId();
  const prefs = usePreferences();
  const [stage, setStage] = useState<'idle' | 'uploading' | 'reading' | 'read'>('idle');
  const [photo, setPhoto] = useState<{ storagePath: string; localUri: string } | null>(null);
  const [label, setLabel] = useState<LabelRead | null>(null);
  const [servings, setServings] = useState<number | null>(1);
  const [servingG, setServingG] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const consent = Boolean(prefs.data?.ai_photo_consent_at);

  async function capture(source: 'camera' | 'library') {
    setError(null);
    let picked;
    try {
      picked = await pickPhoto(source);
    } catch (err) {
      if (err instanceof CaptureFailure && err.reason === 'cancelled') return;
      setError(err instanceof CaptureFailure ? `Could not open the image: ${err.message}` : errorMessage(err));
      return;
    }
    setStage('uploading');
    try {
      ensureDraft({ localDate, source: 'photo' });
      const draft = getDraft()!;
      let mealId = draft.mealId;
      if (!mealId) {
        const row = await saveMeal({ userId, draft, status: 'draft' });
        mealId = row.id;
        updateDraft((d) => ({ ...d, mealId: row.id }));
      }
      const uploaded = await uploadPhoto(userId, mealId, picked);
      addPhoto({ storagePath: uploaded.storagePath, width: uploaded.width, height: uploaded.height, bytes: uploaded.bytes, localUri: picked.uri });
      setPhoto({ storagePath: uploaded.storagePath, localUri: picked.uri });
      setStage('reading');
      const res = await readLabel(uploaded.storagePath, mealId);
      setLabel(res.result);
      setServingG(res.result.serving_size_g);
      setStage('read');
      track('label_read');
    } catch (err) {
      reportError('label.read', err);
      setStage(photo ? 'read' : 'idle');
      setError(errorMessage(err));
    }
  }

  async function add() {
    if (!label || !servings || servings <= 0) return;
    const grams = servingG && servingG > 0 ? servingG : null;
    const basis = grams ?? 100;
    const scale = 100 / basis;
    const n = (v: number | null) => (v == null ? null : Math.round(v * scale * 10) / 10);
    const per100: Per100 = { kcal: n(label.per_serving.kcal), protein_g: n(label.per_serving.protein_g), carbs_g: n(label.per_serving.carbs_g), fat_g: n(label.per_serving.fat_g), fibre_g: n(label.per_serving.fibre_g), sodium_mg: n(label.per_serving.sodium_mg), sat_fat_g: n(label.per_serving.sat_fat_g) };
    const name = [label.product_name, label.brand].filter(Boolean).join(' ') || 'Labelled product';
    setAdding(true);
    setError(null);
    try {
      const { data: food, error: fErr } = await supabase
        .from('foods')
        .insert({ owner_user_id: userId, source: 'label', name, kcal: per100.kcal, protein_g: per100.protein_g, carbs_g: per100.carbs_g, fat_g: per100.fat_g, fibre_g: per100.fibre_g, sodium_mg: per100.sodium_mg, sat_fat_g: per100.sat_fat_g, default_serving_g: grams, attribution: 'Read from the label photo' })
        .select('id')
        .single();
      if (fErr) throw fErr;
      addItem(
        newItem({
          foodId: food.id,
          name,
          grams: Math.round(basis * servings),
          servingLabel: grams ? `${servings} × ${label.serving_size_text ?? `${Math.round(grams)} g`}` : `${servings} serving${servings === 1 ? '' : 's'}`,
          per100,
          provenance: 'label',
          sourceName: 'Label photo',
          confidence: label.confidence,
          assumptions: grams ? [] : ['Serving weight was not printed; one serving is counted as 100 g. Change the grams if you know them.'],
        }),
      );
      track('label_added');
      router.replace('/meal/edit');
    } catch (err) {
      reportError('label.add', err);
      setError(errorMessage(err));
    } finally {
      setAdding(false);
    }
  }

  return (
    <Screen testID="label-screen">
      <PageHeader title="Read a label" subtitle="Photograph the nutrition facts panel. The values are read as printed, then you say how many servings." backTo="/food/search" />
      {!prefs.isLoading && !consent ? (
        <Card tone="alt" style={{ gap: space.sm }}>
          <Text variant="bodyStrong">AI features are off</Text>
          <Text variant="small" color="textMuted">
            Reading a label sends the photo to the AI provider. Allow it under Profile, Diet and AI consent.
          </Text>
          <Button label="Review consent" variant="secondary" size="sm" onPress={() => router.push('/profile/privacy')} />
        </Card>
      ) : null}
      {photo ? <MealPhotoThumb storagePath={photo.storagePath} localUri={photo.localUri} size={104} /> : null}
      {stage === 'uploading' || stage === 'reading' ? (
        <Card style={{ gap: space.sm }}>
          <Text variant="bodyStrong">{stage === 'uploading' ? 'Uploading photo' : 'Reading the panel'}</Text>
          <Skeleton />
        </Card>
      ) : null}
      {label && stage === 'read' ? (
        <Card style={{ gap: space.md }} testID="label-result">
          <View style={{ gap: 2 }}>
            <Text variant="heading">{[label.product_name, label.brand].filter(Boolean).join(', ') || 'Labelled product'}</Text>
            <Text variant="small" color="textMuted">
              Per serving{label.serving_size_text ? ` (${label.serving_size_text})` : ''}: {formatNutrient(label.per_serving.kcal, 'kcal')}, P {formatNutrient(label.per_serving.protein_g, 'g')}, C {formatNutrient(label.per_serving.carbs_g, 'g')}, F {formatNutrient(label.per_serving.fat_g, 'g')}.
            </Text>
            {label.notes.length > 0 ? (
              <Text variant="caption" color="textFaint">
                {label.notes.join(' ')}
              </Text>
            ) : null}
          </View>
          <NumberField label="Serving weight (g or ml)" value={servingG} onChangeNumber={setServingG} decimals={0} hint={label.serving_size_g ? 'Read from the label.' : 'Not printed; type it if the pack says.'} testID="label-serving-g" />
          <NumberField label="Servings eaten" value={servings} onChangeNumber={setServings} decimals={1} testID="label-servings" />
          <Button label="Add to meal" size="lg" onPress={() => void add()} loading={adding} disabled={!servings} testID="label-add" />
        </Card>
      ) : null}
      {error ? (
        <Text color="danger" variant="small" testID="label-error">
          {error}
        </Text>
      ) : null}
      {stage === 'idle' || stage === 'read' ? (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label={label ? 'Another label' : 'Take photo'} size="lg" variant={label ? 'secondary' : 'primary'} style={{ flex: 1 }} onPress={() => void capture('camera')} disabled={!consent} testID="label-camera" />
          <Button label="From gallery" size="lg" variant="secondary" style={{ flex: 1 }} onPress={() => void capture('library')} disabled={!consent} testID="label-gallery" />
        </View>
      ) : null}
      <Note>Labels print values per serving as sold. Check the serving weight if the pack states it in millilitres or pieces.</Note>
    </Screen>
  );
}
