/**
 * Seed articles — the original editorial set, retaxed into the 6 news beats.
 *
 * Inserted once (as `published`, origin `seed`) the first time the articles
 * table is empty, so the blog isn't a blank page on a fresh deploy. The
 * autonomous generator then fills every beat over time (one article / 5h).
 */
import type { NewArticleInput } from './store';

export const SEED_ARTICLES: NewArticleInput[] = [
  {
    slug: 'desinformation-afrique-ouest-5-intox-demontees',
    category: 'politique',
    featured: true,
    status: 'published',
    origin: 'seed',
    publishedAt: '2026-06-04',
    readingMinutes: 6,
    title: "Désinformation en Afrique de l'Ouest : 5 intox démontées cette semaine",
    excerpt:
      "De fausses annonces gouvernementales aux photos sorties de leur contexte, Bokari a recoupé les sources et démêlé le vrai du faux.",
    body: `Chaque semaine, des dizaines de messages se propagent sur WhatsApp et les réseaux sociaux ouest-africains. Beaucoup sont faux. Voici cinq affirmations virales, passées au crible — sources à l'appui.

## 1. « Le gouvernement supprime les frais de scolarité dès septembre »

Aucune source officielle ne confirme cette annonce. Le ministère de l'Éducation n'a publié aucun communiqué en ce sens, et les agences de presse n'en font pas état [1]. La rumeur s'appuie sur une capture d'écran retouchée d'un site d'actualité.

**Verdict : faux.**

## 2. Une photo « d'inondations récentes » qui date de 2019

L'image partagée des milliers de fois provient en réalité d'un reportage publié il y a plusieurs années [2]. Une recherche d'image inversée situe le cliché à une autre saison et une autre ville.

**Verdict : sorti de son contexte.**

## 3. « Une nouvelle monnaie remplace le franc CFA la semaine prochaine »

Les institutions monétaires régionales n'ont annoncé aucun calendrier de ce type [3]. La réforme évoquée est un projet de longue haleine, sans date de bascule imminente.

**Verdict : trompeur.**

## 4. Un faux remède « miracle » attribué à un hôpital connu

L'établissement cité dément formellement, et aucune étude évaluée par des pairs n'appuie l'affirmation [4]. Partager ce type de contenu peut mettre des vies en danger.

**Verdict : faux et dangereux.**

## 5. Une citation inventée prêtée à une personnalité publique

La déclaration n'apparaît dans aucune interview ni archive vérifiable [5]. L'intéressé n'a jamais tenu ces propos.

**Verdict : citation fabriquée.**

## Comment vérifier soi-même

Avant de partager, posez-vous trois questions : qui est la source d'origine, quand l'information date-t-elle, et d'autres médias fiables la confirment-ils ? En cas de doute, demandez à Bokari : il cherche, recoupe et cite ses sources pour chaque réponse.`,
    sources: [
      { id: 1, title: "Communiqués du ministère de l'Éducation", outlet: 'Source officielle', url: 'https://example.org/education' },
      { id: 2, title: 'Reportage original sur les inondations (archive)', outlet: 'AFP', url: 'https://example.org/archive-2019' },
      { id: 3, title: 'Point sur la réforme monétaire régionale', outlet: 'BCEAO', url: 'https://example.org/monnaie' },
      { id: 4, title: "Démenti officiel de l'hôpital", outlet: 'Communiqué', url: 'https://example.org/dementi' },
      { id: 5, title: "Archives d'interviews de la personnalité", outlet: 'Jeune Afrique', url: 'https://example.org/archives' },
    ],
  },
  {
    slug: 'mobile-money-comment-wave-bouscule-le-marche',
    category: 'business',
    status: 'published',
    origin: 'seed',
    publishedAt: '2026-06-03',
    readingMinutes: 5,
    title: 'Mobile money : comment Wave bouscule le marché en Afrique francophone',
    excerpt:
      "Des frais cassés, une app simple, une croissance fulgurante : décryptage vérifié de la montée du paiement mobile, sources citées.",
    body: `Le paiement mobile a changé le quotidien de millions de personnes en Afrique de l'Ouest. Au cœur de cette bascule : une nouvelle vague d'acteurs qui ont divisé les frais et simplifié l'usage.

## Des frais qui s'effondrent

Là où les transferts coûtaient parfois plusieurs pourcents, les nouveaux entrants ont imposé une tarification bien plus basse, forçant tout le marché à s'aligner [1]. Pour les ménages, l'économie est concrète.

## L'effet réseau

Plus il y a d'agents et d'utilisateurs, plus le service devient utile — un cercle vertueux classique des plateformes [2]. Les zones rurales, longtemps mal desservies par la banque traditionnelle, en profitent particulièrement.

## Ce que ça change pour l'inclusion financière

L'accès à un compte, même minimal, ouvre la porte à l'épargne, aux paiements marchands et au crédit [3]. Les institutions régionales suivent de près ces évolutions pour adapter la régulation.

## À retenir

La concurrence sur les frais et la simplicité d'usage sont les deux moteurs de l'adoption. Pour comprendre un acteur précis ou un chiffre, demandez à Bokari : chaque réponse arrive avec ses sources.`,
    sources: [
      { id: 1, title: 'Comparatif des frais de transfert mobile', outlet: 'TechCabal', url: 'https://example.org/frais' },
      { id: 2, title: "Dynamiques d'adoption du mobile money", outlet: 'GSMA', url: 'https://example.org/gsma' },
      { id: 3, title: "Rapport sur l'inclusion financière", outlet: 'Banque mondiale', url: 'https://example.org/inclusion' },
    ],
  },
  {
    slug: 'elections-2026-verifier-un-resultat-avant-de-partager',
    category: 'politique',
    status: 'published',
    origin: 'seed',
    publishedAt: '2026-06-02',
    readingMinutes: 4,
    title: 'Élections 2026 : comment vérifier un résultat avant de le partager',
    excerpt:
      "En période électorale, les faux chiffres circulent vite. Voici la méthode de Bokari pour ne relayer que des résultats vérifiés.",
    body: `Pendant un scrutin, chaque heure apporte son lot de chiffres « officiels » sur les réseaux. Beaucoup sont prématurés, partiels, ou tout simplement inventés. Voici comment faire le tri.

## Remontez à la source officielle

Seuls l'organe électoral compétent et, le cas échéant, les juridictions habilitées proclament des résultats valides [1]. Un score relayé par un compte anonyme, sans lien vers une source institutionnelle, ne vaut rien.

## Méfiez-vous des résultats « définitifs » trop tôt

Le dépouillement prend du temps. Un total présenté comme final alors que tous les bureaux n'ont pas transmis leurs procès-verbaux est un signal d'alerte [2].

## Recoupez plusieurs médias fiables

Si une seule source porte un chiffre que personne d'autre ne confirme, attendez. Les rédactions sérieuses recoupent avant de publier [3].

## En cas de doute

Demandez à Bokari : il cherche les communiqués officiels, recoupe les médias et cite chaque source — pour que vous partagiez du vérifié, pas du viral.`,
    sources: [
      { id: 1, title: "Rôle des organes de gestion des élections", outlet: 'IDEA International', url: 'https://example.org/elections-idea' },
      { id: 2, title: 'Bonnes pratiques de proclamation des résultats', outlet: 'Union africaine', url: 'https://example.org/ua-resultats' },
      { id: 3, title: 'Charte de vérification des rédactions', outlet: 'Reporters sans frontières', url: 'https://example.org/rsf' },
    ],
  },
  {
    slug: 'ia-en-afrique-ce-que-peut-vraiment-un-assistant-comme-bokari',
    category: 'tech-science',
    status: 'published',
    origin: 'seed',
    publishedAt: '2026-06-01',
    readingMinutes: 5,
    title: "IA en Afrique : ce que peut (et ne peut pas) vraiment un assistant comme Bokari",
    excerpt:
      "Entre promesses et limites, une mise au point honnête sur les assistants IA — et pourquoi citer ses sources change tout.",
    body: `Les assistants IA se multiplient. Certains promettent monts et merveilles. Voici une lecture sobre de ce qu'ils apportent réellement — et de leurs angles morts.

## Ce qu'ils font bien

Chercher, résumer et reformuler de grandes quantités d'information en quelques secondes : c'est leur force [1]. Pour une question factuelle bien posée, un bon assistant fait gagner un temps précieux.

## Là où ils se trompent

Un modèle peut « halluciner » : produire une réponse fluide mais fausse, surtout sans accès à des sources à jour [2]. C'est le risque numéro un, et il est invisible si la réponse n'est pas sourcée.

## Pourquoi les sources changent tout

Un assistant qui cite chaque affirmation permet de vérifier d'un clic. C'est le parti pris de Bokari : chercher sur le web, recouper, puis citer — pour que la confiance se gagne sur des preuves, pas sur le ton [3].

## À retenir

Un assistant IA est un outil de recherche, pas un oracle. Bien utilisé — et sourcé — il combat la désinformation au lieu de l'amplifier.`,
    sources: [
      { id: 1, title: "Capacités des grands modèles de langage", outlet: 'Stanford HAI', url: 'https://example.org/hai' },
      { id: 2, title: "Comprendre les hallucinations des modèles", outlet: 'MIT Technology Review', url: 'https://example.org/hallucinations' },
      { id: 3, title: "Génération augmentée par la recherche (RAG)", outlet: 'Documentation technique', url: 'https://example.org/rag' },
    ],
  },
  {
    slug: 'education-numerique-tient-il-ses-promesses-dans-les-ecoles',
    category: 'tech-science',
    status: 'published',
    origin: 'seed',
    publishedAt: '2026-05-31',
    readingMinutes: 4,
    title: "Éducation : le numérique tient-il ses promesses dans les écoles ?",
    excerpt:
      "Tablettes, cours en ligne, IA : entre espoirs et réalité du terrain, Bokari fait le point, sources à l'appui.",
    body: `Le numérique éducatif est présenté comme une révolution. Sur le terrain, le bilan est plus nuancé — et instructif.

## Un accès encore inégal

Sans électricité fiable ni connexion abordable, les outils numériques restent hors de portée de nombreuses écoles [1]. La fracture d'usage double la fracture d'équipement.

## L'outil ne remplace pas l'enseignant

Les études convergent : la technologie aide quand elle accompagne un bon enseignement, pas quand elle prétend le remplacer [2]. La formation des enseignants est le vrai levier.

## Des réussites bien réelles

Là où le contenu est adapté à la langue et au programme local, et où les enseignants sont formés, les progrès sont mesurables [3].

## À retenir

Le numérique éducatif n'est ni miracle ni gadget : son effet dépend des conditions de mise en œuvre. Pour vérifier un chiffre ou une étude, demandez à Bokari.`,
    sources: [
      { id: 1, title: "Connectivité et accès à l'électricité des écoles", outlet: 'UNESCO', url: 'https://example.org/unesco' },
      { id: 2, title: "Technologie et résultats d'apprentissage", outlet: 'Banque mondiale', url: 'https://example.org/edtech' },
      { id: 3, title: "Études de cas d'EdTech localisée", outlet: 'UNICEF', url: 'https://example.org/unicef' },
    ],
  },
  {
    slug: 'diaspora-ce-que-pesent-vraiment-les-transferts-vers-afrique',
    category: 'business',
    status: 'published',
    origin: 'seed',
    publishedAt: '2026-05-30',
    readingMinutes: 5,
    title: "Diaspora : ce que pèsent vraiment les transferts d'argent vers l'Afrique",
    excerpt:
      "Plus que l'aide publique dans bien des pays : les envois de la diaspora, en chiffres vérifiés et remis en contexte.",
    body: `Les envois d'argent de la diaspora sont un pilier discret mais massif de nombreuses économies du continent. Décryptage chiffré.

## Un flux qui dépasse souvent l'aide

Dans plusieurs pays, les transferts des migrants représentent une part du revenu national supérieure à l'aide publique au développement [1]. C'est un soutien direct aux ménages.

## Des frais qui grignotent les montants

Envoyer 100 € peut coûter plusieurs euros de frais selon le corridor — un poste que les institutions cherchent à réduire [2]. Chaque point de pourcentage gagné, c'est de l'argent en plus pour les familles.

## Un usage très concret

Santé, scolarité, logement, petits commerces : l'essentiel des fonds finance des besoins quotidiens et de l'investissement local [3].

## À retenir

Les transferts de la diaspora sont un amortisseur économique majeur. Pour un chiffre précis par pays, demandez à Bokari — réponse sourcée garantie.`,
    sources: [
      { id: 1, title: "Migration and Development Brief", outlet: 'Banque mondiale / KNOMAD', url: 'https://example.org/knomad' },
      { id: 2, title: 'Coût moyen des transferts par corridor', outlet: 'Remittance Prices Worldwide', url: 'https://example.org/rpw' },
      { id: 3, title: "Usage des fonds reçus par les ménages", outlet: 'FIDA', url: 'https://example.org/fida' },
    ],
  },
  {
    slug: 'sante-3-fausses-infos-virales-verifiees',
    category: 'tech-science',
    status: 'published',
    origin: 'seed',
    publishedAt: '2026-06-05',
    readingMinutes: 4,
    title: 'Santé : 3 fausses informations virales, vérifiées',
    excerpt:
      "Remèdes « miracles » et fausses alertes circulent vite et peuvent être dangereux. Bokari a vérifié trois messages santé très partagés.",
    body: `Les rumeurs santé sont parmi les plus partagées — et les plus risquées. En voici trois, passées au crible.

## 1. « Cette plante guérit le diabète en une semaine »

Aucune étude évaluée par des pairs n'appuie une guérison aussi rapide. Les autorités sanitaires rappellent qu'aucun remède « miracle » ne remplace un suivi médical [1].

**Verdict : faux et dangereux.**

## 2. Une fausse alerte sur un médicament « retiré du marché »

Vérification faite, l'agence du médicament concernée n'a publié aucun rappel de ce type [2]. La rumeur recycle une vieille information sortie de son contexte.

**Verdict : trompeur.**

## 3. « Boire X protège contre tous les virus »

Aucune boisson ni aliment ne confère une immunité générale. Les organisations de santé publique sont claires sur ce point [3].

**Verdict : faux.**

## Le réflexe à garder

Pour toute information santé, remontez à une source médicale officielle avant de partager. Dans le doute, demandez à Bokari : il cite ses sources pour chaque réponse.`,
    sources: [
      { id: 1, title: "Mises en garde sur les faux remèdes", outlet: 'OMS', url: 'https://example.org/oms' },
      { id: 2, title: "Rappels et retraits de médicaments", outlet: 'Agence du médicament', url: 'https://example.org/medicament' },
      { id: 3, title: "Idées reçues sur l'immunité", outlet: 'Institut de santé publique', url: 'https://example.org/immunite' },
    ],
  },
];
