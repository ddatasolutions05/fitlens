import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { formatNutrient, todayLocal } from '@fitlens/core';

import { AddFoodSheet, pickedFromFood, pickedFromSearch, type PickedFood } from '@/features/food/AddFoodSheet';
import { useRecentFoods, useSearchFoods, useToggleFavourite } from '@/features/food/hooks';
import { addItem, ensureDraft } from '@/features/meals/draft-store';
import { provenanceForSource, provenanceLabel, sourceNameFor } from '@/features/meals/model';
import { Button, Card, EmptyState, ErrorState, Input, Row, Screen, Skeleton, Text, space, useTheme } from '@/ui';

export default function FoodSearch() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ date?: string }>();
  const localDate = params.date ?? todayLocal();
  const [query, setQuery] = useState('');
  const search = useSearchFoods(query);
  const recents = useRecentFoods();
  const toggleFav = useToggleFavourite();
  const [picked, setPicked] = useState<PickedFood | null>(null);

  const q = query.trim();
  const favourites = (recents.data ?? []).filter((r) => r.favourite);
  const recentOnly = (recents.data ?? []).filter((r) => !r.favourite).slice(0, 12);

  return (
    <Screen testID="food-search">
      <View style={{ marginTop: space.md, gap: space.sm }}>
        <Text variant="title">Add food</Text>
        <Input value={query} onChangeText={setQuery} placeholder="Search foods, e.g. dal, roti, chicken breast" autoFocus autoCorrect={false} testID="food-query" returnKeyType="search" />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="Enter manually" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/food/manual', params: { date: localDate } })} testID="manual-entry" />
          <Button label="Scan meal" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/scan', params: { date: localDate } })} />
        </View>
      </View>

      {q.length >= 2 ? (
        <Card style={{ gap: space.xs }} testID="search-results">
          {search.isLoading ? (
            <View style={{ gap: space.sm }}>
              <Skeleton />
              <Skeleton />
              <Skeleton width="70%" />
            </View>
          ) : search.isError ? (
            <ErrorState message={(search.error as Error).message} onRetry={() => search.refetch()} />
          ) : search.data && search.data.length > 0 ? (
            search.data.map((r) => (
              <Row
                key={r.id}
                title={r.brand ? `${r.name} (${r.brand})` : r.name}
                subtitle={`${formatNutrient(r.kcal == null ? null : Number(r.kcal), 'kcal')} per 100 g · ${provenanceLabel(provenanceForSource(r.source), sourceNameFor(r.source))}${r.variant_label ? ` · ${r.variant_label}` : ''}`}
                onPress={() => setPicked(pickedFromSearch(r))}
                right={
                  <Text
                    accessibilityRole="button"
                    accessibilityLabel={r.favourite ? 'Remove from favourites' : 'Add to favourites'}
                    onPress={() => toggleFav.mutate({ foodId: r.id, favourite: !r.favourite })}
                    style={{ fontSize: 22, color: r.favourite ? colors.carbs : colors.textFaint, paddingHorizontal: space.sm }}
                  >
                    {r.favourite ? '★' : '☆'}
                  </Text>
                }
              />
            ))
          ) : (
            <EmptyState title="No matches" body="Try a shorter word, or enter the food manually." action={{ label: 'Enter manually', onPress: () => router.push({ pathname: '/food/manual', params: { date: localDate } }) }} />
          )}
        </Card>
      ) : (
        <>
          {favourites.length > 0 ? (
            <Card style={{ gap: space.xs }}>
              <Text variant="heading">Favourites</Text>
              {favourites.map((r) => (
                <Row
                  key={r.food.id}
                  title={r.food.name}
                  subtitle={r.usual_grams ? `usually ${Math.round(r.usual_grams)} g` : null}
                  onPress={() => setPicked(pickedFromFood(r.food, r.usual_grams))}
                  right={<Text style={{ fontSize: 22, color: colors.carbs }}>★</Text>}
                />
              ))}
            </Card>
          ) : null}
          <Card style={{ gap: space.xs }}>
            <Text variant="heading">Recent</Text>
            {recents.isLoading ? (
              <Skeleton />
            ) : recentOnly.length === 0 ? (
              <Text color="textMuted">Foods you log will show up here for quick re-adding.</Text>
            ) : (
              recentOnly.map((r) => (
                <Row key={r.food.id} title={r.food.name} subtitle={r.usual_grams ? `usually ${Math.round(r.usual_grams)} g` : null} onPress={() => setPicked(pickedFromFood(r.food, r.usual_grams))} />
              ))
            )}
          </Card>
        </>
      )}

      <Button label="Back" variant="ghost" onPress={() => router.back()} />

      <AddFoodSheet
        food={picked}
        onClose={() => setPicked(null)}
        onAdd={(item) => {
          ensureDraft({ localDate, source: 'manual' });
          addItem(item);
          setPicked(null);
          router.push('/meal/edit');
        }}
      />
    </Screen>
  );
}
