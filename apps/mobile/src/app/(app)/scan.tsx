import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { formatLocalDate, todayLocal } from '@fitlens/core';
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
import { reportError } from '@/lib/telemetry';
import { Button, Card, Icon, NotConfigured, PageHeader, Screen, Segmented, Skeleton, Text, radius, space, useTheme } from '@/ui';

type Stage = 'idle' | 'uploading' | 'analyzing' | 'clarify' | 'mapping' | 'failed';

export default function ScanScreen() {
  const { colors } = useTheme();
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
      if (!(err instanceof CaptureFailure) || err.reason === 'failed') reportError('scan.pick', err, { source });
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
      reportError('scan.upload', err);
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
      if (!(err instanceof AnalyzeError) || !['consent_required', 'rate_limited', 'not_configured'].includes(err.code)) reportError('scan.analyze', err);
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
      reportError('scan.map', err);
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
  const ready = consent && vision?.configured !== false;

  return (
    <Screen testID="scan-screen">
      <PageHeader title="Scan meal" subtitle={`${formatLocalDate(localDate, 'relative')}. One photo of the plate is enough; add a second angle or the label if it helps.`} backTo="/today" />

      {!features.isLoading && vision && !vision.configured ? <NotConfigured feature="Photo analysis" reason={vision.reason ?? 'Set VISION_PROVIDER, ANTHROPIC_API_KEY and VISION_MODEL on the edge functions.'} /> : null}
      {!prefs.isLoading && !consent ? (
        <Card tone="alt" style={{ gap: space.sm }}>
          <Text variant="bodyStrong">Photo analysis is off</Text>
          <Text variant="small" color="textMuted">
            You have not allowed photos to be sent to the AI provider. You can still attach photos to a meal and log it by hand.
          </Text>
          <Button label="Review consent" variant="secondary" size="sm" onPress={() => router.push('/profile/privacy')} />
        </Card>
      ) : null}

      {photos.length === 0 ? (
        <View style={[styles.frame, { borderColor: colors.border }]}>
          <View style={[styles.corner, styles.tl, { borderColor: colors.text }]} />
          <View style={[styles.corner, styles.tr, { borderColor: colors.text }]} />
          <View style={[styles.corner, styles.bl, { borderColor: colors.text }]} />
          <View style={[styles.corner, styles.br, { borderColor: colors.text }]} />
          <Icon name="camera" size={40} color={colors.textMuted} strokeWidth={1.4} />
          <Text variant="small" color="textMuted" align="center" style={{ maxWidth: 220 }}>
            Fill the frame with the plate in good light. Portions come out closer that way.
          </Text>
        </View>
      ) : (
        <View style={styles.photos}>
          {photos.map((p) => (
            <MealPhotoThumb key={p.storagePath} storagePath={p.storagePath} localUri={p.localUri} size={104} />
          ))}
        </View>
      )}

      {stage === 'clarify' && analysis ? (
        <Card style={{ gap: space.lg }} testID="clarify">
          <View style={{ gap: space.xs }}>
            <Text variant="heading">A few quick questions</Text>
            <Text variant="small" color="textMuted">
              Found: {analysis.result.items.map((i) => i.name).join(', ')}. Portions are approximate; everything is editable on the next screen.
            </Text>
          </View>
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
          <Text variant="bodyStrong">{stage === 'uploading' ? 'Uploading photo' : stage === 'analyzing' ? 'Identifying foods' : 'Matching to the food database'}</Text>
          <Skeleton />
          <Skeleton width="70%" />
        </Card>
      ) : null}

      {packaged.length > 0 ? (
        <Card tone="alt" style={{ gap: space.sm }}>
          <Text variant="bodyStrong">Packaged items</Text>
          {packaged.map((p) => (
            <Text key={p.name} variant="small" color="textMuted">
              {p.name}: {sentence(p.reason)} Use the values from the label or barcode rather than a visual guess.
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
      {(packaged.length > 0 || unmatched.length > 0) && stage === 'idle' ? <Button label="Continue to review" size="lg" onPress={() => router.replace('/meal/edit')} testID="review-continue" /> : null}

      {error ? (
        <Card tone="alt">
          <Text color="danger" variant="small">
            {error}
          </Text>
        </Card>
      ) : null}

      {stage === 'idle' || stage === 'failed' ? (
        <View style={{ gap: space.sm }}>
          {photos.length > 0 && ready ? (
            <Button label={`Identify foods (${photos.length} photo${photos.length === 1 ? '' : 's'})`} size="lg" onPress={() => void analyze()} testID="analyze" />
          ) : null}
          <View style={styles.row}>
            <Button label={photos.length ? 'Another photo' : 'Take photo'} size="lg" variant={photos.length > 0 && ready ? 'secondary' : 'primary'} style={{ flex: 1 }} onPress={() => void capture('camera')} testID="take-photo" />
            <Button label="From gallery" size="lg" variant="secondary" style={{ flex: 1 }} onPress={() => void capture('library')} testID="choose-photo" />
          </View>
          <Button label={photos.length ? 'Log this meal by hand instead' : 'Add food by hand instead'} variant="ghost" onPress={manualInstead} testID="manual-instead" />
        </View>
      ) : null}
    </Screen>
  );
}

/** Model reasons arrive without a final stop; one sentence per item reads better. */
function sentence(text: string): string {
  const t = text.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

const CORNER = 22;

const styles = StyleSheet.create({
  frame: {
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: space.xl,
  },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderWidth: 2 },
  tl: { top: 12, left: 12, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  tr: { top: 12, right: 12, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  bl: { bottom: 12, left: 12, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  br: { bottom: 12, right: 12, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  photos: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  row: { flexDirection: 'row', gap: space.sm },
});
