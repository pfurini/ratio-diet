# Ratio Diet — Design Specification

**Date:** 2026-03-13 **Status:** Draft **App name:** Ratio Diet **Tagline:** La tua alimentazione basata su numeri, proporzioni e metodo.

---

## 1. Overview

Ratio Diet è un'applicazione nutrizionale italiana basata sulle proporzioni corrette tra calorie e macronutrienti. Non propone diete restrittive: calcola il fabbisogno reale dell'utente e definisce il rapporto ottimale tra proteine, grassi e carboidrati in base all'obiettivo scelto.

Il differenziatore chiave è l'approccio "inverso": l'utente sceglie i cibi che vuole mangiare, il sistema calcola le quantità esatte per rispettare i macro target. Nessuna app nel mercato italiano offre questa funzionalità con dati nutrizionali verificati (CREA).

### Il problema che risolve

Molte persone non sanno quante calorie assumere, seguono diete estreme o sbilanciate, alternano restrizioni eccessive a fasi di abbandono, e non comprendono il ruolo dei macronutrienti. Ratio Diet elimina l'incertezza trasformando la nutrizione in un sistema misurabile e sostenibile.

### Target

Pubblico italiano, interfaccia solo in italiano. Persone sane over 18 che vogliono rientrare in forma o mantenere il controllo del peso. Non è destinata a persone con patologie.

---

## 2. User Journey

### 2.1 Onboarding (una tantum)

1. **Registrazione** — email + password via Better Auth
2. **Gate legale** — l'utente deve confermare:
   - Età ≥ 18 anni
   - Nessuna patologia nota
   - Ha letto il disclaimer ("non sostituisce il parere di un nutrizionista")
3. **Questionario**:
   - Sesso (M/F)
   - Data di nascita (il sistema calcola l'età automaticamente e la mantiene aggiornata)
   - Altezza (cm)
   - Peso attuale (kg)
   - Corporatura: snello / medio / robusto (usata per aggiustamento BMR: snello -5%, medio 0%, robusto +5%)
   - Obiettivo: dimagrimento / mantenimento / aumento massa / ricomposizione corporea
   - Livello attività: sedentario / leggermente attivo / moderatamente attivo / molto attivo / atleta
   - Allergie/intolleranze: glutine, lattosio, frutta a guscio, uova, crostacei (multi-selezione) + campo testo libero per altre allergie. Filtro hard: i cibi incompatibili con le allergie selezionate vengono nascosti dal database (non mostrati con avviso). Il campo testo libero è incluso nel prompt AI per i piani settimanali
   - Preferenza alimentare: onnivoro / vegetariano / vegano / pescetariano
   - Seguito da nutrizionista: sì / no (campo informativo)
4. **Risultato** — il sistema calcola e mostra TDEE e macro target con spiegazione

### 2.2 Pianificatore giornaliero (gratuito)

- Dashboard numbers-first: kcal target grande e centrale, breakdown macro (proteine/carbo/grassi in grammi) subito sotto
- L'utente seleziona cibi dal database CREA per colazione, pranzo, cena (e opzionalmente spuntini)
- Può cercare cibi per nome o navigare per categoria
- Se un cibo non esiste nel database, può aggiungere un alimento personalizzato (nome + valori per 100g)
- Può impostare vincoli per singolo alimento (min/max grammi)
- Il sistema calcola automaticamente le quantità ottimali per raggiungere i macro target
- Visualizzazione macro raggiunti vs target (barre di progresso)
- Può salvare la configurazione come "template" (es. "giornata ufficio", "giornata palestra")
- Può caricare un template salvato per pre-popolare la giornata

### 2.3 Piano settimanale (premium — abbonamento Stripe)

- L'utente seleziona i cibi che vuole mangiare nella settimana
- L'AI (via OpenRouter) genera un piano 7 giorni (colazione/pranzo/cena) distribuendo i cibi scelti
- Il sistema valida i calcoli macro del piano generato (double-check deterministico, tolleranza 5%)
- L'utente può modificare il piano: scambiare cibi, aggiustare quantità, spostare pasti tra giorni
- Lista della spesa cumulativa generata automaticamente (somma quantità per alimento, raggruppata per categoria)
- Esportazione: print-optimized HTML (il browser gestisce la stampa/PDF). Formato unico per piano e lista della spesa
- Storico piani generati consultabile

### 2.4 Monitoraggio progressi

- Log peso: l'utente inserisce il peso periodicamente (max 1 entry al giorno — una nuova entry nello stesso giorno sovrascrive la precedente)
- Grafico andamento peso nel tempo
- Quando il peso cambia ≥ 2kg rispetto al peso usato nell'ultimo ricalcolo (non rispetto all'ultimo log), il sistema ricalcola automaticamente TDEE e macro target e notifica l'utente dei nuovi valori. Questo previene ricalcoli multipli per fluttuazioni giornaliere (es. 75→72→74 non triggera ricalcoli se il peso base è 75)

