# Phase 1 : étude de marché et validation du problème

_Date : 13/11/2026. Méthode : recherche documentaire (recherches web). Aucun entretien client n'a encore eu lieu._
_Attention : la plupart des chiffres trouvés viennent de **blogs d'éditeurs**, c'est-à-dire de concurrents qui ont un intérêt commercial. Ils donnent une tendance, pas une preuve._

## 1. Le problème étudié

Les petites boutiques en ligne (1 à 3 personnes) reçoivent des messages par e-mail, par chat et sur les réseaux sociaux : « où est ma commande ? », « je veux changer mon adresse », « comment faire un retour ? », « ce produit existe en M ? ». Le gérant répond à la main, souvent le soir, en copiant-collant le statut de la commande depuis Shopify ou WooCommerce.

### Ce que la recherche confirme
- **« Où est ma commande ? » (WISMO, *Where Is My Order*)** est la demande la plus fréquente. La part la plus citée est de **30 à 50 % des tickets** (rapport Gorgias 2024, repris par de nombreux éditeurs). Des estimations plus basses existent : **16 à 20 %** (AfterShip, Fin.ai). Conclusion : c'est une part importante et répétitive, mais le chiffre exact est incertain.
- Le problème s'aggrave quand la boutique grandit. Jusqu'à environ 10 à 15 commandes par semaine, l'e-mail et les messages privés suffisent ; au-delà, des demandes se perdent.
- Les commerçants **paient réellement** pour résoudre ce problème : il existe toute une catégorie de logiciels payants (les *helpdesks*), ce qui prouve un consentement à payer.

## 2. Concurrents (international)

| Concurrent | Modèle | Prix d'entrée (les sources divergent) | Point faible observé |
|---|---|---|---|
| **Gorgias** | Helpdesk Shopify + agent IA | 10 $/mois pour 50 tickets, puis ~0,40 $/ticket + **~0,90 à 1 $ par résolution IA** | Facture imprévisible, « double facturation » ticket + IA. Note Trustpilot 2,1 contre 4,6 sur G2 (plaintes sur les prix) |
| **Richpanel** | Helpdesk + actions IA sur les commandes | 29 $ à plus de 500 $/mois selon les sources, ~0,20 $ par conversation IA | Tarifs peu clairs, cible les boutiques moyennes |
| **eDesk** | Multicanal, places de marché | 39 $/agent/mois ou 49 $/mois pour Shopify, +0,99 $ par résultat IA | Prix par siège + par résultat |
| **Tidio (Lyro)** | Chat + chatbot IA | Offre gratuite, IA à partir de ~39 $/mois | Orienté chat, gère peu les commandes |
| **Re:amaze, Help Scout, Zendesk** | Helpdesks généralistes | 29 à 69 $/utilisateur/mois | Pas spécialisés e-commerce, chers avec l'IA |
| **Commslayer, Eve AI, Relay** | « Gorgias moins cher » | De 9 $/utilisateur à 99 $/mois forfaitaire | Récents, positionnement agressif |
| **HelpOMatic, Vachika, AI Shopping Agent** | Applis Shopify à bas prix | 5 à 20 $/mois | Très peu d'avis, petits acteurs |
| **Polyreply, Ensoras, SupportKontor** | Extensions WooCommerce | Gratuit (open source) à payant | WooCommerce uniquement |

**Verdict honnête : le marché du « helpdesk IA pour Shopify » est saturé.** Affronter Gorgias de face, ou se battre sur le prix contre les applis à 5 ou 10 $, est perdu d'avance pour un fondateur seul avec 100 €.

## 3. Failles observées (opportunités)

1. **Le prix est une source de frustration.** La facturation au ticket et à la résolution IA rend les coûts imprévisibles : un pic de saison peut doubler la facture. → Opportunité : **prix fixe, sans frais par ticket.**
2. **Les boutiques « trop petites » pour Gorgias** (moins de 100 à 300 messages par mois) : le prix au ticket dépasse le bénéfice. Les grands acteurs servent mal ce segment.
3. **La confiance dans l'IA.** Les commerçants ont peur d'une IA qui répond n'importe quoi à leurs clients. Plusieurs extensions WooCommerce mettent en avant le principe « brouillon → validation humaine ». → Opportunité : **l'IA prépare, vous validez en un clic** (aucun envoi automatique par défaut).
4. **Le multilingue et les langues autres que l'anglais.** Les boutiques européennes reçoivent des messages en français, allemand, espagnol, italien… La plupart des outils sont d'abord conçus en anglais. → Opportunité : **comprendre toutes les langues et répondre dans la langue du client**, avec une interface en français et en anglais.
5. **Les modifications de commande avant expédition** (adresse, annulation, taille) : une demande urgente manquée coûte cher. → Opportunité : **détecter et signaler les demandes qui exigent une action** avant la préparation du colis.

## 4. Piste alternative étudiée : les artisans de l'alimentation (synergie avec Menuet)

Les pâtissiers, traiteurs et cake designers prennent leurs commandes par WhatsApp ou Instagram et s'y perdent. **Écartée pour l'instant** : le consentement à payer est très faible, des outils gratuits existent déjà (Take App, Hotplate, ou WhatsApp Business + un formulaire Google), et l'API WhatsApp exige une vérification Meta et des coûts par message. À reconsidérer plus tard comme déclinaison possible.

## 5. Le nom « OrderPilot » pose problème

