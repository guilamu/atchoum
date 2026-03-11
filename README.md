# 🤧 Atchoum! Tracker de Pollens et d'Allergies

Atchoum! est une application web progressive (PWA) conçue pour aider les utilisateurs à suivre leur exposition aux pollens et à corréler ces données avec leurs symptômes allergiques pour établir des diagnostics.

## 🌟 Fonctionnalités
- **Suivi des pollens en temps réel** (données fournies par l'API Atmo Data).
- **Journal de santé intégré** : saisie des symptômes, médicaments pris, et suivi statistique.
- **Mode Diagnostic** : deux niveaux de diagnostic (par "exposition hypothétique" au début, puis "corrélation de Pearson" avec 3 jours de données et +).
- **Alertes et Notifications** : paramétrage d'alertes personnalisées et notifications push web.
- **Support PWA** : installable sur mobile et bureau.

---

## 🏗️ Structure du projet

Voici l'arborescence complète de l'application et le rôle de chaque dossier/fichier clé :

```text
Atchoum/
├── app/                              # 🎨 FRONTEND (React + Vite)
│   ├── src/
│   │   ├── components/               # Composants UI réutilisables (Layout, Graphiques...)
│   │   ├── hooks/                    # Logique métier React (useCities, useHealthLog...)
│   │   ├── pages/                    # Vues principales (Accueil, Villes, Santé, Réglages)
│   │   └── services/                 # Appels à l'API backend (apiService, authService...)
│   ├── index.html                    # Point d'entrée HTML
│   └── vite.config.js                # Configuration de compilation Vite
│
└── backend/                          # ⚙️ BACKEND API (PHP)
    ├── config.example.php            # Modèle pour vos identifiants Atmo (à renommer en config.php)
    ├── database.example.php          # Modèle pour la DB et clés API (à renommer en database.php)
    ├── index.php                     # Point d'entrée de développement
    ├── index.production.php          # Point d'entrée de production (CORS stricts)
    ├── schema.sql                    # Structure de la base de données MySQL
    │
    ├── src/                          # Logique métier backend
    │   ├── Database.php              # Connexion PDO et lecture des configurations
    │   ├── AtmoProxy.php             # Requêtes à l'API officielle Atmo Data
    │   ├── Cities.php                # Gestion des villes de l'utilisateur
    │   ├── Auth.php & JWT.php        # Authentification par email (sans mot de passe)
    │   ├── HealthLog.php             # Enregistrement des symptômes et médicaments
    │   ├── Diagnostic.php            # Algorithmes de corrélation pollens/symptômes
    │   ├── WebPush.php & Notifications.php # Gestion des alertes push
    │   └── Mailer.php                # Envoi d'emails (Brevo / SendPulse)
    │
    ├── cron/         
    │   └── daily-alerts.php          # Script automatique d'envoi des alertes (à lier au CRON serveur)
    │
    ├── scripts/                      # Outils CLI
    │   └── generate-vapid-keys.php   # Générateur de clés pour le Web Push
    │
    ├── migrations/                   # Scripts de mise à jour de la BDD
    │
    └── logs/ & cache/                # Générés dynamiquement à l'exécution
```

---

## 🚀 Guide de déploiement

Ce guide suppose le déploiement sur un serveur Linux classique (Apache, MySQL, PHP 8.x).

### Prérequis Serveur
- **PHP 8.x** avec les extensions : `curl`, `json`, `mbstring`, `pdo_mysql`.
- **MySQL** ou **MariaDB**.
- **Node.js** et **npm** (pour la compilation du frontend sur votre machine).
- Un nom de domaine configuré avec **SSL/HTTPS** (⚠️ obligatoire pour les PWA et Web Push).

### 1. Base de données
1. Créez une base de données MySQL.
2. Importez la structure de la base fournie :
   ```bash
   mysql -u user -p atchoum_db < backend/schema.sql
   ```

### 2. Configuration de l'API (Backend)
Pour des raisons de sécurité, nous recommandons de placer les fichiers de configuration et de cache *en dehors* du répertoire public ou d'en bloquer l'accès.

1. Allez dans le dossier `backend/`.
2. Copiez les modèles de configuration :
   ```bash
   cp database.example.php database.php
   cp config.example.php config.php
   ```
3. Remplissez **`database.php`** :
   - Identifiants de base de données.
   - `jwt_secret` (générez une longue chaîne aléatoire).
   - Clés d'API pour les emails (Brevo en principal, SendPulse en secours).
4. Remplissez **`config.php`** :
   - Vos identifiants de connexion à l'API [Atmo Data](https://admindata.atmo-france.org/inscription-api) pour récupérer les niveaux de pollens horaires et journaliers.
5. Création et droits des dossiers de données dynamiques :
   ```bash
   mkdir -p cache logs
   chown -R www-data:www-data cache logs
   chmod 750 cache logs
   ```
6. **Notifications Web Push** : 
   Générez vos clés VAPID en exécutant le script inclus et ajoutez-les dans `database.php` et `backend/src/Notifications.php` :
   ```bash
   php scripts/generate-vapid-keys.php
   ```
7. Configurez la règle CORS dans `backend/index.production.php` (Ligne 19) pour n'autoriser que votre domaine.

### 3. Compilation de l'Application (Frontend)
1. Allez dans le dossier `app/` :
   ```bash
   cd app
   ```
2. Créez un fichier d'environnement `.env.production` pour faire pointer l'app vers votre API backend :
   ```env
   VITE_API_URL=https://votre-domaine.com/api
   ```
3. Installez les dépendances et compilez le projet :
   ```bash
   npm install
   npm run build
   ```
Le dossier `app/dist/` contient désormais votre application optimisée pour la mise en ligne.

### 4. Configuration Web (Apache / Nginx)
Sur votre serveur web :
1. Envoyez le contenu du dossier compilé `app/dist/` dans le répertoire public de votre domaine (ex: `/var/www/votre-domaine.com/public_html/`).
2. Créez un sous-dossier `api/` dans ce répertoire public et envoyez-y le fichier `backend/index.php` (ou renommez `index.production.php`) et liez l'API.

**Important pour Apache (.htaccess) :**
Pour gérer correctement le routage de React Router SPA, créez un `.htaccess` à la racine :
```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_URI} !^/api/
    RewriteRule . /index.html [L]
</IfModule>
```

Et pour rooter correctement l'API PHP (dans le dossier `/api/.htaccess`) :
```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^(.*)$ index.php [QSA,L]
```

### 5. Tâches planifiées (CRON)
Pour que l'application puisse envoyer les alertes polliniques automatiques aux utilisateurs via Email ou Push, configurez une tâche CRON tournant typiquement vers midi ou en début d'après-midi :
```bash
0 12 * * * php /chemin/absolu/vers/backend/cron/daily-alerts.php >> /chemin/absolu/vers/backend/logs/cron.log 2>&1
```

---

## 📄 Licence
Ce projet est distribué sous licence publique générale Affero GNU (AGPLv3). Voir le fichier [LICENSE](./LICENSE) pour plus de détails.
