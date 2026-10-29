import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { formatNutrient, todayLocal } from '@fitlens/core';

import { AddFoodSheet, pickedFromFood, pickedFromSearch, type PickedFood } from '@/features/food/AddFoodSheet';
import { useRecentFoods, useSearchFoods, useToggleFavourite } from '@/features/food/hooks';
import { itemsFromMeal, mealLabel, useRecentMeals } from '@/features/food/recent-meals';
import { draftItemsFromSaved, touchSavedMeal, useSavedMeals } from '@/features/food/saved-meals';
import { addItem, ensureDraft, setDraft, updateItem } from '@/features/meals/draft-store';
import { provenanceForSource, provenanceLabel, sourceNameFor, type DraftItem } from '@/features/meals/model';
import { Button, Card, EmptyState, ErrorState, Icon, Input, PageHeader, Row, Screen, Skeleton, space, Text, useTheme } from '@/ui';

export default function FoodSearch() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ date?: string; fresh?: string; replace?: string; q?: string; first?: string }>();
  const first = params.first === '1';
  const localDate = params.date ?? todayLocal();
  const replaceId = params.replace ?? null;
  const [query, setQuery] = useState(params.q ?? '');
  const search = useSearchFoods(query);
  const recents = useRecentFoods();
  const savedMeals = useSavedMeals();
  const recentMeals = useRecentMeals();
  const toggleFav = useToggleFavourite();
  const [picked, setPicked] = useState<PickedFood | null>(null);

  // Opened from Today or Diary: start a new meal rather than appending to a stale draft.
  useEffect(() => {
    if (params.fresh === '1' && !replaceId) setDraft(null);
  }, [params.fresh, replaceId]);

  const q = query.trim();
  const favourites = (recents.data ?? []).filter((r) => r.favourite);
  const recentOnly = (recents.data ?? []).filter((r) => !r.favourite).slice(0, 12);

  function commit(items: DraftItem[]) {
    ensureDraft({ localDate, source: 'manual' });
    if (replaceId && items[0]) {
      updateItem(replaceId, { ...items[0], localId: replaceId });
    } else {
      items.forEach(addItem);
    }
    setPicked(null);
    router.replace('/meal/edit');
  }

  return (
    <Screen testID="food-search">
      <PageHeader
        title={first ? 'Your first meal' : replaceId ? 'Change food' : 'Add food'}
        subtitle={first ? 'Start with what you last ate. Searching, typing or a photo all work; skip if you would rather look around first.' : 'Search three databases, pick a saved meal, or type the food in yourself.'}
        backTo={first ? '/home' : '/today'}
      />
      {first ? (
        <View style={{ gap: space.sm }}>
          <Button label="Scan the plate" size="lg" onPress={() => router.push({ pathname: '/scan', params: { date: localDate, fresh: '1' } })} testID="first-scan" />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label="Describe it" variant="secondary" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/food/describe', params: { date: localDate } })} />
            <Button label="Skip for now" variant="ghost" style={{ flex: 1 }} onPress={() => router.replace('/home')} testID="first-skip" />
          </View>
          <Text variant="caption" color="textFaint" align="center">
            Or search below.
          </Text>
        </View>
      ) : null}
      <View style={{ gap: space.sm }}>
        <Input value={query} onChangeText={setQuery} placeholder="Search foods, e.g. dal, roti, chicken breast" autoFocus autoCorrect={false} testID="food-query" returnKeyType="search" />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button
            label="Enter manually"
            variant="secondary"
            size="sm"
            style={{ flex: 1 }}
            onPress={() => router.push({ pathname: '/food/manual', params: { date: localDate, ...(replaceId ? { replace: replaceId } : {}) } })}
            testID="manual-entry"
          />
          {!replaceId ? <Button label="Barcode" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/food/barcode', params: { date: localDate } })} testID="barcode-entry" /> : null}
          {!replaceId ? <Button label="Scan meal" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/scan', params: { date: localDate } })} /> : null}
        </View>
        {!replaceId ? (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label="Describe it" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/food/describe', params: { date: localDate } })} testID="describe-entry" />
            <Button label="Read a label" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/food/label', params: { date: localDate } })} testID="label-entry" />
          </View>
        ) : null}
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
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={r.favourite ? 'Remove from favourites' : 'Add to favourites'}
                    onPress={() => toggleFav.mutate({ foodId: r.id, favourite: !r.favourite })}
                    style={{ padding: space.sm }}
                  >
                    <Icon name={r.favourite ? 'starFilled' : 'star'} size={20} color={r.favourite ? colors.text : colors.textFaint} />
                  </Pressable>
                }
              />
            ))
          ) : (
            <EmptyState title="No matches" body="Try a shorter word, or enter the food manually." action={{ label: 'Enter manually', onPress: () => router.push({ pathname: '/food/manual', params: { date: localDate } }) }} />
          )}
        </Card>
      ) : (
        <>
          {!replaceId && (recentMeals.data?.length ?? 0) > 0 ? (
            <Card style={{ gap: space.xs }} testID="recent-meals">
              <Text variant="label" color="textMuted">
                Log it again
              </Text>
              {recentMeals.data!.map((m) => (
                <Row
                  key={m.id}
                  title={mealLabel(m)}
                  subtitle={`${m.meal_type[0]!.toUpperCase()}${m.meal_type.slice(1)} on ${m.local_date}, ${m.meal_items.length} item${m.meal_items.length === 1 ? '' : 's'}`}
                  onPress={() => commit(itemsFromMeal(m))}
                  right={<Icon name="plus" size={18} color={colors.textMuted} />}
                />
              ))}
            </Card>
          ) : null}
          {!replaceId ? (
            <Card style={{ gap: space.xs }} testID="saved-meals">
              <Text variant="label" color="textMuted">
                Saved meals
              </Text>
              {savedMeals.isLoading ? (
                <Skeleton />
              ) : savedMeals.isError ? (
                <ErrorState message={(savedMeals.error as Error).message} onRetry={() => savedMeals.refetch()} />
              ) : !savedMeals.data?.length ? (
                <Text color="textMuted">After confirming a meal, choose &quot;Save as reusable meal&quot; and it will appear here for a one-tap repeat.</Text>
              ) : (
                savedMeals.data.map((m) => (
                  <Row
                    key={m.id}
                    title={m.name}
                    subtitle={m.saved_meal_items.map((i) => i.name_snapshot).join(', ')}
                    onPress={() => {
                      void touchSavedMeal(m.id, m.use_count);
                      commit(draftItemsFromSaved(m));
                    }}
                  />
                ))
              )}
            </Card>
          ) : null}
          {favourites.length > 0 ? (
            <Card style={{ gap: space.xs }}>
              <Text variant="label" color="textMuted">
                Favourites
              </Text>
              {favourites.map((r) => (
                <Row
                  key={r.food.id}
                  title={r.food.name}
                  subtitle={r.usual_grams ? `usually ${Math.round(r.usual_grams)} g` : null}
                  onPress={() => setPicked(pickedFromFood(r.food, r.usual_grams))}
                  right={<Icon name="starFilled" size={18} color={colors.text} />}
                />
              ))}
            </Card>
          ) : null}
          <Card style={{ gap: space.xs }}>
            <Text variant="label" color="textMuted">
              Recent
            </Text>
            {recents.isLoading ? (
              <Skeleton />
            ) : recents.isError ? (
              <ErrorState message={(recents.error as Error).message} onRetry={() => recents.refetch()} />
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

      <AddFoodSheet food={picked} onClose={() => setPicked(null)} onAdd={(item) => commit([item])} />
    </Screen>
  );
}
