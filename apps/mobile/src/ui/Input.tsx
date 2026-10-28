import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from './Text';
import { useTheme } from './theme';
import { fonts, radius, space, touch } from './tokens';

export interface InputProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string | null;
  suffix?: string;
}

export function Input({ label, hint, error, suffix, style, ...rest }: InputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="caption" color="textMuted">
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : focused ? colors.text : colors.border,
          },
        ]}
      >
        <TextInput
          placeholderTextColor={colors.textFaint}
          accessibilityLabel={label}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[styles.input, { color: colors.text }, style]}
        />
        {suffix ? (
          <Text variant="small" color="textMuted">
            {suffix}
          </Text>
        ) : null}
      </View>
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

export interface NumberFieldProps extends Omit<InputProps, 'value' | 'onChangeText' | 'onChange'> {
  value: number | null;
  onChangeNumber: (value: number | null) => void;
  decimals?: number;
}

export function NumberField({ value, onChangeNumber: onChange, decimals = 1, ...rest }: NumberFieldProps) {
  const [text, setText] = useState(value == null ? '' : String(value));
  return (
    <Input
      keyboardType={decimals > 0 ? 'decimal-pad' : 'number-pad'}
      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
      {...rest}
      value={text}
      onChangeText={(t) => {
        const cleaned = t.replace(',', '.').replace(/[^0-9.]/g, '');
        setText(cleaned);
        const n = cleaned === '' || cleaned === '.' ? null : Number(cleaned);
        onChange(n == null || Number.isNaN(n) ? null : n);
      }}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  field: {
    minHeight: touch.min + 4,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  input: { flex: 1, fontSize: 16, fontFamily: fonts.regular, paddingVertical: space.sm, minHeight: touch.min, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}) },
});
