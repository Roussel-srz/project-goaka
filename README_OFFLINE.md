# Enterprise Management Pro - Version Offline

## 🎯 Vue d'ensemble
Cette version de Enterprise Management Pro fonctionne **totalement offline** sans nécessiter de connexion internet. Toutes les bibliothèques externes ont été téléchargées et intégrées localement.

## 📁 Structure des fichiers
```
OFFLINE/
├── index.html              # Page principale de l'application
├── app.js                  # Logique JavaScript de l'application
├── styles.css              # Styles CSS
├── libs/                   # Bibliothèques externes (versions locales)
│   ├── tailwindcss.min.js
│   ├── lucide.min.js
│   ├── chart.min.js
│   ├── jspdf.umd.min.js
│   └── html2canvas.min.js
└── README_OFFLINE.md       # Ce fichier
```

## 🚀 Comment utiliser l'application offline

### Méthode 1: Serveur local (recommandé)
1. Ouvrez un terminal dans le dossier `OFFLINE`
2. Lancez la commande :
   ```bash
   python -m http.server 8000
   ```
3. Ouvrez votre navigateur et allez à : `http://localhost:8000`

### Méthode 2: Ouverture directe
1. Double-cliquez sur le fichier `index.html`
2. L'application s'ouvrira directement dans votre navigateur

## ✅ Fonctionnalités disponibles offline
- ✅ Gestion complète du stock
- ✅ Ventes et facturation
- ✅ Crédits clients
- ✅ Dépenses et caisse
- ✅ Tableau de bord avec graphiques
- ✅ Export PDF et CSV
- ✅ Gestion des permissions multi-postes
- ✅ Sauvegarde automatique des données

## 💾 Stockage des données
Les données sont sauvegardées localement dans le navigateur via `localStorage`. Aucune donnée n'est envoyée vers des serveurs externes.

## 🔧 Configuration initiale
1. À la première ouverture, configurez votre entreprise dans les paramètres
2. Définissez les mots de passe administrateur et postes si nécessaire
3. Ajoutez vos produits et catégories

## 📱 Compatible avec
- Navigateurs modernes (Chrome, Firefox, Edge, Safari)
- Ordinateurs de bureau et mobiles
- Windows, macOS, Linux

## 🔄 Mises à jour
Pour mettre à jour l'application :
1. Téléchargez la nouvelle version
2. Remplacez les fichiers existants en conservant vos données
3. Les données seront automatiquement migrées

## 🆘 Support
En cas de problème :
1. Vérifiez que tous les fichiers sont présents dans le dossier
2. Assurez-vous d'utiliser un navigateur moderne
3. Videz le cache du navigateur si nécessaire

---
**Version**: 2.3 Offline  
**Dernière mise à jour**: 2026  
**Développé par**: Goaka Edition
