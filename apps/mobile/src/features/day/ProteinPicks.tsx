// Three foods from the person's own history that would cover the protein gap.
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useRecentFoods } from '@/features/food/hooks';
import { Card, Icon, Text, space, useTheme } from '@/ui';

export function ProteinPicks({ remainingG, localDate }: { remainingG: number; localDate: string }) {
  const { colors } = useTheme();
  const recents = useRecentFoods();
  const picks = useMemo(() => {
    const rows = (recents.data ?? []).filter((r) => r.food.protein_g != null && Number(r.food.protein_g) >= 8);
    return rows
      .map((r) => {
        const grams = r.usual_grams ?? (r.food.default_serving_g == null ? 100 : Number(r.food.default_serving_g));
        return { id: r.food.id, name: r.food.name, grams, protein: (Number(r.food.protein_g) * grams) / 100 };
      })
      .sort((a, b) => b.protein - a.protein)
      .slice(0, 3);
  }, [recents.data]);

  if (picks.length === 0) return null;
  return (
    <Card style={{ gap: space.sm }} testID="protein-picks">
      <Text variant="label" color="textMuted">
        {Math.round(remainingG)} g of protein to go. From your history
      </Text>
      {picks.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="button"
          accessibilityLabel={`Add ${p.name}`}
          onPress={() => router.push({ pathname: '/food/search', params: { date: localDate, fresh: '1', q: p.name } })}
          style={({ pressed }) => [styles.row, { borderTopColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
        >
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {p.name}
            </Text>
            <Text variant="caption" color="textMuted">
              {Math.round(p.grams)} g, about {Math.round(p.protein)} g protein
            </Text>
          </View>
          <Icon name="plus" size={18} color={colors.textMuted} />
        </Pressable>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, minHeight: 48 },
});
