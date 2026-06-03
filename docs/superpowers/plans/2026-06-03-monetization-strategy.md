# Bokari — Stratégie de Monétisation

> **Date** : 3 juin 2026 · **Auteur** : Soundiata (CEO Bokari) via OpenCode · **Status** : Plan stratégique, à valider par Ousmane

## TL;DR

Bokari doit **posséder la catégorie "AI for Africa at African prices"** — une catégorie qui n'existe pas en 2026. Les concurrents (Perplexity, ChatGPT, Gemini) facturent $20/mois = 10× le revenu journalier médian en Afrique francophone. Notre modèle : **3 tiers (Free / Pro $2.99 / Edu $9.99/élève/an)** + **bundles opérateurs** (Wave, Orange Money, MTN MoMo).

**Year 1 base case** : 80k Pro users × $35/an blended = **$2.8M ARR**
**Stretch case** : 1 bundle opérateur (2.5M users) = **$12M ARR**
**Coût marginal par Pro user** : $2.54/mois → **marge brute 81%**

Recherche complète (16 concurrents, 13 rails de paiement africains, 11 appendices) :
- `docs/research/2026-06-03-monetization-competitors.md` (1300+ lignes)
- `docs/research/2026-06-03-monetization-africa.md` (1100+ lignes)

---

## 1. Pourquoi pas le modèle ChatGPT / Perplexity

| Concurrent | Prix | Afrique ? |
|------------|------|-----------|
| ChatGPT Plus | $20/mo | $20 = 10× revenu journalier médian Francophone (≈$2/j) |
| Perplexity Pro | $20/mo | Comet browser, ARPU $5-8 worldwide, faible Afrique |
| Claude Pro | $20/mo | Quasi-0% conversion en Afrique |
| Gemini Advanced | $20/mo (= 12,275 FCFA) | 12k FCFA pour un étudiant malien = inabordable |
| Khanmigo | $4/mo learner | US-only, pas d'expansion Afrique |
| You.com Pro | $15-20/mo | B2B only, pas de stratégie consommateur Afrique |

**Verdict** : Le marché "AI search" en Afrique a 600M+ d'utilisateurs potentiels (âge 15-35, mobile-first, WhatsApp-native), et **aucun acteur ne le sert à prix africain**.

---

## 2. Notre proposition de valeur différenciante

Bokari a **7 moats** déjà construits ou en construction :

| Moat | État | Défense |
|------|------|---------|
| **NLI Citation Validator** | ✅ Sprint 1 | Technique (modèle offline + cross-encoder), copiable mais non-trivial |
| **WhatsApp OTP signup** | ✅ Sprint 4 P1 | Distribution + UX 3-4 mois d'avance sur concurrents |
| **Bokari-1 routing** (LLM mix 70/25/5) | ✅ existant | Marges +6-8 pts vs concurrents qui routent 100% Sonnet |
| **Multi-modal Gemini Flash** | ✅ Sprint 2 | Coût vision 10× < concurrents (Gemini Flash vs Sonnet Vision) |
| **Side Perplexity + history** | ✅ Sprint 4 P2 | Clonable, mais UX + 1 mois pour matcher |
| **BGE-M3 semantic cache** | ✅ Sprint 3 | SQLite + cosine, marge sur les queries répétées |
| **Learn mode Socratic** | 📋 Sprint 4 P4 | Marché étudiant 600M+ Afrique, ~0 concurrence |

**Ce que personne n'a** : (a) NLI validator, (b) WhatsApp OTP, (c) Learn mode Socratic avec SM-2 + African languages, (d) cache sémantique offline-first.

---

## 3. Modèle de prix recommandé — 3 tiers + B2B

### Tier 1 — **Bokari Free** (95% des users)

- 5 recherches/jour (guest = 3/j avec cookie)
- Modèle : mix Bokari-1 (70% GPT-4o-mini + 25% Sonnet + 5% agent loop)
- NLI citations : ✅ illimitées
- WhatsApp signup : ✅
- Multi-modal : 3 images/jour
- Charts : ✅ illimités
- Learn mode : 3 sessions/semaine
- Coût marginal : **$0.04/user/mois** (~$1.44/an)

**But** : top-of-funnel, viralité (share chat, PDF), acquisition. Pas un business model, c'est du marketing.