### 2.5 Profilo e impostazioni

- Aggiornamento dati profilo (ricalcola macro)
- Gestione template salvati
- Gestione alimenti personalizzati
- Gestione abbonamento (Stripe Customer Portal)

---

## 3. Data Model (Convex Schema)

### users

- Dati anagrafici: sesso, data di nascita (età derivata al momento del calcolo), altezza, peso, corporatura
- Obiettivo: `"dimagrimento"` | `"mantenimento"` | `"aumento_massa"` | `"ricomposizione"`
- Livello attività: `"sedentario"` | `"leggermente_attivo"` | `"moderatamente_attivo"` | `"molto_attivo"` | `"atleta"`
- Allergie/intolleranze: `string[]`
- Preferenza alimentare: `"onnivoro"` | `"vegetariano"` | `"vegano"` | `"pescetariano"`
- Seguito da nutrizionista: `boolean`
- Campi calcolati: TDEE (kcal), proteine target (g), carboidrati target (g), grassi target (g), calorie target (kcal)

### foods

- Nome, categoria (es. "cereali", "carni", "latticini")
- Valori per 100g: kcal, proteine (g), carboidrati (g), grassi (g)
- Tag allergeni: `string[]`
- Tipo: `"animale"` | `"vegetale"`
- Source: `"crea"` | `"custom"`
- userId: opzionale — `null` per CREA, valorizzato per alimenti custom
- Query: filtrano per `source === "crea" OR userId === currentUser`

### daily_plans

