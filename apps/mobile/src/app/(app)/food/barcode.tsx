import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { unstable_createElement } from 'react-native-web';
import { formatNutrient, todayLocal } from '@fitlens/core';
import { lookupBarcodeResultSchema, type LookupBarcodeResult } from '@fitlens/schemas';

import { useUserId } from '@/features/auth/session';
import { addItem, ensureDraft } from '@/features/meals/draft-store';
import { itemFromProduct } from '@/features/photo/products';
import { errorMessage } from '@/lib/net';
import { supabase } from '@/lib/supabase';
import { reportError, track } from '@/lib/telemetry';
import { Button, Card, Input, Note, NumberField, PageHeader, Screen, Skeleton, Text, radius, space, useTheme } from '@/ui';

type Product = NonNullable<LookupBarcodeResult['product']>;

async function lookupBarcode(barcode: string): Promise<LookupBarcodeResult> {
  const { data, error } = await supabase.functions.invoke('lookup-barcode', { method: 'POST', body: { barcode } });
  if (error) throw error;
  return lookupBarcodeResultSchema.parse(data);
}

/** Browsers with a built-in barcode reader (Chrome on Android, recent Safari) can scan with the camera; the rest type the number. */
function hasDetector(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

export default function BarcodeScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ date?: string }>();
  const localDate = params.date ?? todayLocal();
  const userId = useUserId();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'scanning' | 'looking' | 'found' | 'missing'>('idle');
  const [product, setProduct] = useState<Product | null>(null);
  const [grams, setGrams] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stopRef = useRef<() => void>(() => {});
  const canScan = hasDetector();

  useEffect(() => () => stopRef.current(), []);

  async function find(barcode: string) {
    const clean = barcode.replace(/\D/g, '');
    if (!/^\d{6,14}$/.test(clean)) {
      setError('A barcode is 8 to 14 digits.');
      return;
    }
    setError(null);
    setStatus('looking');
    try {
      const res = await lookupBarcode(clean);
      if (!res.found || !res.product) {
        setStatus('missing');
        setProduct(null);
        return;
      }
      setProduct(res.product);
      setGrams(res.product.serving_g ?? 100);
      setStatus('found');
      track('barcode_found');
    } catch (err) {
      reportError('barcode.lookup', err);
      setStatus('idle');
      setError(errorMessage(err));
    }
  }

  async function startCamera() {
    if (!canScan) return;
    setError(null);
    setStatus('scanning');
    try {
      const Detector = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => { detect(src: HTMLVideoElement): Promise<{ rawValue: string }[]> } }).BarcodeDetector;
      const detector = new Detector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = videoRef.current;
      if (!video) throw new Error('No camera view');
      video.srcObject = stream;
      await video.play();
      let active = true;
      stopRef.current = () => {
        active = false;
        stream.getTracks().forEach((t) => t.stop());
      };
      const tick = async () => {
        if (!active) return;
        try {
          const hits = await detector.detect(video);
          const hit = hits.find((h) => /^\d{6,14}$/.test(h.rawValue));
          if (hit) {
            stopRef.current();
            setCode(hit.rawValue);
            await find(hit.rawValue);
            return;
          }
        } catch {
          // a frame without a readable code
        }
        setTimeout(() => void tick(), 250);
      };
      void tick();
    } catch (err) {
      setStatus('idle');
      setError(/NotAllowed|denied/i.test(errorMessage(err)) ? 'Camera access was denied. Type the number under the barcode instead.' : errorMessage(err));
    }
  }

  async function add() {
    if (!product || !grams || grams <= 0) return;
    setAdding(true);
    setError(null);
    try {
      ensureDraft({ localDate, source: 'manual' });
      const item = await itemFromProduct({ ...product, url: null }, grams, userId);
      addItem(item);
      track('barcode_added');
      router.replace('/meal/edit');
    } catch (err) {
      reportError('barcode.add', err);
      setError(errorMessage(err));
    } finally {
      setAdding(false);
    }
  }

  const videoElement =
    Platform.OS === 'web' && status === 'scanning' ? (
      // The video element is plain DOM; React Native Web has no camera view.
      <View style={[styles.frame, { borderColor: colors.text }]}>{createVideo(videoRef)}</View>
    ) : null;

  return (
    <Screen testID="barcode-screen">
      <PageHeader title="Scan a barcode" subtitle="Packaged food with a label. Values come from Open Food Facts, community data, so check the pack." backTo="/food/search" />
      {videoElement}
      {status === 'scanning' ? (
        <Button label="Stop camera" variant="secondary" onPress={() => { stopRef.current(); setStatus('idle'); }} />
      ) : canScan ? (
        <Button label="Scan with the camera" size="lg" onPress={() => void startCamera()} testID="barcode-camera" />
      ) : (
        <Note>This browser cannot read barcodes from the camera. Type the number printed under the bars.</Note>
      )}
      <View style={{ gap: space.sm }}>
        <Input label="Barcode number" value={code} onChangeText={setCode} keyboardType="number-pad" inputMode="numeric" placeholder="0 12345 67890 5" testID="barcode-input" />
        <Button label="Look up" variant="secondary" onPress={() => void find(code)} disabled={code.replace(/\D/g, '').length < 6 || status === 'looking'} loading={status === 'looking'} testID="barcode-lookup" />
      </View>
      {status === 'looking' ? <Skeleton width="60%" /> : null}
      {status === 'missing' ? (
        <Card tone="alt" style={{ gap: space.sm }}>
          <Text variant="bodyStrong">Not in Open Food Facts</Text>
          <Text variant="small" color="textMuted">
            Enter the values from the label instead; the app saves them for next time.
          </Text>
          <Button label="Enter from the label" variant="secondary" size="sm" onPress={() => router.push({ pathname: '/food/manual', params: { date: localDate } })} />
        </Card>
      ) : null}
      {product && status === 'found' ? (
        <Card style={{ gap: space.md }} testID="barcode-product">
          <View style={{ gap: 2 }}>
            <Text variant="heading">{product.brand ? `${product.name} (${product.brand})` : product.name}</Text>
            <Text variant="small" color="textMuted">
              {formatNutrient(product.per100.kcal, 'kcal')} per 100 g. P {formatNutrient(product.per100.protein_g, 'g')}, C {formatNutrient(product.per100.carbs_g, 'g')}, F {formatNutrient(product.per100.fat_g, 'g')}.
            </Text>
          </View>
          <NumberField label="Amount eaten (g or ml)" value={grams} onChangeNumber={setGrams} decimals={0} testID="barcode-grams" hint={product.serving_g ? `One serving on the pack is ${Math.round(product.serving_g)} g.` : undefined} />
          <Button label="Add to meal" size="lg" onPress={() => void add()} loading={adding} disabled={!grams} testID="barcode-add" />
        </Card>
      ) : null}
      {error ? (
        <Text color="danger" variant="small" testID="barcode-error">
          {error}
        </Text>
      ) : null}
    </Screen>
  );
}

function createVideo(ref: { current: HTMLVideoElement | null }): ReactElement {
  return unstable_createElement('video', { ref, playsInline: true, muted: true, style: { width: '100%', height: '100%', objectFit: 'cover', borderRadius: radius.lg } });
}

const styles = StyleSheet.create({
  frame: { aspectRatio: 4 / 3, borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
});
