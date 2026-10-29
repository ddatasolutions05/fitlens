// Native: the OS time picker.
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';
import type { TimeFieldProps } from './TimeField';
import { radius, space, touch } from './tokens';

function toDate(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 12, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

export function TimeField({ label, value, onChange, hint, testID }: TimeFieldProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const picked = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'set' && date) onChange(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
  };
  return (
    <View style={styles.wrap}>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen((o) => !o)} style={[styles.field, { backgroundColor: colors.surface, borderColor: open ? colors.text : colors.border }]} testID={testID}>
        <Text style={{ color: value ? colors.text : colors.textFaint }}>{value || 'Pick a time'}</Text>
      </Pressable>
      {open ? <DateTimePicker value={toDate(value)} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'clock'} onChange={picked} themeVariant="dark" /> : null}
      {hint ? (
        <Text variant="caption" color="textFaint">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  field: { minHeight: touch.min + 4, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, justifyContent: 'center' },
});
