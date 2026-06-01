# BOKARI

### Le journaliste IA africain qui combat la desinformation

---

Bokari est un moteur de recherche IA concu pour l'Afrique. Il cherche, verifie et synthetise l'information en temps reel, avec des sources citees pour chaque reponse. Pas de boite noire, pas de reponses inventees : chaque affirmation est tracable.

Le projet est ne d'un constat simple. L'acces a une information fiable et verifiee est un enjeu majeur sur le continent africain. Bokari est la pour aider les journalistes, les etudiants, les chercheurs et tous ceux qui veulent comprendre le monde avec des faits, pas des rumeurs.

---

## SOMMAIRE

- [Fonctionnalites](#fonctionnalites)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Utilisation](#utilisation)
- [API](#api)
- [Stack technique](#stack-technique)
- [Structure du projet](#structure-du-projet)
- [Contribuer](#contribuer)
- [Licence](#licence)
- [Contact](#contact)

---

## FONCTIONNALITES

### Recherche intelligente

Bokari ne se contente pas de chercher sur Google. Il lance plusieurs requetes en parallele, extrait le contenu complet des pages, et synthetise une reponse claire avec des citations numerotees.

Trois modes de recherche sont disponibles :

- **Rapide** -- Reponse en quelques secondes, 5 a 10 sources consultees
- **Standard** -- Equilibre entre vitesse et profondeur, 15 a 20 sources
- **Approfondie** -- Investigation complete, 30 a 100 sources explorees

### Sources multiples

La recherche couvre plusieurs axes :

- **Web** -- Recherche generale sur internet
- **Academique** -- Articles scientifiques et publications
- **Discussions** -- Forums, reseaux sociaux, debats en ligne

### Widgets contextuels

Des cartes d'information s'affichent automatiquement quand c'est pertinent : meteo, cours boursiers, calculs, et d'autres a venir.

### Recherche d'images et de videos

Bokari peut aussi trouver du contenu visuel en rapport avec votre question, directement dans l'interface de chat.

### Upload de documents

Envoyez un PDF, un fichier texte ou un document Word, et posez des questions dessus. Bokari indexe le contenu et repond avec precision.

### Voix avec ElevenLabs

Synthese vocale et reconnaissance vocale integrees via ElevenLabs, pour une experience plus naturelle.

### Decouverte

Un onglet decouverte affiche les actualites du jour par theme (technologie, science, economie, sport...), pour rester informe sans meme chercher.

### Historique

Chaque conversation est sauvegardee. Vous pouvez retrouver et reprendre n'importe quelle recherche passee.

### Multi-providers IA

Bokari fonctionne avec plusieurs fournisseurs de modeles IA :

- **OpenAI** (GPT-4o, GPT-4o-mini)
- **Anthropic** (Claude Sonnet, Claude Haiku)
- **Google** (Gemini)
- **Groq** (Llama, Mixtral -- gratuit et rapide)
- **Ollama** (modeles locaux, 100% hors-ligne)

### Routing intelligent

Les modeles internes de Bokari (`bokari-1`, `bokari-cheap`) routent automatiquement vers le meilleur modele disponible.

---

## ARCHITECTURE

Bokari suit un pipeline de type RAG (Retrieval-Augmented Generation) :

```
Question utilisateur
       |
       v
  Classification
  (faut-il chercher ? quels widgets ?)
       |
       v
  +----+----+
  |         |
  v         v
Recherche  Widgets
(TinyFish,  (meteo,
 SearXNG)   bourse...)
  |         |
  v         v
Extraction du contenu
(HTML -> Markdown, max 4000 car.)
       |
       v
  Generation de la reponse
  (LLM + citations)
       |
       v
  Streaming SSE vers le client
```

### Moteurs de recherche

- **TinyFish Web Agent** -- Moteur principal, recherche Google via API
- **SearXNG** -- Meta-moteur open source en fallback
- **DuckDuckGo** -- Troisieme niveau de fallback via scraping HTML

### Base de donnees

- **Supabase PostgreSQL** -- Stockage des chats, messages et utilisateurs
- **RLS (Row Level Security)** -- Chaque utilisateur n'accede qu'a ses propres donnees

### Authentification

- **Supabase Auth** -- Inscription, connexion, gestion des sessions
- **Bearer token** -- Toutes les requetes API sont authentifiees

Pour plus de details techniques, voir la [documentation d'architecture](docs/architecture/README.md).

---

## INSTALLATION

### Avec Docker (recommande)

La methode la plus simple. Une seule commande :

```bash
docker run -d -p 3000:3000 -v bokari-data:/home/bokari/data --name bokari dickenai/bokari:latest
```

Ca demarre Bokari avec SearXNG integre. Ouvrez http://localhost:3000 et configurez vos cles API dans l'assistant de configuration.

#### Version slim (sans SearXNG integre)

Si vous avez deja SearXNG qui tourne quelque part :

```bash
docker run -d -p 3000:3000 \
  -e SEARXNG_API_URL=http://votre-searxng:8080 \
  -v bokari-data:/home/bokari/data \
  --name bokari dickenai/bokari:slim-latest
```

#### Build depuis les sources

```bash
git clone https://github.com/nicko858/bokari.git
cd bokari
docker build -t bokari .
docker run -d -p 3000:3000 -v bokari-data:/home/bokari/data --name bokari bokari
```

### Sans Docker

1. Installez Node.js 18+ et npm

2. Clonez le projet :

```bash
git clone https://github.com/nicko858/bokari.git
cd bokari
```

3. Installez les dependances :

```bash
npm install
```

4. Construisez l'application :

```bash
npm run build
```

5. Demarrez :

```bash
npm run start
```

6. Ouvrez http://localhost:3000 et suivez l'assistant de configuration.

### Mode developpement

```bash
npm run dev
```

Le serveur demarre sur http://localhost:3000 avec rechargement automatique.

### Configuration Supabase (obligatoire pour le dev)

Bokari utilise Supabase pour l'auth, les chats, les messages et le feed Discover.

1. Creez un projet sur https://supabase.com (ou reutilisez un projet existant).
2. Dans les reglages du projet, recuperez :
   - **Project URL** (ex. `https://xxxxx.supabase.co`)
   - **anon public key** (cle JWT, commence par `eyJ…`)
   - **service_role key** (cle JWT secrete, ROL `service_role`)
3. Creez un fichier `.env.local` a la racine :

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ…
   SUPABASE_SERVICE_ROLE_KEY=eyJ…
   SUPABASE_PROJECT_ID=xxxxx
   ```

4. Demarrez le serveur : `npm run dev`.
5. Ouvrez http://localhost:3000/setup — la page detecte les tables manquantes et
   affiche un bouton **"Ouvrir le SQL Editor Supabase"** + un bloc SQL
   a copier-coller. Collez dans l'editeur SQL, cliquez **Run**, puis
   revenez sur `/setup` et cliquez sur l'icone de rafraichissement.

   Alternative CLI (recommandee en CI) : creez un personal access token sur
   https://supabase.com/dashboard/account/tokens puis :

   ```bash
   SUPABASE_ACCESS_TOKEN=sbp_… node scripts/apply-migrations.js
   ```

---

## CONFIGURATION

Au premier lancement, un assistant de configuration vous guide. Vous aurez besoin de :

### 1. Un provider LLM (obligatoire)

Choisissez au moins un fournisseur de modele IA :

| Provider   | Modeles recommandes        | Cout      |
|-----------|---------------------------|-----------|
| Groq      | llama-3.3-70b             | Gratuit   |
| Ollama    | llama3.1:8b, mistral      | Gratuit (local) |
| OpenAI    | gpt-4o, gpt-4o-mini      | Payant    |
| Anthropic | claude-sonnet-4-6         | Payant    |
| Google    | gemini-2.0-flash         | Gratuit (limite) |

### 2. Un modele d'embedding (recommande)

Pour la recherche semantique et l'upload de documents :

| Provider | Modele                    | Cout      |
|----------|--------------------------|-----------|
| OpenAI   | text-embedding-3-small   | Payant    |
| Ollama   | nomic-embed-text         | Gratuit (local) |

### 3. ElevenLabs (optionnel)

Pour la synthese vocale et la reconnaissance vocale. Obtenez une cle API sur https://elevenlabs.io.

### Variables d'environnement

La plupart de la configuration se fait via l'interface web. Voir [.env.example](.env.example) pour les options avancees.

---

## UTILISATION

### Interface de chat

Tapez votre question dans la barre de recherche. Bokari va :

1. Analyser votre question
2. Lancer les recherches necessaires
3. Afficher les etapes en temps reel (recherche en cours, sources trouvees...)
4. Generer une reponse avec citations numerotees
5. Afficher les sources cliquables

### Modes de recherche

Cliquez sur l'icone de mode dans la barre de saisie pour choisir :

- **Rapide** (eclair) -- Pour les questions simples
- **Standard** (loupe) -- Usage quotidien
- **Approfondie** (couches) -- Pour les investigations

### Upload de fichiers

Cliquez sur le trombone pour joindre des documents (PDF, DOCX, TXT). Bokari les indexe et vous pouvez poser des questions sur leur contenu.

### Page Decouverte

Accedez a l'onglet "Decouverte" dans la sidebar pour parcourir les actualites du jour par theme.

### Bibliotheque

L'onglet "Bibliotheque" liste toutes vos conversations passees, triees par date.

---

## API

Bokari expose une API REST pour l'integration programmatique.

### Recherche

```
POST /api/search
```

Corps de la requete :

```json
{
  "chatModel": {
    "providerId": "uuid-du-provider",
    "key": "gpt-4o-mini"
  },
  "embeddingModel": {
    "providerId": "uuid-du-provider",
    "key": "text-embedding-3-large"
  },
  "optimizationMode": "balanced",
  "sources": ["web"],
  "query": "Votre question ici",
  "stream": false
}
```

Reponse :

```json
{
  "message": "La reponse generee avec citations...",
  "sources": [
    {
      "content": "Extrait de la source...",
      "metadata": {
        "title": "Titre de la page",
        "url": "https://example.com"
      }
    }
  ]
}
```

Le streaming SSE est disponible avec `"stream": true`.

Pour la documentation complete de l'API, voir [docs/API/SEARCH.md](docs/API/SEARCH.md).

---

## STACK TECHNIQUE

| Composant        | Technologie                          |
|-----------------|--------------------------------------|
| Framework       | Next.js 16 (App Router)             |
| Langage         | TypeScript                           |
| Style           | Tailwind CSS 3.3                     |
| UI              | HeadlessUI, Radix UI, Lucide Icons  |
| Animations      | Framer Motion                        |
| Base de donnees | Supabase PostgreSQL                  |
| ORM             | Drizzle ORM                          |
| Auth            | Supabase Auth                        |
| Recherche       | TinyFish API, SearXNG                |
| LLM             | OpenAI, Anthropic, Google, Groq, Ollama |
| TTS/STT         | ElevenLabs                           |
| Deploiement     | Docker, Node.js                      |

---

## STRUCTURE DU PROJET

```
bokari/
  src/
    app/                    # Pages et routes API (Next.js App Router)
      api/
        chat/               # Endpoint principal du chat
        search/             # API de recherche programmatique
        auth/               # Authentification (register, login, logout)
        chats/              # CRUD des conversations
        discover/           # Flux d'actualites
        tts/                # Text-to-speech (ElevenLabs)
        stt/                # Speech-to-text (ElevenLabs)
      discover/             # Page decouverte
      library/              # Page bibliotheque
      c/[chatId]/           # Page de conversation
    components/             # Composants React
      Chat.tsx              # Composant principal du chat
      Sidebar.tsx           # Navigation laterale
      MessageBox.tsx        # Affichage d'un message
      MessageInput.tsx      # Barre de saisie
      EmptyChat.tsx         # Etat initial (suggestions)
      Settings/             # Dialogues de parametres
      Discover/             # Cartes d'actualites
    lib/
      agents/               # Agents IA
        search/             # Agent de recherche (classifier, researcher, writer)
        media/              # Recherche d'images et videos
      config/               # Gestion de la configuration
      db/                   # Schema et migrations (Drizzle + Supabase)
      hooks/                # Hooks React (useChat, useAuth)
      models/               # Providers de modeles LLM
      prompts/              # Prompts systeme
      supabase/             # Client Supabase (browser + server)
      search.ts             # Backend de recherche TinyFish
      searxng.ts            # Integration SearXNG (fallback)
  public/                   # Assets statiques
  drizzle/                  # Migrations SQL
  docs/                     # Documentation
  docker-compose.yaml       # Configuration Docker
```

---

## CONTRIBUER

Les contributions sont les bienvenues. Consultez le guide [CONTRIBUTING.md](CONTRIBUTING.md) pour les details.

En bref :

1. Forkez le projet
2. Creez une branche (`git checkout -b feature/ma-feature`)
3. Codez et testez
4. Soumettez une Pull Request

Toute contribution doit respecter la licence du projet. Le credit a l'auteur original (Ousmane Dicko / Dicken AI) doit etre maintenu dans tous les forks et travaux derives.

---

## LICENCE

Ce projet est distribue sous une **licence source-available non-commerciale**.

En resume :

- Vous pouvez consulter, forker et modifier le code pour un usage personnel et non-commercial
- Vous devez crediter Ousmane Dicko / Dicken AI dans tout fork ou travail derive
- Toute utilisation commerciale necessite une autorisation ecrite

Pour les details complets, voir le fichier [LICENSE](LICENSE).

Pour une licence commerciale, contactez **ousmane@dickenai.com**.

---

## CONTACT

**Ousmane Dicko** -- Createur de Bokari

- Email : ousmane@dickenai.com
- Projet : Dicken AI

---

*Bokari -- Mars 2026*
*Cree par Ousmane Dicko / Dicken AI*
