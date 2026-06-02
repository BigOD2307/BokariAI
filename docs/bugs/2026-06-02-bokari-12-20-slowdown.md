# Bug Bokari — "12-20 il bug, il s'éteint, il est lent"

**Date** : 2026-06-02
**Signalement** : Ousmane Dicko
**Sévérité** : haute (bloque l'usage au-delà de ~15 messages)
**Phase** : Diagnostic + correctifs urgents

---

## Symptômes

- Bokari fonctionne bien pour les premières requêtes
- À partir de ~12-20 requêtes, **devient très lent**
- Puis **s'éteint / ne répond plus**
- Le "slug" (requêtes lourdes) aggrave le problème

## Diagnostic

J'ai inspecté 4 zones chaudes : `src/lib/hooks/useChat.tsx`,
`src/app/api/chat/route.ts`, `src/lib/agents/search/index.ts`,
`src/lib/agents/search/researcher/index.ts`, `src/lib/session.ts`.

### 🐛 Bug #1 — Historique de chat non tronqué (CAUSE PRINCIPALE)
**Fichier** : `src/lib/hooks/useChat.tsx:277` + `src/app/api/chat/route.ts:136-140`
**Symptôme** : `chatHistory.current` est un `useRef` qui **croît indéfiniment**.
À chaque message, le client envoie **TOUT l'historique** au serveur. Le serveur
le repasse à l'agent qui le balance **en entier** au LLM (writer stage).
- À 12 messages : ~6k tokens par requête writer
- À 20 messages : ~12k tokens par requête writer
- À 50 messages : ~30k tokens → Groq (Llama 70B) commence à ralentir sérieusement
- **Le LLM ne time out pas** → la requête hang plusieurs minutes → "s'éteint"

### 🐛 Bug #2 — Aucun timeout sur le stream LLM
**Fichier** : `src/lib/agents/search/index.ts:184` + `:86-148` (researcher)
**Symptôme** : `for await (const chunk of answerStream)` n'a pas de timeout.
Si Groq ou OpenRouter freeze (rate limit non catché, blip réseau, etc.),
**la requête hang indéfiniment** côté serveur. Le client attend, attend,
attend, puis finit par timeout côté navigateur. Le serveur garde les
ressources (session, emitter, model instances).

### 🐛 Bug #3 — Reconnect échoue silencieusement
**Fichier** : `src/lib/hooks/useChat.tsx:417-470`
**Symptôme** : `checkReconnect` lit le stream SSE du backend
`/api/reconnect/${backendId}`. Si :
- le backendId a expiré (TTL SessionManager = 30 min)
- le reader n'envoie jamais rien (connection idle)
Le client reste bloqué sur "answering" **sans feedback**.
**L'utilisateur voit un Bokari "mort"** alors qu'il faut juste un refresh.

### 🐛 Bug #4 — Le tableau `events` du SessionManager croît sans limite
**Fichier** : `src/lib/session.ts:15` + `:47`
**Symptôme** : Chaque `emit()` push dans `this.events[]`. Pour un deep search
(35 itérations × 3 actions = 100+ emits), ça peut faire 50+ MB de mémoire
gardée 30 min. Le `subscribe()` rejoue TOUS les events au nouveau
subscriber → gros `JSON.stringify` à sérialiser pour le SSE.

### 🐛 Bug #5 — Le prompt du writer peut devenir gigantesque
**Fichier** : `src/lib/agents/search/index.ts:153-165`
**Symptôme** : `finalContext` met TOUS les search results dans le prompt
du writer. Pour un deep search avec 100 sources, c'est 200k+ tokens.
Le LLM rejette ou tronque. L'agent se perd. **Boucle possible.**

## Plan de correctifs

| # | Fix | Effort | Impact |
|---|---|---|---|
| 1 | Truncate chat history client-side à 8 messages avant envoi | 1 ligne + test | **Élevé** — résout le bug 12-20 |
| 2 | Ajouter un timeout (60s premier chunk, 30s entre chunks) sur les streams LLM | ~30 lignes + tests | **Élevé** — empêche les hangs |
| 3 | Client-side timeout sur reconnect (5s premier event, abort + recover) | ~20 lignes + test | Moyen — UX |
| 4 | Cap `events` du SessionManager à 50 entries (FIFO) | ~5 lignes + test | Moyen — perf + mem |
| 5 | Cap les search results envoyés au writer à top 8 | ~3 lignes + test | Moyen — deep search |

## Tests à ajouter

- `tests/hooks/useChat-history-cap.test.ts` (logique pure de truncation)
- `tests/agents/llmStream-timeout.test.ts` (race entre stream et timer)
- `tests/session-events-cap.test.ts`
- `tests/agents/writer-context-cap.test.ts`

## Ce qu'on ne fait PAS dans ce correctif

- Refonte du prompt de l'agent (out of scope, suivi Phase 9.5)
- Limitation du nombre d'iterations du researcher (déjà fait via `maxIteration` par mode)
- Migration de SessionManager vers Redis (out of scope, suivi Phase 11)
- Pagination des events SSE (suivi Phase 11)
