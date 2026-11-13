# Journal des décisions

Chaque décision importante est notée ici avec sa raison, pour ne jamais la perdre.

| Date | Décision | Raison | Réversible ? |
|---|---|---|---|
| 13/11/2026 | Le code d'OrderPilot vit dans le dossier `orderpilot/`, séparé du site Menuet | Le dépôt contient déjà le site Menuet en ligne : on ne le touche pas | Oui |
| 13/11/2026 | Positionnement : « boîte de réception IA, prix fixe, validation humaine, multilingue » | Le helpdesk IA Shopify générique est saturé (voir étude) | Oui |
| 13/11/2026 | Nom « OrderPilot » conservé comme **nom provisoire** uniquement | Au moins 5 produits portent déjà ce nom, dont une appli Shopify | Oui |
| 13/11/2026 | Stack : Node.js + Express + SQLite + HTML/JS sans framework | Coût nul, simple pour un débutant, testable ici | Oui (migration possible) |
| 13/11/2026 | Fournisseur IA « démo » quand aucune clé API n'est configurée | Développer et tester sans dépenser | Oui |
| 13/11/2026 | Aucun envoi automatique de réponse au client | Confiance des commerçants + sécurité face aux messages piégés | Oui |

## Propositions de nom (à vérifier avant de choisir)

Critères : court, prononçable en plusieurs langues, nom de domaine disponible, pas de marque existante dans le logiciel.

1. **Replivo**
2. **Parcelia**
3. **Inboxa**
4. **Calmcart**
5. **Shopmate Reply**

Aucune vérification de marque ni de domaine n'a encore été faite. Étape suivante : recherche sur la base EUIPO/INPI et vérification des domaines (.com / .io / .app). **L'achat d'un domaine (~10-15 €/an) demandera votre autorisation.**

## Paiements : options à comparer (phase 8)

| Option | Frais (approx., à vérifier) | TVA internationale | Remarque |
|---|---|---|---|
| Stripe Billing | ~1,5 % + 0,25 € (cartes UE) + ~0,7 % Billing | **À notre charge** (déclarations OSS) | Le moins cher, mais plus de travail administratif |
| Paddle | ~5 % + 0,50 $ | Gérée par Paddle (vendeur officiel) | Idéal pour vendre dans le monde entier dès le départ |
| Lemon Squeezy | ~5 % + 0,50 $ | Gérée (vendeur officiel) | Simple, appartient désormais à Stripe |

Recommandation provisoire : **un « Merchant of Record » (Paddle ou Lemon Squeezy)** pour une clientèle internationale, car il gère la TVA de chaque pays. **L'ouverture d'un compte demande une identité, une entreprise déclarée et un compte bancaire : un adulte responsable devra le faire.**
