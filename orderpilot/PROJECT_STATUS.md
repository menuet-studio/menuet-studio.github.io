# PROJECT_STATUS : OrderPilot (nom provisoire)

_Dernière mise à jour : 13/11/2026 (session 1)_

## Où en est-on ?

| Phase | État |
|---|---|
| 1. Étude de marché et validation du problème | ✅ Recherche documentaire faite · ⏳ validation terrain à faire (entretiens, liste d'attente) |
| 2. Produit et architecture | ✅ Fait |
| 3. Environnement technique | ✅ Fait (Node.js 22, Express 5, SQLite) |
| 4. MVP | ✅ Première version fonctionnelle |
| 5. IA | ✅ Intégration Claude codée et testée sur un faux serveur · ⏳ test réel en attente de clé API |
| 6. Site et tableau de bord | ✅ Site vitrine, connexion, tableau de bord |
| 7. Sécurité et tests | ✅ 22 tests automatiques + test navigateur complet · ⏳ revue externe avant lancement |
| 8. Abonnements et paiements | ⏳ Quotas par formule en place ; paiement non branché (compte à ouvrir par un adulte) |
| 9. Lancement international | ⏳ Interface en français uniquement, hébergement à choisir |
| 10. Premiers utilisateurs | ⏳ Pas encore commencé. **Aucun client à ce jour.** |

## Décisions clés (détails : `docs/03-decisions.md`)
- Positionnement : boîte de réception IA, **prix fixe sans frais par ticket**, **validation humaine**, **multilingue**.
- Cible : boutiques e-commerce de 1 à 3 personnes, 30 à 500 messages par mois, Europe d'abord.
- « OrderPilot » est un **nom provisoire** (au moins 5 produits portent déjà ce nom).
- Formules prévues : Gratuit (30 analyses), Essentiel 19 €/mois (500), Pro 49 €/mois (2 000).

## Ce qui fonctionne aujourd'hui
- Inscription, connexion et déconnexion, sessions sécurisées.
- Réglages de la boutique : nom, ton, politiques, signature.
- Commandes : ajout, modification, suppression, recherche, import CSV (virgule ou point-virgule, décimales à virgule).
- Messages : ajout, analyse (catégorie, urgence, action requise, langue, sentiment, numéro de commande, résumé, informations manquantes, brouillon de réponse), liaison à une commande, modification du brouillon, « copier et marquer traité », archivage, suppression.
- Tableau de bord : messages à traiter, urgents, actions, commandes à expédier, répartition par type et par langue.
- Quotas mensuels par formule (réservation atomique, quota rendu si l'IA échoue).
- Données (RGPD) : export complet et suppression définitive du compte.
- Site vitrine avec tarifs et liste d'attente (consentement obligatoire), politique de confidentialité (brouillon).

## Sécurité en place
Mots de passe hachés (scrypt) · sessions dont seule l'empreinte est stockée · cookies HttpOnly/SameSite · jeton CSRF + contrôle d'origine · limitation des connexions, inscriptions, analyses et inscriptions à la liste d'attente · isolation stricte entre boutiques (testée) · validation de toutes les entrées · en-têtes CSP et anti-clickjacking · message client isolé et neutralisé dans la consigne IA · sortie IA validée par schéma · aucun envoi automatique · aucune clé dans le code · 0 vulnérabilité connue dans les dépendances (`npm audit`).

## Tests réalisés (session 1)
- `npm test` : **22/22 réussis** (comptes, force brute, CSRF, isolation, commandes, CSV, analyse, injection, quota, panne de l'IA, réponse IA invalide, liste d'attente, RGPD, en-têtes, entrées invalides, requête Claude vérifiée sur un faux serveur local).
- Test navigateur complet (Chromium) : inscription → exemples → messages → traitement → commandes → réglages, **aucune erreur console**, pas de défilement horizontal sur mobile.
- Évaluation de l'IA (moteur démo gratuit) : 31/35 vérifications (89 %). **Non mesuré avec Claude** (pas de clé).

## Dépenses
**0 €** à ce jour.

## Autorisations nécessaires (en attente de votre réponse)
1. **Clé API Anthropic** : pour tester la vraie IA. Coût à l'usage : l'évaluation complète coûte moins de 0,01 $ avec Claude Haiku 5.5. Recommandation : créer le compte avec une limite de dépense de 5 $ ; un adulte doit ouvrir le compte (carte bancaire).
2. **Choix du modèle** : Haiku 5.5 (le moins cher, marge >95 %) ou Opus 5.5 (plus capable, ~40 fois plus cher). Recommandation : mesurer les deux avec `npm run eval:ai` (coût total < 0,25 $), puis décider.
3. **Nom définitif + nom de domaine** (~10-15 €/an, récurrent).
4. **Hébergement** (~4-7 €/mois, récurrent), à décider avant le lancement de la bêta publique.
5. **Contact de commerçants** pour les entretiens (je prépare les messages, vous ou moi les envoyons après votre accord).

## Prochaines tâches
1. Préparer le kit de validation : script d'entretien, messages de prospection, liste de communautés où trouver des commerçants.
2. Traduire l'interface et le site en anglais (cible internationale).
3. Réception automatique des e-mails (adresse de transfert) : c'est la fonction qui évite le copier-coller.
4. Comparer les hébergeurs et préparer le déploiement.
5. Préparer l'intégration du paiement en mode test (dès qu'un compte existe).

## Notes techniques
- Le code se trouve dans `orderpilot/` du dépôt `menuet-studio.github.io` (le site Menuet existant n'a pas été modifié). Ce dépôt sert un site GitHub Pages public : à terme, déplacer OrderPilot dans un **dépôt privé dédié** (à créer par vous).
- Le travail est sur la branche `claude/confident-wozniak-jb630c`, sans fusion dans `main`.
