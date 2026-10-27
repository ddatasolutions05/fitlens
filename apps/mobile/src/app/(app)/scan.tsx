import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { todayLocal } from '@fitlens/core';
import type { AnalyzeMealResult, ClarifyingQuestion } from '@fitlens/schemas';

import { useUserId } from '@/features/auth/session';
import { addPhoto, ensureDraft, getDraft, setDraft, updateDraft } from '@/features/meals/draft-store';
import { saveMeal } from '@/features/meals/api';
import { AnalyzeError, analyzeMeal, mapAnalysisToItems, questionsFor, type Answer } from '@/features/photo/analyze';
import { CaptureFailure, pickPhoto, uploadPhoto } from '@/features/photo/capture';
import { MealPhotoThumb } from '@/features/photo/MealPhotoThumb';
import { usePreferences } from '@/features/profile/hooks';
import { useFeatures } from '@/features/sync/useFeatures';
import { errorMessage } from '@/lib/net';
import { Button, Card, NotConfigured, Screen, Segmented, Skeleton, Text, space } from '@/ui';

type Stage = 'idle' | 'uploading' | 'analyzing' | 'clarify' | 'mapping' | 'failed';

export default function ScanScreen() {
  const params = useLocalSearchParams<{ date?: string; fresh?: string }>();
  const localDate = params.date ?? todayLocal();
  const userId = useUserId();
  useEffect(() => {
    if (params.fresh === '1') setDraft(null);
  }, [params.fresh]);
  const prefs = usePreferences();
  const features = useFeatures();
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<{ storagePath: string; localUri: string }[]>([]);
  const [analysis, setAnalysis] = useState<AnalyzeMealResult | null>(null);
  const [questions, setQuestions] = useState<ClarifyingQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [packaged, setPackaged] = useState<{ name: string; reason: string }[]>([]);
  const [unmatched, setUnmatched] = useState<string[]>([]);

  const consent = Boolean(prefs.data?.ai_photo_consent_at);
  const vision = features.data?.vision ?? null;

  async function capture(source: 'camera' | 'library') {
    setError(null);
    let picked;
    try {
      picked = await pickPhoto(source);
    } catch (err) {
      if (err instanceof CaptureFailure) {
        if (err.reason === 'cancelled') return;
        setError(
          err.reason === 'permission_denied'
            ? 'Camera or photo access was denied. Allow it in your device settings, or add the meal manually.'
            : err.reason === 'unsupported'
              ? 'That file type is not supported. Use a JPEG, PNG or HEIC photo.'
              : `Could not open the image: ${err.message}`,
        );
      } else setError(errorMessage(err));
      return;
    }
    setStage('uploading');
    try {
      const draft = ensureDraft({ localDate, source: 'photo' });
      let mealId = draft.mealId;
      if (!mealId) {
        const row = await saveMeal({ userId, draft, status: 'draft' });
        mealId = row.id;
        updateDraft((d) => ({ ...d, mealId: row.id }));
      }
      const uploaded = await uploadPhoto(userId, mealId, picked);
      addPhoto({ storagePath: uploaded.storagePath, width: uploaded.width, height: uploaded.height, bytes: uploaded.bytes, localUri: picked.uri });
      await saveMeal({ userId, draft: getDraft()!, status: 'draft' });
      setPhotos((p) => [...p, { storagePath: uploaded.storagePath, localUri: picked.uri }]);
      setStage('idle');
    } catch (err) {
      setStage('failed');
      setError(`Upload failed: ${errorMessage(err)}. The photo was not saved.`);
    }
  }

  async function analyze() {
    const draft = getDraft();
    if (!draft?.mealId || photos.length === 0) return;
    setStage('analyzing');
    setError(null);
    try {
      const result = await analyzeMeal({ meal_id: draft.mealId, storage_paths: photos.map((p) => p.storagePath) });
      setAnalysis(result);
      const qs = questionsFor(result);
      setQuestions(qs);
      setPackaged(result.result.packaged_items);
      if (qs.length > 0) setStage('clarify');
      else await finishMapping(result, []);
    } catch (err) {
      setStage('failed');
      if (err instanceof AnalyzeError) {
        setError(
          err.code === 'consent_required'
            ? 'Photo analysis needs your consent. Turn it on under Profile, Diet and AI consent.'
            : err.code === 'rate_limited'
              ? 'You have reached the daily limit for photo analyses. Add this meal manually; the photo stays attached.'
              : err.code === 'not_configured'
                ? 'Photo analysis is not configured on the server. Add the meal manually.'
                : `Analysis failed (${err.code}): ${err.message}. The photo stays attached to the draft.`,
        );
      } else setError(`Analysis failed: ${errorMessage(err)}. The photo stays attached to the draft.`);
    }
  }

  async function finishMapping(result: AnalyzeMealResult, given: Answer[]) {
    setStage('mapping');
    try {
      const mapped = await mapAnalysisToItems(result, given, userId);
      updateDraft((d) => ({ ...d, items: [...d.items, ...mapped.items] }));
      setUnmatched(mapped.unmatched);
      setPackaged(mapped.packaged);
      if (mapped.packaged.length === 0 && mapped.unmatched.length === 0) {
        router.replace('/meal/edit');
        return;
      }
      setStage('idle');
      setAnalysis(null);
      setQuestions([]);
    } catch (err) {
      setStage('failed');
      setError(`Could not build the estimate: ${errorMessage(err)}.`);
    }
  }

  function submitAnswers() {
    if (!analysis) return;
    const given: Answer[] = questions.map((q, i) => ({ question: q, answer: answers[i] ?? q.quick_options[0] ?? '' })).filter((a) => a.answer);
    void finishMapping(analysis, given);
  }

  function manualInstead() {
    const d = getDraft();
    if (d && (d.items.length > 0 || d.photos.length > 0)) router.replace('/meal/edit');
    else {
      setDraft(null);
      router.replace({ pathname: '/food/search', params: { date: localDate } });
    }
  }

  const busy = stage === 'uploading' || stage === 'analyzing' || stage === 'mapping';

  return (
    <Screen testID="scan-screen">
      <View style={{ marginTop: space.md, gap: space.xs }}>
        <Text variant="title">Scan meal</Text>
        <Text color="textMuted" variant="small">
          {localDate} · Take a photo of the plate. Add a second angle or the nutrition label to the same meal if it helps.
        </Text>
      </View>

      {!features.isLoading && vision && !vision.configured ? <NotConfigured feature="Photo analysis" reason={vision.reason ?? 'Set VISION_PROVIDER, ANTHROPIC_API_KEY and VISION_MODEL on the edge functions.'} /> : null}
      {!prefs.isLoading && !consent ? (
        <Card tone="alt" style={{ gap: space.sm }}>
          <Text variant="bodyStrong">Photo analysis is off</Text>
          <Text variant="small" color="textMuted">
            You have not allowed photos to be sent to the AI provider. You can still attach photos to a meal and log it manually.
          </Text>
          <Button label="Review consent" variant="secondary" size="sm" onPress={() => router.push('/profile/privacy')} />
        </Card>
      ) : null}

      {photos.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          {photos.map((p) => (
            <MealPhotoThumb key={p.storagePath} storagePath={p.storagePath} localUri={p.localUri} size={96} />
          ))}
        </View>
      ) : null}

      {stage === 'clarify' && analysis ? (
        <Card style={{ gap: space.lg }} testID="clarify">
          <Text variant="heading">A few quick questions</Text>
          <Text variant="small" color="textMuted">
            Found: {analysis.result.items.map((i) => i.name).join(', ')}. Portions are approximate; you can edit everything on the next screen.
          </Text>
          {questions.map((q, i) => (
            <Segmented<string>
              key={`${q.item_ref}-${i}`}
              label={`${q.item_ref}: ${q.question}`}
              wrap
              value={answers[i] ?? null}
              onChange={(v) => setAnswers((a) => ({ ...a, [i]: v }))}
              options={q.quick_options.map((o) => ({ value: o, label: o }))}
            />
          ))}
          <Button label="Continue" size="lg" onPress={submitAnswers} testID="clarify-continue" />
          <Button label="Skip questions" variant="ghost" onPress={() => analysis && void finishMapping(analysis, [])} />
        </Card>
      ) : null}

      {busy ? (
        <Card style={{ gap: space.md }}>
          <Text variant="bodyStrong">{stage === 'uploading' ? 'Uploading photo…' : stage === 'analyzing' ? 'Identifying foods…' : 'Matching to the food database…'}</Text>
          <Skeleton />
          <Skeleton width="70%" />
        </Card>
      ) : null}

      {packaged.length > 0 ? (
        <Card tone="alt" style={{ gap: space.sm }}>
          <Text variant="bodyStrong">Packaged items</Text>
          {packaged.map((p) => (
            <Text key={p.name} variant="small" color="textMuted">
              {p.name}: {p.reason} Use the values from the label or barcode rather than a visual guess.
            </Text>
          ))}
          <Button label="Enter from the label" variant="secondary" size="sm" onPress={() => router.push({ pathname: '/food/manual', params: { date: localDate } })} testID="packaged-manual" />
        </Card>
      ) : null}
      {unmatched.length > 0 ? (
        <Card tone="alt">
          <Text variant="small" color="textMuted">
            No database match and no estimate for: {unmatched.join(', ')}. Add them with search or manual entry.
          </Text>
        </Card>
      ) : null}
      {(packaged.length > 0 || unmatched.length > 0) && stage === 'idle' ? <Button label="Continue to review" size="lg" onPress={() => router.replace('/meal/edit')} /> : null}

      {error ? (
        <Card tone="alt">
          <Text color="danger" variant="small">
            {error}
          </Text>
        </Card>
      ) : null}

      {stage === 'idle' || stage === 'failed' ? (
        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label={photos.length ? 'Another photo' : 'Take photo'} style={{ flex: 1 }} onPress={() => void capture('camera')} testID="take-photo" />
            <Button label="Choose from gallery" variant="secondary" style={{ flex: 1 }} onPress={() => void capture('library')} testID="choose-photo" />
          </View>
          {photos.length > 0 && consent && vision?.configured !== false ? (
            <Button label={`Identify foods (${photos.length} photo${photos.length === 1 ? '' : 's'})`} size="lg" onPress={() => void analyze()} testID="analyze" />
          ) : null}
          <Button label={photos.length ? 'Log this meal manually' : 'Add food manually instead'} variant="ghost" onPress={manualInstead} testID="manual-instead" />
        </View>
      ) : null}

      <Button label="Close" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
