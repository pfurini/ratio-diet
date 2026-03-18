interface FoodForPrompt {
  name: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbPer100g: number;
  fatPer100g: number;
}

interface PromptInput {
  foods: FoodForPrompt[];
  macroTarget: {
    calorieTarget: number;
    proteinGrams: number;
    carbGrams: number;
    fatGrams: number;
  };
  allergies: string[];
  allergiesOther?: string;
  dietaryPreference: string;
}

const MAX_PROMPT_ALLERGIES_OTHER_LENGTH = 300;

const buildFoodList = (foods: FoodForPrompt[]): string =>
  foods
    .map(
      (f) =>
        `- ${f.name}: ${f.kcalPer100g} kcal, ${f.proteinPer100g}g proteine, ${f.carbPer100g}g carbo, ${f.fatPer100g}g grassi (per 100g)`
    )
    .join('\n');

const sanitizeForPrompt = (value: string): string =>
  value
    // eslint-disable-next-line no-control-regex
    .replaceAll(/[\u0000-\u001F\u007F]/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PROMPT_ALLERGIES_OTHER_LENGTH);

const buildAllergyNote = (allergies: string[], allergiesOther?: string): string =>
  allergies.length > 0 || allergiesOther
    ? `Allergie/intolleranze: ${allergies.length > 0 ? allergies.join(', ') : ''}${
        allergiesOther
          ? `${allergies.length > 0 ? '. ' : ''}Altro (testo utente): ${JSON.stringify(sanitizeForPrompt(allergiesOther))}`
          : ''
      }\n`
    : '';

export const buildWeeklyPlanPrompt = (input: PromptInput): string => {
  const foodList = buildFoodList(input.foods);
  const allergyNote = buildAllergyNote(input.allergies, input.allergiesOther);

  return `Sei un nutrizionista italiano. Crea un piano alimentare settimanale (7 giorni, lunedì-domenica) usando ESCLUSIVAMENTE i cibi elencati sotto.

OBIETTIVI GIORNALIERI:
- Calorie: ${input.macroTarget.calorieTarget} kcal
- Proteine: ${input.macroTarget.proteinGrams}g
- Carboidrati: ${input.macroTarget.carbGrams}g
- Grassi: ${input.macroTarget.fatGrams}g

${allergyNote}Preferenza alimentare: ${input.dietaryPreference}

CIBI DISPONIBILI (valori per 100g):
${foodList}

REGOLE:
1. Usa SOLO i cibi elencati sopra. Non inventare cibi.
2. Per ogni pasto specifica il nome del cibo e i grammi esatti.
3. Varia i cibi tra i giorni per non ripetere lo stesso pasto.
4. Distribuisci i macro: colazione ~25%, pranzo ~40%, cena ~35%.
5. Le quantità devono essere realistiche (non superare 500g per singolo cibo).
6. I macro giornalieri totali devono avvicinarsi il più possibile agli obiettivi (tolleranza ±5%).

Genera il piano come oggetto JSON strutturato.`;
};
