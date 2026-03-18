'use client';

import { api } from '@ratio-diet/backend/convex/_generated/api';
import type { Id } from '@ratio-diet/backend/convex/_generated/dataModel';
import type { MealType } from '@ratio-diet/backend/convex/schema';
import { Button } from '@ratio-diet/ui/components/button';
import { Input } from '@ratio-diet/ui/components/input';
import { useMutation, useQuery } from 'convex/react';
import { Pencil, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import FoodName from './food-name';

interface MealItemRowProps {
  foodId: Id<'foods'>;
  quantityGrams: number;
  canEdit: boolean;
  weeklyPlanId: Id<'weeklyPlans'>;
  dailyPlanId: Id<'dailyPlans'>;
  mealType: MealType;
}

const useEditState = (initial: number) => {
  const [editing, setEditing] = useState(false);
  const [qty, setQty] = useState(initial.toString());
  useEffect(() => {
    if (!editing) {
      setQty(initial.toString());
    }
  }, [initial, editing]);
  return { editing, qty, setEditing, setQty };
};

interface EditControlsProps {
  qty: string;
  onQtyChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

const EditControls = ({ qty, onQtyChange, onSave, onCancel, saving }: EditControlsProps) => (
  <div className="flex items-center gap-1 mt-1">
    <Input
      type="number"
      min="1"
      value={qty}
      onChange={(e) => onQtyChange(e.target.value)}
      className="h-7 w-20 text-xs"
      aria-label="Quantità in grammi"
    />
    <span className="text-xs text-muted-foreground">g</span>
    <Button
      type="button"
      size="sm"
      variant="default"
      className="h-7 px-2 text-xs"
      onClick={onSave}
      disabled={saving}
    >
      {saving ? '...' : 'Salva'}
    </Button>
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="h-7 w-7 p-0"
      onClick={onCancel}
      aria-label="Annulla"
    >
      <X className="h-3 w-3" />
    </Button>
  </div>
);

const PARTIAL_SUCCESS_MSG =
  'Quantità salvata ma aggiornamento lista spesa fallito — riprova ricalcolo';

const MealItemRow = ({
  foodId,
  quantityGrams,
  canEdit,
  weeklyPlanId,
  dailyPlanId,
  mealType,
}: MealItemRowProps) => {
  const food = useQuery(api.foods.getById, { foodId });
  const updateItem = useMutation(api.weeklyPlans.updateMealItem);
  const recalculate = useMutation(api.weeklyPlans.recalculateShoppingList);
  const { editing, qty, setEditing, setQty } = useEditState(quantityGrams);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async () => {
    const parsed = parseFloat(qty);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    let updated = false;
    try {
      await updateItem({ weeklyPlanId, dailyPlanId, mealType, foodId, quantityGrams: parsed });
      updated = true;
      await recalculate({ weeklyPlanId });
      setEditing(false);
    } catch (err) {
      if (updated) {
        setSaveError(PARTIAL_SUCCESS_MSG);
        setEditing(false);
      } else {
        const msg = err instanceof Error ? err.message : 'Errore durante il salvataggio';
        setSaveError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const retryRecalculate = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await recalculate({ weeklyPlanId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Errore durante il ricalcolo';
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setQty(quantityGrams.toString());
    setEditing(false);
    setSaveError(null);
  };

  const isPartialSuccess = saveError === PARTIAL_SUCCESS_MSG;

  return (
    <div className="flex flex-col gap-0.5 py-1">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm min-w-0 flex-1">
          {food ? (
            <FoodName name={food.name} source={food.source} />
          ) : (
            <span className="text-muted-foreground">Caricamento...</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!editing && (
            <span className="text-sm tabular-nums text-muted-foreground">
              {Math.round(quantityGrams)} g
            </span>
          )}
          {canEdit && !editing && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => setEditing(true)}
              aria-label="Modifica quantità"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      {editing && (
        <EditControls
          qty={qty}
          onQtyChange={setQty}
          onSave={handleSave}
          onCancel={handleCancel}
          saving={saving}
        />
      )}
      {saveError && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-destructive">{saveError}</p>
          {isPartialSuccess && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 text-xs"
              onClick={retryRecalculate}
              disabled={saving}
            >
              {saving ? '...' : 'Riprova ricalcolo'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default MealItemRow;
