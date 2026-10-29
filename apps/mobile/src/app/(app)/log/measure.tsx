import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { deviceTimeZone, formatLocalDate, localDateTimeToIso, timeInZone, todayLocal, type UnitSystem } from '@fitlens/core';

import { useLogMeasurement, useMeasurements } from '@/features/body/hooks';
import { CaptureFailure, pickPhoto, type CapturedPhoto } from '@/features/photo/capture';
import { useProfile } from '@/features/profile/hooks';
import { goBack } from '@/lib/nav';
import { errorMessage } from '@/lib/net';
import { Button, DateField, Input, Note, NumberField, PageHeader, Screen, Stat, Text, radius, space, toast } from '@/ui';

const CM_PER_IN = 2.54;

export default function LogMeasure() {
  const params = useLocalSearchParams<{ date?: string }>();
  const tz = deviceTimeZone();
  const profile = useProfile();
  const unitSystem = (profile.data?.unit_system ?? 'metric') as UnitSystem;
  const unit = unitSystem === 'imperial' ? 'in' : 'cm';
  const [localDate, setLocalDate] = useState(params.date ?? todayLocal(tz));
  const [waist, setWaist] = useState<number | null>(null);
  const [hips, setHips] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const history = useMeasurements(1);
  const log = useLogMeasurement();

  const last = history.data?.[0] ?? null;
  const toCm = (v: number | null) => (v == null ? null : unitSystem === 'imperial' ? Math.round(v * CM_PER_IN * 10) / 10 : v);
  const show = (cm: number | null) => (cm == null ? null : unitSystem === 'imperial' ? (cm / CM_PER_IN).toFixed(1) : cm.toFixed(1));

  async function pick(source: 'camera' | 'library') {
    setError(null);
    try {
      setPhoto(await pickPhoto(source));
    } catch (err) {
      if (err instanceof CaptureFailure && err.reason === 'cancelled') return;
      setError(errorMessage(err));
    }
  }

  async function save() {
    const waistCm = toCm(waist);
    const hipsCm = toCm(hips);
    if (waistCm == null && hipsCm == null && !photo) {
      setError('Add a waist or hip measurement, or a photo.');
      return;
    }
    setError(null);
    try {
      const isToday = localDate === todayLocal(tz);
      await log.mutateAsync({
        localDate,
        tz,
        measuredAt: isToday ? new Date().toISOString() : localDateTimeToIso(localDate, timeInZone(new Date().toISOString(), tz), tz),
        waistCm,
        hipsCm,
        note: note.trim() || null,
        photo: photo ? { uri: photo.uri, width: photo.width, height: photo.height } : null,
      });
      toast('Measurement saved');
      goBack('/progress');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <Screen testID="log-measure">
      <PageHeader title="Measure" subtitle={formatLocalDate(localDate, 'relative')} backTo="/today" />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Stat label="Last waist" value={last?.waist_cm != null ? `${show(last.waist_cm)} ${unit}` : 'None yet'} note={last ? formatLocalDate(last.local_date, 'short') : 'Once a month is plenty'} style={{ minWidth: 0 }} />
        <Stat label="Last photo" value={last?.photo_path ? formatLocalDate(last.local_date, 'short') : 'None yet'} note="Private to you" style={{ minWidth: 0 }} />
      </View>
      <DateField label="Date" value={localDate} onChange={(v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && setLocalDate(v)} max={todayLocal(tz)} testID="measure-date" />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <NumberField label={`Waist (${unit})`} value={waist} onChangeNumber={setWaist} placeholder={show(last?.waist_cm ?? null) ?? (unitSystem === 'imperial' ? '34.0' : '86.0')} testID="measure-waist" />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField label={`Hips (${unit})`} value={hips} onChangeNumber={setHips} placeholder={show(last?.hips_cm ?? null) ?? (unitSystem === 'imperial' ? '38.0' : '96.0')} testID="measure-hips" />
        </View>
      </View>
      <Note>Measure at the navel, relaxed, same time of day. The tape beats the scale for seeing fat change.</Note>
      {photo ? (
        <View style={{ gap: space.sm }}>
          <Image source={{ uri: photo.uri }} style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: radius.lg }} resizeMode="cover" accessibilityLabel="Progress photo preview" />
          <Button label="Remove photo" variant="ghost" size="sm" onPress={() => setPhoto(null)} />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="Take photo" variant="secondary" style={{ flex: 1 }} onPress={() => void pick('camera')} testID="measure-camera" />
          <Button label="From gallery" variant="secondary" style={{ flex: 1 }} onPress={() => void pick('library')} testID="measure-gallery" />
        </View>
      )}
      <Text variant="caption" color="textFaint">
        Photos stay in a private bucket only you can open. Same spot, same light, front on.
      </Text>
      <Input label="Note" value={note} onChangeText={setNote} placeholder="Optional" testID="measure-note" />
      {error ? (
        <Text color="danger" variant="small" testID="measure-error">
          {error}
        </Text>
      ) : null}
      <Button label={log.isPending ? 'Saving' : 'Save measurement'} size="lg" disabled={log.isPending} onPress={() => void save()} testID="save-measure" />
    </Screen>
  );
}
