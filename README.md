# 🃏 Yu-Gi-Oh! Scanner

PWA (installable sur Android) pour scanner et gérer une collection de cartes Yu-Gi-Oh !
Aucun build, aucun backend : de simples fichiers statiques + l'API publique [YGOPRODeck](https://ygoprodeck.com/api-guide/).

## Fonctionnalités

- **📷 Scan par caméra** : photo de la carte → OCR ([Tesseract.js](https://tesseract.projectnaptha.com/)) →
  recherche automatique du nom sur YGOPRODeck → sélection parmi les candidates.
- **🔍 Recherche manuelle** : autocomplétion par nom + filtres (type, attribut, race, niveau, set, rareté).
- **📚 Inventaire local** : quantités, doubles, images, stockage **IndexedDB** dans le navigateur (aucune donnée envoyée).
- **💰 Valeur estimée** : prix du marché TCGPlayer par carte et total de la collection.
- **📄 Export CSV / JSON** et **import JSON** (sauvegarde/restauration).
- **📲 PWA** : manifest + service worker → installable sur l'écran d'accueil Android, cache hors-ligne.

## Utilisation

1. Servir le dossier via un serveur HTTP (la caméra exige HTTPS ou localhost) :
   - En local : `npx serve .` ou `python3 -m http.server 8000`
   - En ligne : héberger sur GitHub Pages, Netlify, Cloudflare Pages… (HTTPS automatique)
2. Ouvrir l'URL sur Android (Chrome) → menu ⋮ → **"Ajouter à l'écran d'accueil"**.
3. Scanner : activer la caméra, cadrer la carte (nom bien lisible, bon éclairage), capturer,
   puis confirmer la carte parmi les candidates.
4. La collection reste sur l'appareil ; exporter en JSON régulièrement pour sauvegarder.

## Structure

```
index.html        — UI (3 onglets : Scan / Recherche / Collection)
css/style.css     — thème sombre responsive
js/api.js         — client API YGOPRODeck (recherche, filtres)
js/storage.js     — IndexedDB (collection + cache de recherche)
js/app.js         — logique : caméra, OCR, rendu, export/import
manifest.json     — manifest PWA
sw.js             — service worker (cache hors-ligne)
icons/            — icônes PWA 192/512 px
```

## Limitations

- L'OCR lit le texte de la carte et propose des candidates ; la confirmation manuelle reste nécessaire
  (fiabilité dépend de l'éclairage et de la netteté).
- La caméra ne fonctionne qu'en contexte sécurisé (HTTPS ou localhost).
- Prix indicatifs (TCGPlayer) ; les cartes très rares peuvent afficher 0.00.

## 📱 Générer l'APK (Android Studio)

Le dossier `android/` est un projet Android natif complet (Capacitor) avec les assets web déjà embarqués dans `android/app/src/main/assets/public/`.

1. Ouvrir Android Studio → **Open** → sélectionner le dossier `android/`
2. Laisser Gradle synchroniser (télécharge automatiquement les dépendances)
3. Menu **Build → Build App Bundle(s) / APK(s) → Build APK(s)**
4. L'APK signé (debug) se trouve dans :
   `android/app/build/outputs/apk/debug/app-debug.apk`
5. Copier l'APK sur le téléphone et l'installer (autoriser "Sources inconnues")

> Aucun outil Node.js requis : tout est déjà synchronisé. Pour modifier le code web
> (`www/`), installer Node puis relancer `npx cap sync android`.

> La caméra nécessite que la permission soit accordée à l'app (demandée au premier lancement).

## APK déjà compilé

Un workflow GitHub Actions (`.github/workflows/build-apk.yml`) recompile automatiquement
l'APK à chaque push : l'APK est téléchargeable dans l'onglet **Actions → Build APK → Artifacts**.
