// Native: the OS date picker. Android opens a dialog; iOS shows the wheel inline.
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import type { DateFieldProps } from './DateField';
import { Text } from './Text';
import { useTheme } from './theme';
import { radius, space, touch } from './tokens';

function toDate(value: string): Date {
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function toValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function DateField({ label, value, onChange, min, max, hint, error, testID }: DateFieldProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const picked = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'set' && date) onChange(toValue(date));
  };
  return (
    <View style={styles.wrap}>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen((o) => !o)}
        style={[styles.field, { backgroundColor: colors.surface, borderColor: error ? colors.danger : open ? colors.text : colors.border }]}
        testID={testID}
      >
        <Text style={{ color: value ? colors.text : colors.textFaint }}>{value || 'Pick a date'}</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={toDate(value)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
          minimumDate={min ? toDate(min) : undefined}
          maximumDate={max ? toDate(max) : undefined}
          onChange={picked}
          themeVariant="dark"
        />
      ) : null}
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="textFaint">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  field: {
    minHeight: touch.min + 4,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    justifyContent: 'center',
  },
});
