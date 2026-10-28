import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { goBack } from '@/lib/nav';
import { useUserId } from '@/features/auth/session';
import { useDraft } from '@/features/meals/draft-store';
import { errorMessage } from '@/lib/net';
import { supabase } from '@/lib/supabase';
import { Button, Card, Input, Screen, Text, space } from '@/ui';

export default function SaveTemplate() {
  const draft = useDraft();
  const userId = useUserId();
  const qc = useQueryClient();
  const [name, setName] = useState(draft?.title ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error('No meal to save');
      const { data: saved, error: e1 } = await supabase
        .from('saved_meals')
        .insert({ user_id: userId, name: name.trim(), meal_type: draft.mealType })
        .select('id')
        .single();
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('saved_meal_items').insert(
        draft.items.map((it, i) => ({
          user_id: userId,
          saved_meal_id: saved.id,
          food_id: it.foodId,
          sort_order: i,
          name_snapshot: it.name,
          grams: it.grams,
          serving_label: it.servingLabel,
          fraction_eaten: it.fractionEaten,
          per100_kcal: it.per100.kcal,
          per100_protein_g: it.per100.protein_g,
          per100_carbs_g: it.per100.carbs_g,
          per100_fat_g: it.per100.fat_g,
          per100_fibre_g: it.per100.fibre_g,
          per100_sodium_mg: it.per100.sodium_mg,
          per100_sat_fat_g: it.per100.sat_fat_g,
          provenance: it.provenance,
          source_name: it.sourceName,
          assumptions: it.assumptions,
        })),
      );
      if (e2) throw e2;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['saved-meals', userId] });
      goBack('/today');
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <Screen testID="save-template">
      <Text variant="title" style={{ marginTop: space.md }}>
        Save as reusable meal
      </Text>
      <Card style={{ gap: space.md }}>
        <Text color="textMuted" variant="small">
          {draft ? `${draft.items.length} item${draft.items.length === 1 ? '' : 's'}: ${draft.items.map((i) => i.name).join(', ')}` : 'No meal in progress.'}
        </Text>
        <Input label="Name" value={name} onChangeText={setName} placeholder="Usual breakfast" autoFocus />
        {error ? (
          <Text color="danger" variant="small">
            {error}
          </Text>
        ) : null}
        <Button label="Save" size="lg" disabled={!draft || !name.trim() || draft.items.length === 0} loading={save.isPending} onPress={() => save.mutate()} />
        <Button label="Cancel" variant="ghost" onPress={() => goBack('/today')} />
      </Card>
      <Text variant="caption" color="textFaint">
        Saved meals appear under Add food so a repeat meal is three taps: Add food, pick the saved meal, confirm.
      </Text>
    </Screen>
  );
}