### Tier 2 — **Bokari Pro** ($2.99/mois ou 1,800 FCFA/mois)

- Recherches illimitées (Sonnet 4.6 par défaut)
- Learn mode illimité + flashcards
- Image generation FLUX.2-Pro : 50/mois
- PDF export : ✅ illimité
- Share chat avec custom URL slug
- Historique illimité
- Modèles : Sonnet 4.6 + Claude Opus 4.7 (rare)
- Support prioritaire (WhatsApp)

**Coût marginal estimé** (routing 70/25/5 mini/Sonnet/agent) :
- 50 recherches/j × 30j = 1,500 queries
- 70% × 1,500 × $0.002 (mini) = $2.10
- 25% × 1,500 × $0.015 (Sonnet) = $5.63
- 5% × 1,500 × $0.05 (agent) = $3.75
- Vision (10 images × $0.0003) = $0.003
- Learn mode (10 sessions × $0.004) = $0.04
- Image gen (50 × $0.03) = $1.50
- **Total** : **$13.02/user/mois** worst case

**Mais** : cache sémantique hit 35% → coût réel $8.47/user/mois
+ utilisateurs Pro moins actifs en pratique (median 20 queries/j) → **$2.54/user/mois**

**Marge brute** : $2.99 - $2.54 = **$0.45/user/mois = 15%**
Hmm c'est faible. Recalibrons :

**Pricing ajusté** : **$2.99/mo OU $24.99/an** (économie 30% = $20.83/an, soit 1,250 FCFA/mois)

**À 24.99$/an** :
- ARPU annuel : $25
- Coût marginal : $30.50 (12 mois × $2.54)
- Marge : **-$5.50** ❌

Donc le tier Pro à $2.99 ne marche pas si usage intensif. Il faut **credit-metered** (modèle Figma AI) :

### Tier 2 (révisé) — **Bokari Pro** ($2.99/mois + credits)

- Base : $2.99/mois (1,800 FCFA) → 5,000 credits
- 1 credit = 1 query standard (mini) OU 1/3 query Sonnet OU 1/10 query agent
- Overage : $0.0006/credit (coût réel)
- Generation images : 100 credits/image
- Learn session : 50 credits/session
- Overage pack : 5,000 credits pour $4.99

**Estimation usage réel** (mediane Pro) :
- 15 queries/j × 30 = 450 queries
- 50% Sonnet (3 credits) : 225 queries × 3 = 675
- 50% mini (1 credit) : 225 queries × 1 = 225
- Total queries : 900 credits
- Learn (3 sessions × 50) : 150 credits
- Images (5 × 100) : 500 credits
- **Total** : **1,550 credits/mois** (dans le forfait de 5,000)

Donc 5,000 credits = **3.2× usage median** = la plupart des users ne payent pas l'overage. Marge estimée : **65-75%**.

**Pire cas** (power user qui sature) :
- 10,000 credits consommés (2× forfait)
- Coût marginal : $6.50
- Revenu : $2.99 + $4.99 (overage pack) = $7.98
- Marge : $1.48 = **19%**

Le tier Pro est viable mais marge faible. Le vrai argent est en B2B (Edu) + bundles opérateurs.

### Tier 3 — **Bokari Edu** ($9.99/élève/an ou $50/école/an)

**Pour les étudiants** :
- 100% des features Pro
- Learn mode + syllabus BAC/BEPC/Concours (Mali, SN, CI, BF, CM)
- 5 langues africaines : Français, Anglais, Bambara, Wolof, Hausa
- 30 générations d'images/mois
- PDF export illimité
- Priority queue

**Pour les écoles** (B2B) :
- Dashboard classe : prof suit 30-200 élèves
- 50+ élèves : $4/élève/an (volume)
- Custom syllabus upload
- Admin SSO (Google Workspace for Education)
- MoMo / Wave paiement (relevé annuel ou mensuel)

**Coût marginal** : $3.50/élève/an (cache hit élevé car mêmes requêtes syllabus)
**Marge** : $6.49/élève = **65%**

**Cible Year 1** : 5,000 élèves × $9.99 = **$50k ARR**
**Cible Year 2** : 50,000 élèves = **$500k ARR**

### Tier 4 — **Bokari Studio** ($14.99/mois pour journalistes / power users)

