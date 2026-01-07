# GwenBot 🎮

Bot Twitch pour afficher et gérer les records Cemantix.

## Commandes

| Commande | Accès | Description |
|----------|-------|-------------|
| `!cemantix` | Tous | Affiche les records FR et EN |
| `!cemantixfr <nombre>` | Modos/Streameuse | Modifie le record FR |
| `!cemantixen <nombre>` | Modos/Streameuse | Modifie le record EN |

## Déploiement sur Railway (sans GitHub)

### 1. Installer Railway CLI

```bash
npm install -g @railway/cli
railway login
```

### 2. Créer le projet et ajouter Redis

```bash
cd c:\Users\jawad\Projets\gwenbot
railway init
railway add --database redis
```

### 3. Ajouter les variables d'environnement

Sur le dashboard Railway, ajoute :
- `TWITCH_USERNAME` = gwenbot_
- `TWITCH_OAUTH_TOKEN` = oauth:ton_token
- `TWITCH_CHANNEL` = nom_de_la_chaine

> ⚠️ `REDIS_URL` est ajoutée automatiquement par Railway !

### 4. Déployer

```bash
railway up
```

## Test local

Pour tester localement, tu as besoin de Redis installé, ou utilise Docker :

```bash
docker run -d -p 6379:6379 redis
npm start
```