Au moins **5 produits existants** s'appellent OrderPilot, **dont une application Shopify** (Bevy OrderPilot) et un SaaS d'automatisation des bons de commande référencé sur Capterra et G2. Risques : conflit de marque, référencement impossible, confusion sur le Shopify App Store.
→ **Recommandation : changer de nom avant tout lancement public.** Dans le code, le nom est centralisé dans une seule variable de configuration (`BRAND_NAME`) : le changement prendra une minute. Voir les propositions dans `03-decisions.md`.

## 6. Conclusion : feu vert sous conditions

**On garde le cœur de l'idée** (compréhension des messages, organisation des commandes, réponses IA), **mais avec un positionnement précis** :

> **« La boîte de réception IA des petites boutiques en ligne. L'IA lit, trie et rédige la réponse dans la langue de votre client ; vous validez en un clic. Prix fixe, sans frais par ticket. »**

- **Cible** : boutiques e-commerce indépendantes, 1 à 3 personnes, 30 à 500 messages clients par mois. L'Europe d'abord (FR/EN/DE/ES), puis le reste du monde.
- **Ce qui nous distingue** : prix fixe, validation humaine, multilingue natif, détection des modifications de commande urgentes.
- **Ce qu'on ne fait PAS pour l'instant** : chat en direct, téléphone, bot WhatsApp, places de marché.

### Validation qui reste à faire (à ne pas sauter)
La recherche documentaire **ne suffit pas**. Avant d'investir de l'argent :
1. **Page d'accueil + liste d'attente** (gratuit). Objectif : 30 inscrits en 4 semaines.
2. **10 conversations avec de vrais commerçants** (forums et groupes Shopify ou Etsy, LinkedIn, connaissances). Questions clés : combien de messages par semaine ? Combien de temps y passez-vous ? Quel outil aujourd'hui ? Combien paieriez-vous ?
3. **Test pilote payant** : proposer la bêta à 3 commerçants à 9 €/mois (ou gratuite un mois, puis payante). **Un seul client qui paie vaut plus que cent « c'est une super idée ».**

**Critère pour continuer ou arrêter** : si après 6 semaines on a moins de 15 inscrits ET aucun commerçant prêt à payer, on change de positionnement (par exemple WooCommerce uniquement, ou la déclinaison alimentaire).

## Sources
- [Alternatives à Gorgias (CoSupport)](https://cosupport.ai/comparisons/gorgias), [Prix de Gorgias AI en 2026 (eesel)](https://eesel.ai/blog/gorgias-ai-pricing-complete-2026-cost-breakdown-and-guide), [Comparatif des offres Gorgias (eesel)](https://eesel.ai/blog/gorgias-plans-comparison)
- [Plaintes fréquentes sur Gorgias (Macha)](https://www.getmacha.com/blog/gorgias-common-complaints-and-problems), [Gorgias convient-il aux petites boutiques ? (Macha)](https://www.getmacha.com/blog/is-gorgias-good-for-small-stores), [Avis sur Gorgias (Ringly)](https://www.ringly.io/blog/gorgias-customer-service-ticketing-system-reviews), [Avis Gorgias sur le Shopify App Store](https://apps.shopify.com/helpdesk/reviews?rating=2)
- [Meilleurs helpdesks e-commerce 2026 (Richpanel)](https://www.richpanel.com/learn/best-help-desk-software-ecommerce-2026), [Meilleurs outils de support IA pour Shopify (eDesk)](https://www.edesk.com/blog/best-ai-customer-support-tool-shopify/), [Applis de service client Shopify (Ringly)](https://www.ringly.io/blog/shopify-customer-service-app)
- [WISMO (Karla)](https://gokarla.io/blog/wismo-inquiries-ecommerce-scale-cost-impact), [WISMO (AfterShip)](https://www.aftership.com/blog/aftership-vs-narvar-malomo-wismo-reduction), [Glossaire WISMO (Fin.ai)](https://fin.ai/glossary/wismo), [Pourquoi les statistiques WISMO sont difficiles à vérifier (Ship24)](https://www.ship24.com/blog/why-common-wismo-statistics-are-hard-to-verify)
- [Polyreply for WooCommerce](https://wordpress.org/plugins/polyreply-for-woocommerce/), [Ensoras](https://wordpress.org/plugins/ensoras-ai-chat/), [Gorgias AI pour WooCommerce (eesel)](https://www.eesel.ai/blog/gorgias-ai-for-woocommerce)
- [HelpOMatic](https://apps.shopify.com/helpomatic), [Vachika](https://apps.shopify.com/vachika), [Alternatives à Gorgias (Eve AI)](https://eve-ai.pages.dev/compare/best-gorgias-alternative)
- [Mise à jour du partage de revenus Shopify (shopify.dev)](https://shopify.dev/changelog/update-to-shopifys-app-developer-revenue-share)
- Alimentation : [Codewords : WhatsApp ou Instagram pour les boulangeries](https://codewords.ai/blog/whatsapp-vs-instagram-dms-for-bakery-orders), [Étude de cas Take App](https://www.casestudies.com/company/take-app/case-study/towner-bakehouse-customer-case-study), [Wabizo](https://www.softwareadvice.co.uk/software/697584/Wabizo)
- Nom : [OrderPilot sur Capterra](https://www.capterra.com/p/10041707/OrderPilot/), [Bevy OrderPilot](https://academy.bevycommerce.com/orderpilot/what-is-order-pilot)