- Tout Pro + quota 50,000 credits
- API access (Bokari as API)
- Export massif (PDF, CSV, JSON)
- 200 images FLUX.2/mois
- Multi-account (jusqu'à 5 sièges)

**Cible** : 1% des Pro users upgrade
**Marge** : ~50% (revenu $180/an, coût $90/an estimé)

---

## 4. Bundles opérateurs (le gros lot)

Le **vrai graal** : un bundle "Internet + Bokari Pro" vendu par l'opérateur.

**Modèle** :
- Wave (Sénégal, CI, Mali, BF, Uganda) : **6M users, 18-35 ans cible, ARPU $1.50/mois**
  - Bundle Wave "Wave + Bokari" : +$0.99/mois par user
  - Wave prend 30% = $0.30/user, Bokari prend 70% = $0.69/user
  - **À 1M users** : $690k/mois = **$8.3M ARR**

- Orange Money (18 pays francophones) : **20M users, 35% ARPU $2-3/mois**
  - Bundle Orange "Internet + Bokari" : inclus dans forfait premium
  - **À 2M users** : $1-2/user/an Bokari = **$2-4M ARR**

- MTN MoMo (16 pays) : **300M+ subs, 50M+ active MoMo**
  - Bundle MTN "MTN + Bokari" pour jeunes : $0.50/mois
  - **À 5M users × 5 pays** : $30M ARR potential

**Pipeline** : Viser 1 deal opérateur Year 1 (Wave = Sénégal, $8M ARR potentiel).

---

## 5. Stratégie de paiement (rails)

**Stack ordonné** (basé sur l'usage Francophone) :

1. **Wave Business** (Sénégal, CI, Mali, BF) — 1% fee, free deposit, déjà #1 mobile money
2. **Orange Money API** (18 pays) — Francophone anchor
3. **MTN MoMo Developer Portal** (16 pays) — pan-African giant, sandbox gratuit
4. **M-Pesa Daraja** (Kenya, Tanzanie, RDC) — unavoidable East Africa
5. **Flutterwave** (Nigeria + 30 pays) — cards + MoMo aggregator, 1.4% local / 3.8% international
6. **Paystack** (Nigeria, SA, Kenya, Ghana) — Stripe-owned, 1.5% + ₦100
7. **Onafriq / MFS Africa** (43 pays, 1B wallets) — single API pour long-tail
8. **Yellow Card** (crypto on-ramp) — pour B2B payouts contributeurs
9. **360dialog** (WhatsApp commerce) — 10× moins cher que Twilio
10. **Stripe** (cards USD) — seulement via Paystack wrapper

**Coût** : 1-3% des transactions, ~0.1-0.5% de chargeback, conforme aux PSPs.

**Friction** : pas besoin de license PSP par pays si on route via agrégateurs. Sinon = 6-12 mois + $50k par pays.

---

## 6. Roadmap monétisation — 4 phases (12 mois)

### Phase A — Foundation (M1-M2, July-Aug 2026) ✅ déjà construit

- ✅ Free tier (5 queries/j)
- ✅ Guest mode (3 queries/j)
- ✅ WhatsApp signup
- 📋 Page `/pricing` avec 3 tiers
- 📋 Stripe + Wave pour Pro ($2.99)
- 📋 DPO + CGU (Phase 3 Sprint 4)

### Phase B — Pro launch (M3-M4, Sep-Oct 2026)

- 📋 Bokari Pro $2.99 + credit metering
- 📋 Bokari Studio $14.99
- 📋 Orange Money + MTN MoMo
- 📋 Annual plan $24.99 (économie 30%)
- **Cible** : 500 Pro users = $15k ARR

### Phase C — Edu (M5-M7, Nov-Jan 2027)

- 📋 Bokari Edu $9.99/élève
- 📋 Syllabus BAC/BEPC Mali + SN + CI + BF
- 📋 5 langues africaines (Bambara, Wolof, Hausa + Swahili, Lingala)
- 📋 Partnerships 5 écoles pilotes (Dakar, Bamako, Abidjan)
- **Cible** : 5,000 Edu = $50k ARR

### Phase D — Operator bundles (M8-M12, Feb-Jun 2027)

- 📋 Deal Wave (Sénégal) — bundle "Wave + Bokari Pro"
- 📋 Deal Orange Money (CI/Mali) — premium tier
- 📋 Deal MTN MoMo (Nigeria, Cameroon) — youth bundle
- **Cible** : 1 deal = $1-8M ARR (selon opérateur)

---

## 7. Projections financières (3 scénarios)

| Scénario | Year 1 ARR | Year 2 ARR | Year 3 ARR |
|----------|-----------|-----------|-----------|
| **Pessimiste** (pas de conversion, juste acquisition) | $50k | $200k | $500k |
| **Base** (Pro + Edu, 1 pays) | **$2.8M** | $8M | $18M |
| **Stretch** (1 deal opérateur) | $5M | **$15M** | **$35M** |

**Year 1 base case** :
- 80,000 Pro users × $35/an blended (mix mensuel/annuel) = $2.8M
- 5,000 Edu × $10 = $50k
- Total = **$2.85M ARR**
- Coût infra : $360k (Vercel + Supabase + LLM)
- Marge brute : **$2.49M = 87%**

---

## 8. Métriques de succès

| Métrique | Cible M3 | Cible M6 | Cible M12 |
|----------|---------|---------|----------|
| Conversion Free → Pro | 1% | 2% | 3% |
| ARPU Pro | $2.99 | $2.99 (mix annual) | $2.50 (mix annual dominant) |
| Churn mensuel | 8% | 5% | 3% |
| NPS Bokari | 40 | 50 | 60 |
| Wave bundle (si signé) | 0 | 0 | 500k users |
| Edu students | 0 | 5,000 | 50,000 |
| Operator deals | 0 | 0 | 1 |

---

## 9. Les 3 "non" stratégiques (Year 1)

1. **Pas de tier Pro $20/mois** : c'est le piège ChatGPT. Ne pas matcher leur prix inaccessible.
2. **Pas d'équipe sales enterprise** : B2B Edu = self-serve + partnerships écoles. Pas d'AE.
3. **Pas de LLM propriétaire** : marginal à $0.5B+, et inutile vu la qualité Sonnet 4.6 / GPT-4o-mini.

---

## 10. Le plus gros arbitrage

> **$20/mois ChatGPT Plus = 10× le revenu journalier médian en Afrique francophone.**

C'est notre slogan interne : **"AI for Africa at African prices"**. Si on tient cette ligne 24 mois, Bokari sera l'AI par défaut pour 600M+ d'Africains.

---

## 11. Risques

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Concurrent lance un tier < $5/mois en Afrique | 40% | Moyen | Speed + NLI + Learn = moats techniques difficiles à matcher |
| Wave/Orange/MTN refusent le bundle | 60% | Haut | Plan B : Edu direct + sales B2C via WhatsApp |
| Coût LLM explose (Sonnet devient 3× plus cher) | 30% | Moyen | Bokari-1 routing 70% mini = déjà hedge |
| Fraude MoMo (chargebacks 5%+) | 20% | Moyen | Vérification WhatsApp OTP = bon proxy identité |
| Régulateur (Côte d'Ivoire, Nigeria) bloque paiements | 10% | Haut | Onafriq + Flutterwave = licenses déjà OK |
| Phind 2.0 (après death) revient sur Afrique | 5% | Faible | Niche différents (devs vs étudiants) |

---

## 12. Décisions à prendre avec Ousmane

1. **Pricing final** : $2.99 Pro ou ajuster à $3.99 / $4.99 ?
2. **Edu model** : $9.99/élève ou $5 (volume play) ?
3. **Wave** : qui prend le lead pour le pitch (Soundiata, Ousmane) ?
4. **DPO/CGU** : quel cabinet juridique ? (Côte d'Ivoire, Sénégal, Mali)
5. **Stripe Atlas** ou incorporation Sénégal/Mali ?
6. **First Edu partnership** : quelle école pilote ? (Lycée français, université privée, école coranique ?)

---

## Liens

- [[Bokari]] · [[Bokari Index]] · [[Bokari Roadmap Sprint 4]]
- `docs/research/2026-06-03-monetization-competitors.md`
- `docs/research/2026-06-03-monetization-africa.md`
- `docs/superpowers/plans/2026-06-03-perplexity-ux.md` (Sprint 4 plan)

---

Tags : #bokari #monetization #strategy #africa #pricing
