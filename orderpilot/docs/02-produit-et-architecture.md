# Phase 2 : définition du produit et architecture

## 1. Le produit (MVP)

**Promesse** : « Collez ou transférez les messages de vos clients. L'IA comprend la demande, retrouve la commande, signale l'urgence et rédige la réponse dans la langue du client. Vous relisez et vous envoyez. »

### Parcours utilisateur du MVP
1. Le commerçant crée un compte (e-mail + mot de passe).
2. Il renseigne sa boutique : nom, ton souhaité, politiques (livraison, retours, délais), signature.
3. Il ajoute ses commandes (saisie manuelle ou import CSV ; la synchronisation Shopify viendra ensuite).
4. Il ajoute un message client (collé à la main pour l'instant ; transfert d'e-mails automatique ensuite).
5. L'IA analyse le message :
   - **catégorie** (suivi de commande, modification, annulation, retour/remboursement, question produit, réclamation, autre) ;
   - **urgence** (basse, normale, haute) et **action requise sur la commande** (oui/non) ;
   - **langue**, **sentiment**, **numéro de commande détecté**, **résumé** en une phrase ;
   - **brouillon de réponse** dans la langue du client, basé UNIQUEMENT sur les politiques de la boutique et la commande trouvée.
6. Le commerçant modifie ou valide le brouillon, puis marque le message comme traité.
7. Le tableau de bord affiche : messages en attente, urgents, répartition par catégorie, temps gagné estimé, consommation du forfait.

### Hors MVP (plus tard, dans cet ordre)
1. Réception automatique des e-mails (adresse de transfert).
2. Synchronisation des commandes Shopify (application Shopify).
3. Envoi de la réponse directement depuis l'outil.
4. WooCommerce, puis Etsy.

## 2. Formules d'abonnement (hypothèse à valider)

| Formule | Prix | Messages analysés/mois | Utilisateurs | Notes |
|---|---|---|---|---|
| Gratuit | 0 € | 30 | 1 | Pour essayer, sans carte bancaire |
| Essentiel | 19 €/mois | 500 | 2 | Cible principale |
| Pro | 49 €/mois | 2 000 | 5 | Synchronisation Shopify, priorité support |

**Aucun frais par ticket** : c'est notre argument face à Gorgias. Au-delà du quota, l'analyse IA se met en pause (pas de facture surprise) et le commerçant peut passer à la formule supérieure.

## 3. Coût de l'IA et marges (estimation)

Hypothèse par message : ~1 200 jetons en entrée (consignes + politiques + message + commande) et ~350 jetons en sortie. Tarifs officiels Anthropic (novembre 2026) :

| Modèle | Coût par message (approx.) | Coût max formule Essentiel (500) | Coût max formule Pro (2 000) |
|---|---|---|---|
| Claude Haiku 5.5 (0,10 $ / 0,50 $ par million de jetons) | ~0,0003 $ | ~0,15 $ | ~0,60 $ |
| Claude Sonnet 5.5 (2 $ / 10 $) | ~0,006 $ | ~3 $ | ~12 $ |
| Claude Opus 5.5 (4 $ / 20 $), réflexion en plus | ~0,012 $ ou plus | ~6 $ ou plus | ~24 $ ou plus |

→ **Recommandation** : Claude Haiku 5.5 en production si sa qualité est suffisante sur notre jeu de test (à vérifier dès qu'une clé API sera disponible). La marge brute serait alors supérieure à 95 %. Le modèle se change dans la configuration (`AI_MODEL`), sans toucher au code. **Ce choix vous revient** (voir les autorisations).

## 4. Architecture technique

Choix guidés par : budget quasi nul, fondateur débutant, fiabilité, possibilité de tout tester ici.

| Élément | Choix | Pourquoi |
|---|---|---|
| Langage | JavaScript (Node.js 22) | Un seul langage pour le serveur et l'interface, très documenté |
| Serveur | Express 5 | Simple, stable, très répandu |
| Base de données | SQLite (better-sqlite3) | Un simple fichier, zéro coût, rapide ; migration vers PostgreSQL possible plus tard |
| Interface | HTML + CSS + JavaScript sans framework | Aucune étape de compilation, facile à comprendre et à modifier |
| IA | SDK officiel Anthropic, sorties JSON validées par un schéma (Zod) | Réponses structurées et vérifiées |
| Mode sans clé | Fournisseur IA « démo » déterministe | Permet de tester et de faire des démonstrations sans dépenser |
| Authentification | Mots de passe hachés (scrypt), sessions en base, cookies `HttpOnly` + `SameSite` | Standard sûr, sans service payant |
| Paiements (phase 8) | À choisir : Stripe ou un « Merchant of Record » (Paddle, Lemon Squeezy) | Voir `03-decisions.md` |
| Hébergement (phase 9) | À choisir : petit serveur VPS (~4-5 €/mois) ou plateforme avec disque | Le site vitrine peut rester gratuit sur GitHub Pages |

### Sécurité prévue dès le départ
- Chaque donnée est rattachée à un **espace boutique** ; toutes les requêtes filtrent par cet espace (un client ne voit jamais les données d'un autre).
- Protection contre les attaques par force brute (limitation des tentatives de connexion).
- Protection CSRF (jeton) sur toutes les actions, en-têtes de sécurité (CSP, etc.).
- Validation de toutes les entrées (taille, format).
- **Protection contre l'injection de consignes** : le message du client est traité comme une donnée, jamais comme une instruction ; la sortie de l'IA est contrainte par un schéma ; **aucun envoi automatique**.
- Clés secrètes uniquement dans un fichier `.env` jamais publié (`.gitignore`).
- Quotas mensuels par formule pour éviter les abus et maîtriser les coûts.
