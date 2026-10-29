// In-app time picker. The browser and OS wheels have no Set button on phones,
// so people changed the time and could not tell it had taken. This sheet has one.
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/lib/i18n';

import { Button } from './Button';
import { Segmented } from './Segmented';
import { Text } from './Text';
import { useTheme } from './theme';
import { radius, space, touch } from './tokens';

export interface TimeFieldProps {
  label: string;
  /** HH:MM, 24 hour. */
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  testID?: string;
}

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function parse(hhmm: string): { h: number; m: number } {
  const [h, m] = hhmm.split(':').map(Number);
  return { h: Number.isFinite(h) ? h : 12, m: Number.isFinite(m) ? m : 0 };
}

export function format12(hhmm: string): string {
  const { h, m } = parse(hhmm);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function TimeField({ label, value, onChange, hint, testID }: TimeFieldProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${format12(value)}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.field, { backgroundColor: colors.surface, borderColor: open ? colors.text : colors.border, opacity: pressed ? 0.85 : 1 }]}
        testID={testID}
      >
        <Text tabular>{format12(value)}</Text>
      </Pressable>
      {hint ? (
        <Text variant="caption" color="textFaint">
          {hint}
        </Text>
      ) : null}
      {open ? (
        <TimeSheet
          key={value}
          label={label}
          initial={value}
          testID={testID}
          onCancel={() => setOpen(false)}
          onSet={(v) => {
            setOpen(false);
            onChange(v);
          }}
        />
      ) : null}
    </View>
  );
}

function TimeSheet({ label, initial, testID, onSet, onCancel }: { label: string; initial: string; testID?: string; onSet: (v: string) => void; onCancel: () => void }) {
  const t = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const start = parse(initial);
  const [hour, setHour] = useState(start.h % 12 === 0 ? 12 : start.h % 12);
  const [minute, setMinute] = useState(start.m);
  const [half, setHalf] = useState<'AM' | 'PM'>(start.h < 12 ? 'AM' : 'PM');
  const minutes = MINUTES.includes(minute) ? MINUTES : [...MINUTES, minute];
  const h24 = (hour % 12) + (half === 'PM' ? 12 : 0);
  const picked = `${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const chip = (on: boolean, pressed: boolean) => [styles.chip, { backgroundColor: on ? colors.accent : 'transparent', borderColor: on ? colors.accent : colors.border, opacity: pressed ? 0.8 : 1 }];
  const chipText = (on: boolean) => ({ color: on ? colors.onAccent : colors.text, fontSize: 15, lineHeight: 20 });
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onCancel} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: colors.bg, borderColor: colors.border, paddingBottom: Math.max(insets.bottom, space.lg) }]} testID={testID ? `${testID}-sheet` : undefined}>
        <View style={[styles.grabber, { backgroundColor: colors.border }]} />
        <ScrollView bounces={false} contentContainerStyle={{ gap: space.lg }}>
          <View style={styles.head}>
            <Text variant="heading">{label}</Text>
            <Text variant="title" tabular testID={testID ? `${testID}-preview` : undefined}>
              {format12(picked)}
            </Text>
          </View>
          <View style={{ gap: space.sm }}>
            <Text variant="caption" color="textMuted">
              Hour
            </Text>
            <View style={styles.row}>
              {HOURS.map((h) => {
                const on = h === hour;
                return (
                  <Pressable key={h} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setHour(h)} style={({ pressed }) => chip(on, pressed)} testID={testID ? `${testID}-h-${h}` : undefined}>
                    <Text variant="bodyStrong" tabular style={chipText(on)}>
                      {h}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={{ gap: space.sm }}>
            <Text variant="caption" color="textMuted">
              Minute
            </Text>
            <View style={styles.row}>
              {minutes.map((m) => {
                const on = m === minute;
                return (
                  <Pressable key={m} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setMinute(m)} style={({ pressed }) => chip(on, pressed)} testID={testID ? `${testID}-m-${String(m).padStart(2, '0')}` : undefined}>
                    <Text variant="bodyStrong" tabular style={chipText(on)}>
                      {String(m).padStart(2, '0')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Segmented<'AM' | 'PM'>
            value={half}
            onChange={setHalf}
            options={[
              { value: 'AM', label: 'AM' },
              { value: 'PM', label: 'PM' },
            ]}
          />
          <View style={{ gap: space.sm }}>
            <Button label={t('time.set')} size="lg" onPress={() => onSet(picked)} testID={testID ? `${testID}-set` : undefined} />
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Button label={t('time.now')} variant="secondary" onPress={() => onSet(nowHHMM())} testID={testID ? `${testID}-now` : undefined} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label={t('time.cancel')} variant="ghost" onPress={onCancel} />
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  field: { minHeight: touch.min + 4, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, justifyContent: 'center' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: space.lg },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minWidth: 48, minHeight: touch.min - 4, paddingHorizontal: space.md, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1 },
});
