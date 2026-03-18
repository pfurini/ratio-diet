export const ALLERGEN_OPTIONS = [
  { label: 'Glutine', value: 'glutine' },
  { label: 'Lattosio', value: 'lattosio' },
  { label: 'Frutta a guscio', value: 'frutta_a_guscio' },
  { label: 'Uova', value: 'uova' },
  { label: 'Crostacei', value: 'crostacei' },
] as const;

export const GOAL_OPTIONS = [
  { description: 'Perdere peso in modo graduale', label: 'Dimagrimento', value: 'dimagrimento' },
  { description: 'Mantenere il peso attuale', label: 'Mantenimento', value: 'mantenimento' },
  { description: 'Guadagnare massa muscolare', label: 'Aumento massa', value: 'aumento_massa' },
  { description: 'Perdere grasso e guadagnare muscolo', label: 'Ricomposizione', value: 'ricomposizione' },
] as const;

export const ACTIVITY_OPTIONS = [
  { description: 'Poco o nessun esercizio', label: 'Sedentario', value: 'sedentario' },
  { description: 'Esercizio leggero 1–3 giorni/settimana', label: 'Leggermente attivo', value: 'leggermente_attivo' },
  {
    description: 'Esercizio moderato 3–5 giorni/settimana',
    label: 'Moderatamente attivo',
    value: 'moderatamente_attivo',
  },
  { description: 'Esercizio intenso 6–7 giorni/settimana', label: 'Molto attivo', value: 'molto_attivo' },
  { description: 'Allenamento professionale o doppia sessione', label: 'Atleta', value: 'atleta' },
] as const;

export const DIETARY_OPTIONS = [
  { label: 'Onnivoro', value: 'onnivoro' },
  { label: 'Vegetariano', value: 'vegetariano' },
  { label: 'Vegano', value: 'vegano' },
  { label: 'Pescetariano', value: 'pescetariano' },
] as const;

export const toggleAllergen = (current: string[], value: string): string[] => {
  if (current.includes(value)) {
    return current.filter((a) => a !== value);
  }
  return [...current, value];
};
