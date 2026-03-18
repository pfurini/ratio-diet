type FormValues = {
  isOver18: boolean;
  noPathologies: boolean;
  disclaimerRead: boolean;
  sex: 'M' | 'F';
  dateOfBirth: string;
  heightCm: number;
  weightKg: number;
  bodyBuild: 'snello' | 'medio' | 'robusto';
  goal: 'dimagrimento' | 'mantenimento' | 'aumento_massa' | 'ricomposizione';
  activityLevel:
    | 'sedentario'
    | 'leggermente_attivo'
    | 'moderatamente_attivo'
    | 'molto_attivo'
    | 'atleta';
  allergies: string[];
  allergiesOther: string;
  dietaryPreference: 'onnivoro' | 'vegetariano' | 'vegano' | 'pescetariano';
  followedByNutritionist: boolean;
};

const STEPS = ['Consenso', 'Dati personali', 'Obiettivo', 'Alimentazione'] as const;

export { type FormValues, STEPS };
