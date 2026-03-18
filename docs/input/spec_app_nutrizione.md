# SPECIFICHE APPLICAZIONE

**Working title:** _MacroGuide_  
_(nome provvisorio - suggerirò alternative in fondo)_

## 1. Obiettivo dell’app

Fornire a persone **sane** (non patologiche) uno strumento semplice per:

- capire **quante calorie e macronutrienti** assumere
- scegliere **cosa mangiare**
- ricevere **quantità indicative per alimento**
- mantenere “binari” nutrizionali realistici, non ossessivi

L’app **non sostituisce un nutrizionista** ma funge da:

> _assistente alimentare basato su regole semplici, buon senso e personalizzazione_

---

## 2. Target utenti

- Uomini e donne **30-65 anni**
- Over 40 / Over 50 attenti a:
  - peso
  - composizione corporea
  - salute generale
- Persone:
  - senza patologie
  - che vogliono rimettersi in forma
  - che non vogliono contare tutto al grammo

---

## 3. Posizionamento (importante per UX e copy)

- ❌ no “dieta rigida”
- ❌ no calorie ossessive
- ❌ no giudizio

- ✅ metodo a **binari**
- ✅ libertà di scelta dei cibi
- ✅ numeri **approssimati ma intelligenti**
- ✅ AI come “calcolatore invisibile”

---

## 4. Disclaimer e perimetro legale (fondamentale)

All’avvio e in onboarding:

> “Questa applicazione è rivolta esclusivamente a persone sane.  
> Non fornisce diagnosi né prescrizioni mediche.  
> In presenza di patologie o disturbi alimentari, consultare un professionista.”

Blocco esplicito se l’utente dichiara:

- diabete
- disturbi metabolici
- DCA
- patologie croniche rilevanti

---

## 5. Input utente - dati richiesti

### 5.1 Dati base (obbligatori)

- Età
- Sesso
- Peso (kg)
- Altezza (cm)

### 5.2 Dati fisici avanzati (semi-guidati)

- Tipo di fisico (selezione visuale):
  - Snello
  - Asciutto
  - Normolineo
  - Robusto
  - In carne
- Livello di attività:
  - Sedentario
  - Moderato
  - Attivo
  - Molto attivo
- Allenamento:
  - Nessuno
  - 1-2x settimana
  - 3-4x settimana
  - 5+x settimana

### 5.3 Dati nutrizionali e preferenze

- Allergie / intolleranze:
  - lattosio
  - glutine
  - uova
  - frutta a guscio
  - altro (campo libero)
- Stile alimentare (opzionale):
  - onnivoro
  - pescetariano
  - vegetariano
- Cibi che **non mangio mai** (blacklist)
- Cibi che **mi piacciono molto** (whitelist)

### 5.4 Obiettivo (non aggressivo)

- Rimettermi in forma
- Mantenere il peso
- Dimagrire leggermente
- Migliorare composizione corporea

> Nota: **mai deficit estremi**, massimo range suggerito.

---

## 6. Motore di calcolo (core logic)

### 6.1 Calcolo fabbisogno energetico

Base semplificata (come nel video):

- **1 kcal x kg x 24h**
- Correzione soft:
  - +/- 5-15% in base a:
    - età
    - attività
    - obiettivo

Output:

- Calorie target giornaliere
- Range minimo consigliato (non scendere sotto)

---

### 6.2 Calcolo macronutrienti

Regole iniziali (configurabili):

- **Proteine**
  - 1.6 - 2.2 g / kg
  - default: 2 g/kg se attivo

- **Grassi**
  - 0.8 - 1 g / kg

- **Carboidrati**
  - Per differenza calorica

Output chiaro:

- Grammi di proteine / grassi / carbo
- Calorie per macro
- Percentuale macro (solo informativa)

---

## 7. Scelta dei cibi (logica chiave)

### 7.1 Flusso giornaliero

L’utente seleziona per:

- Colazione
- Pranzo
- Cena
- Spuntini (opzionali)

Per ogni pasto:

- sceglie **gli alimenti**
- imposta eventuali **limiti**
  - “max 50g”
  - “non più di X volte”

---

### 7.2 Motore AI di distribuzione

L’AI:

- prende i macro target
- conosce:
  - valori nutrizionali medi
  - limiti imposti
  - preferenze
- restituisce:
  - **grammi indicativi per alimento**
  - messaggi tipo:
    > “Così resti nei tuoi binari nutrizionali”

Non serve precisione assoluta, ma **coerenza**.

---

## 8. Output per l’utente

### 8.1 Dashboard giornaliera

- Target calorie
- Macro target
- Macro stimati con i cibi scelti
- Indicatori:
  - “Sei in linea”
  - “Leggermente sopra”
  - “Da riequilibrare”

### 8.2 Vista per pasto

- Alimenti scelti
- Quantità suggerite
- Alternative rapide (“puoi sostituire con…”)

---

## 9. Funzioni Premium (monetizzazione)

### 9.1 Piano alimentare settimanale

Input:

- Cibi che voglio mangiare nella settimana
- Frequenza (es. pesce 3x, carne 2x…)

Output:

- Piano settimanale:
  - Colazione / Pranzo / Cena
- Macro rispettati giorno per giorno
- Variazioni automatiche

---

### 9.2 Lista della spesa automatica

- Somma di tutti gli alimenti settimanali
- Quantità cumulative
- Raggruppata per categorie:
  - carne
  - pesce
  - verdura
  - dispensa

Export:

- PDF
- Note
- WhatsApp / Email

---

### 9.3 Storico & adattamento AI

- storico peso (manuale)
- feedback:
  - “troppo difficile”
  - “troppo poco”
- micro-aggiustamenti automatici

---

## 10. Architettura tecnica (vibe coding)

### 10.1 Frontend

- WebApp responsive
- Mobile-first
- Stack possibile:
  - React / Next.js
  - Flutter Web
  - oppure no-code evoluto

### 10.2 Backend / Logica

- Motore regole (deterministico)
- AI per:
  - distribuzione alimenti
  - suggerimenti
  - adattamento

### 10.3 Database

- utenti
- profili nutrizionali
- alimenti (valori medi)
- piani settimanali
- liste spesa

---

## 11. Roadmap MVP

**Fase 1 - MVP**

- Onboarding
- Calcolo macro
- Scelta cibi giornaliera
- Quantità suggerite

**Fase 2**

- Piano settimanale
- Lista spesa

**Fase 3**

- AI adattiva
- Tracking semplificato
- Integrazioni (export, reminder)

---

## 12. Naming - proposte

- MacroGuide
- Binari Alimentari
- EatOnTrack
- SmartMacros
- LineaSemplice
- MacroFlex
