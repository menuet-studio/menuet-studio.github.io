# OrderPilot (nom provisoire)

La boîte de réception IA des petites boutiques en ligne : l'IA lit le message d'un client, retrouve la commande, signale l'urgence et rédige une réponse dans la langue du client. Le commerçant relit et valide.

- État du projet et prochaines étapes : [`PROJECT_STATUS.md`](PROJECT_STATUS.md)
- Étude de marché : [`docs/01-etude-de-marche.md`](docs/01-etude-de-marche.md)
- Produit et architecture : [`docs/02-produit-et-architecture.md`](docs/02-produit-et-architecture.md)
- Journal des décisions : [`docs/03-decisions.md`](docs/03-decisions.md)

## Lancer le logiciel sur votre Mac (10 minutes)

1. **Installer Node.js** (le moteur qui fait tourner le serveur) : téléchargez la version « LTS » sur https://nodejs.org et installez-la.
2. **Ouvrir le Terminal** (Applications › Utilitaires › Terminal) et aller dans le dossier du projet :
   ```bash
   cd chemin/vers/menuet-studio.github.io/orderpilot
   ```
3. **Installer les dépendances** (une seule fois) :
   ```bash
   npm install
   ```
4. **Créer votre fichier de configuration** (une seule fois) :
   ```bash
   cp .env.example .env
   ```
   Sans clé API, le logiciel fonctionne en **mode démonstration** (gratuit, règles simples).
5. **Démarrer** :
   ```bash
   npm start
   ```
   Ouvrez http://localhost:3000 dans votre navigateur. Créez un compte, puis cliquez sur « Charger des exemples ».

Pour arrêter le serveur : `Ctrl + C` dans le Terminal.

## Commandes utiles

| Commande | Rôle |
|---|---|
| `npm start` | Démarre le serveur |
| `npm run dev` | Démarre et redémarre automatiquement à chaque modification du code |
| `npm test` | Lance les tests automatiques (aucun coût, aucune clé nécessaire) |
| `npm run eval:ai` | Mesure la qualité de l'IA sur 12 messages types (**payant** si une clé Claude est configurée) |

## Organisation du code

```
src/
  server.js        démarrage
  app.js           assemblage (sécurité, API, pages)
  config.js        configuration et formules d'abonnement
  db.js            base de données SQLite (tables)
  auth.js          mots de passe et sessions
  security.js      en-têtes de sécurité, limitation de débit, erreurs
  routes/api.js    toutes les routes de l'API
  ai/              intelligence artificielle
    prompt.js      consignes données à l'IA
    schema.js      format de réponse attendu (vérifié)
    anthropic.js   connexion à Claude
    demo.js        moteur de démonstration gratuit
public/            pages web (site vitrine, connexion, tableau de bord)
test/              tests automatiques
scripts/eval-ai.js évaluation de la qualité de l'IA
docs/              stratégie et décisions
```

## Sécurité : règles à respecter

- Le fichier `.env` contient les secrets : il ne doit **jamais** être publié (il est exclu par `.gitignore`).
- Ne jamais coller une clé API dans le code ou dans un message.
- La base de données (`data/*.db`) contient des données personnelles : elle n'est pas publiée non plus.