- userId, data
- Stato: `"draft"` | `"complete"` (draft = in costruzione, complete = finalizzato)
- Pasti: array di `{ tipo ("colazione" | "pranzo" | "cena" | "spuntino"), alimenti: [{ foodId, quantità_g, vincolo_min?, vincolo_max? }] }`
- Macro totali raggiunti: proteine, carboidrati, grassi, kcal
- Macro target snapshot al momento della creazione (non si aggiorna se l'utente modifica il profilo — i piani esistenti restano coerenti con i target originali; i nuovi piani useranno i target aggiornati)
- templateId (se creato da template, opzionale)

### templates

- userId
- Nome (es. "giornata ufficio")
- Configurazione pasti con cibi e vincoli (stessa struttura dei pasti in daily_plans)

### weekly_plans

- userId
- Settimana: data inizio (lunedì)
- 7 daily_plans collegati (riferimenti)
- Lista della spesa: array di `{ foodId, nome, quantità_totale_g, categoria }`
- Stato: `"generato"` | `"modificato"` | `"archiviato"`

### weight_logs

- userId
- Data, peso (kg)
- Macro target al momento della registrazione (snapshot per storico)

### subscriptions

- userId
- Stripe customer ID, subscription ID
- Stato: `"active"` | `"cancelled"` | `"past_due"`
- Data inizio, data prossimo rinnovo

---

## 4. Calculation Engine

### 4.1 TDEE e macro target

**Step 1: BMR (Mifflin-St Jeor)**

- Uomini: `(10 × peso_kg) + (6.25 × altezza_cm) - (5 × età) + 5`
- Donne: `(10 × peso_kg) + (6.25 × altezza_cm) - (5 × età) - 161`

**Step 1b: Aggiustamento corporatura**

- Snello: BMR × 0.95
- Medio: BMR × 1.00
- Robusto: BMR × 1.05

**Step 2: TDEE = BMR_aggiustato × fattore attività**

| Livello              | Fattore |
| -------------------- | ------- |
| Sedentario           | 1.2     |
| Leggermente attivo   | 1.375   |
| Moderatamente attivo | 1.55    |
| Molto attivo         | 1.725   |
| Atleta               | 1.9     |

**Step 3: Calorie obiettivo**

| Obiettivo      | Aggiustamento   |
| -------------- | --------------- |
| Dimagrimento   | TDEE - 500 kcal |
| Mantenimento   | TDEE            |
| Aumento massa  | TDEE + 300 kcal |
| Ricomposizione | TDEE - 150 kcal |

**Step 4: Ripartizione macro (g/kg peso corporeo)**

| Obiettivo      | Proteine | Grassi   | Carboidrati    |
| -------------- | -------- | -------- | -------------- |
| Dimagrimento   | 2.0 g/kg | 0.8 g/kg | per differenza |
| Mantenimento   | 1.6 g/kg | 1.0 g/kg | per differenza |
| Aumento massa  | 2.0 g/kg | 0.8 g/kg | per differenza |
| Ricomposizione | 2.4 g/kg | 0.9 g/kg | per differenza |

Carboidrati "per differenza" = `(calorie_obiettivo - proteine_g × 4 - grassi_g × 9) ÷ 4`

### 4.2 Ottimizzatore quantità cibi (piano giornaliero)

Problema di ottimizzazione lineare:

- **Input**: macro target (P, C, G in grammi), lista cibi scelti per pasto con valori nutrizionali per 100g, vincoli utente (min/max per alimento)
- **Obiettivo**: minimizzare la distanza pesata tra macro raggiunti e macro target (pesi: proteine 1.0, carboidrati 0.8, grassi 0.8 — le proteine hanno priorità)
- **Vincoli**: rispettare i limiti per alimento, quantità ≥ 0, nessun cibo > 500g di default
- **Output**: grammi per ogni alimento per pasto

**Distribuzione per pasto:** il macro target giornaliero è distribuito sui pasti con proporzioni fisse di default:

- Colazione: 25% dei macro giornalieri
- Pranzo: 40%
- Cena: 35%
- Se l'utente aggiunge spuntini, il sistema ridistribuisce: colazione 20%, spuntino mattina 10%, pranzo 35%, spuntino pomeriggio 10%, cena 25% L'ottimizzatore lavora pasto per pasto, allocando i cibi assegnati a quel pasto per raggiungere la quota macro del pasto.

- **Algoritmo**: weighted least-squares — minimizza la somma pesata degli scarti quadratici tra macro target e raggiunti per ogni pasto. Con ~3-5 cibi per pasto e 3 macro, il sistema è sovradeterminato e risolubile analiticamente (pseudo-inversa con vincoli proiettati). Non serve una libreria di LP.
- **Implementazione**: Convex function deterministica
- **Fallback**: se il sistema non riesce a raggiungere i macro con i cibi scelti (scarto > 15%), mostra un avviso con il gap e suggerisce cibi aggiuntivi dal database filtrati per il macro mancante

### 4.3 Generatore piano settimanale (premium, AI)

- **Input**: cibi preferiti dall'utente, macro target, vincoli, allergie/intolleranze
- **Processo**: Convex Action → Vercel AI SDK → OpenRouter → modello configurabile (default: Gemini Flash)
- **Prompt strutturato**: include dati nutrizionali CREA dei cibi scelti, macro target, vincoli
- **Output**: `generateObject` con schema Zod → JSON con 7 giorni × 3 pasti × cibi con quantità
- **Validazione post-AI**: ricalcolo deterministico dei macro dal JSON generato. Se scarto > 5% su un qualsiasi macro, rigenera (max 3 tentativi). Dopo 3 fallimenti, mostra il piano con un avviso ("Il piano generato ha uno scarto di X% sui macro. Puoi modificarlo manualmente o rigenerarlo.") — non bloccare l'utente con un errore secco
- **Lista della spesa**: somma degli alimenti × quantità sui 7 giorni, raggruppata per categoria alimentare

---

## 5. Technical Architecture

### Stack

| Layer     | Technology                                           | Package            |
| --------- | ---------------------------------------------------- | ------------------ |
| Frontend  | Next.js 16, PWA mobile-first, Tailwind v4, shadcn/ui | `apps/web`         |
| Backend   | Convex (queries, mutations, actions, HTTP actions)   | `packages/backend` |
| AI        | Vercel AI SDK + `@openrouter/ai-sdk-provider`        | `packages/backend` |
| Auth      | Better Auth (already configured)                     | `packages/backend` |
| Payments  | Stripe (Checkout + Customer Portal + Webhooks)       | `packages/backend` |
| Shared UI | shadcn components                                    | `packages/ui`      |
| Env vars  | t3-env validation                                    | `packages/env`     |
| Config    | Shared TS configs                                    | `packages/config`  |
| Deploy    | Vercel (frontend) + Convex Cloud (backend)           | —                  |

### Routing (`apps/web/src/app/`)

```
src/app/
├── (marketing)/              ← pagine pubbliche
│   ├── page.tsx              ← homepage / landing
│   ├── pricing/
│   │   └── page.tsx
│   └── layout.tsx
├── (user)/                   ← area riservata (auth required)
│   ├── onboarding/
│   │   └── page.tsx          ← gate legale + questionario (redirect qui dopo signup se profilo incompleto)
│   ├── dashboard/
│   │   └── page.tsx          ← dashboard numbers-first
│   ├── daily-plan/
│   │   └── page.tsx          ← pianificatore giornaliero
│   ├── weekly-plan/
│   │   └── page.tsx          ← piano settimanale (premium)
│   ├── progress/
│   │   └── page.tsx          ← monitoraggio peso
│   ├── settings/
│   │   └── page.tsx          ← profilo + gestione abbonamento
│   └── layout.tsx            ← auth guard + app shell
├── api/auth/[...all]/
│   └── route.ts              ← Better Auth routes
└── layout.tsx                ← root layout + providers
```

### Data flows

**Onboarding:**

```
Browser → Better Auth (signup) → Convex mutation (salva profilo + calcola TDEE/macro) → redirect a dashboard
```

**Piano giornaliero:**

```
Browser → seleziona cibi → Convex query (dati CREA + custom utente) → Convex function (ottimizzatore) → risultato quantità → Convex mutation (salva daily_plan)
```

**Piano settimanale:**

```
Browser → verifica subscription (Convex query) → seleziona cibi settimana → Convex Action (AI SDK → OpenRouter → generateObject) → JSON piano 7gg → validazione deterministica → Convex mutation (salva weekly_plan + lista spesa)
```

**Stripe:**

```
Checkout: Browser → Convex Action (crea Checkout Session) → redirect Stripe → webhook → Convex HTTP Action → mutation (crea subscription)
Gestione: Browser → Convex Action (crea Customer Portal session) → redirect Stripe → webhook → Convex HTTP Action → mutation (aggiorna subscription)
```

**Monitoraggio peso:**

```
Browser → inserisci peso → Convex mutation (salva weight_log) → se Δ ≥ 2kg → ricalcola TDEE/macro → aggiorna profilo utente
```

### PWA

- Service worker: cache pagine principali per uso offline-base
- Manifest: icone, theme color (da palette cliente), display standalone
- Mobile-first: design pensato per smartphone, installabile dal browser

---

## 6. Food Database Strategy

### Livello 1: CREA (verificati) — MVP

- ~900 alimenti dal database ufficiale CREA (Centro di Ricerca Alimenti e Nutrizione)
- Dati accurati e verificati, gratuiti e pubblici
- Badge "verificato" nell'UI
- Non modificabili dagli utenti
- Importati tramite script di seed: una Convex mutation interna (`internal.foods.seedCREA`) che riceve i dati CREA in batch e li inserisce nella tabella `foods`. Eseguita una volta tramite `npx convex run internal.foods.seedCREA` con il JSON dei dati CREA come argomento. I dati CREA sono conservati come file JSON statico in `packages/backend/data/crea-foods.json`

### Livello 2: Alimenti custom (privati per utente) — MVP

- L'utente può aggiungere cibi non presenti nel database
- Campi richiesti: nome, kcal/100g, proteine/100g, carboidrati/100g, grassi/100g
- Visibili solo all'utente che li ha creati
- Hint UX: "Leggi i valori dall'etichetta del prodotto"
- Nessun badge "verificato"
- Limite: max 100 alimenti custom per utente, con indicatore visivo chiaro dello spazio usato (es. "73/100 alimenti personalizzati")

### Livello 3: Promozione a condivisi (fase 2, fuori MVP)

- Admin review degli alimenti custom più inseriti
- Promozione a "verificati dalla community" dopo validazione
- Permette crescita del database mantenendo qualità

---

## 7. Business Model

- **Free tier**: onboarding, calcolo macro, pianificatore giornaliero, template, monitoraggio peso, alimenti custom (max 100)
- **Premium** (abbonamento mensile via Stripe): generazione piano settimanale AI, modifica piano, lista della spesa, storico piani
- **Dopo cancellazione premium**: i piani già generati restano accessibili in sola lettura (read-only). L'utente non può generare nuovi piani né modificare quelli esistenti
- **Prezzo indicativo**: €4.99/mese (benchmark: Melarossa €2.99, MacroFactor €11.99, Eat This Much €8.99)

---

## 8. Scope

### MVP (v1.0)

- Onboarding completo con gate legale e questionario
- Calcolo TDEE + macro (Mifflin-St Jeor + 4 obiettivi)
- Database CREA + alimenti custom privati
- Pianificatore giornaliero con ottimizzatore, vincoli, template
- Piano settimanale AI + lista spesa (premium)
- Stripe: abbonamento mensile + Customer Portal
- Monitoraggio peso con grafico e ricalcolo automatico
- Landing page marketing + pagina pricing
- PWA mobile-first

### Fase 2 (post-lancio)

- Barcode scanner (API esterna prodotti italiani)
- Ricette con porzioni adattate ai macro
- Notifiche push (reminder pasti, log peso)
- Integrazione grocery delivery (Esselunga, Everli)
- Sistema adattivo macro settimanale (stile MacroFactor)
- Social login (Google, Apple)
- Abbonamento annuale con sconto
- Foto recognition piatti (AI vision)
- Promozione alimenti custom a condivisi (admin review)

### Fuori scope (YAGNI)

- App nativa iOS/Android
- Community/social features
- Chat con nutrizionista
- Tracking micronutrienti (vitamine, minerali)
- Integrazione wearables
- Gamification
- Multi-lingua

---

## 9. Competitor Positioning

### Mercato italiano

- **Melarossa** (unico competitor italiano): diete prescritte, non macro-flexible, €2.99/mese, dati CREA
- Nessuna app italiana offre pianificazione macro-based con scelta cibi

### Mercato internazionale

- **MyFitnessPal/Yazio/Lifesum**: tracking-centric (logghi cosa hai mangiato), non pianificazione. Database crowd-sourced con 15-30% varianza. Cibi italiani mal rappresentati
- **MacroFactor**: macro adattivi, ma no pianificazione pasti, no italiano, €11.99/mese
- **Eat This Much**: auto-genera piani ma non lascia scegliere i cibi all'utente. Shopping list. No italiano
- **AutoMealPlanner**: il più vicino al nostro approccio (pick foods → calculate grams) ma web-only, no mobile, no italiano

### Differenziatori Ratio Diet

1. **Approccio inverso**: scegli i cibi, il sistema calcola le quantità (vs "ti dico io cosa mangiare")
2. **Dati italiani verificati**: database CREA (vs crowd-sourced inaffidabile)
3. **Solo italiano**: nessun competitor macro-based serve il mercato italiano
4. **Numbers-first UX**: design centrato sui numeri, pulito, immediatamente leggibile
5. **Prezzo accessibile**: posizionamento tra Melarossa (€2.99) e MacroFactor (€11.99)
