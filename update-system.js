// === SYSTÈME DE MISE À JOUR AUTOMATIQUE ===
let updateCheckInterval = null;
let lastUpdateCheck = null;
const UPDATE_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Fonction pour vérifier la version actuelle
function getCurrentVersion() {
    return db.config.version || "1.0.0";
}

// Fonction pour vérifier les mises à jour
async function checkForUpdates() {
    if (!navigator.onLine) {
        console.log("Mode offline - pas de vérification de mise à jour");
        return null;
    }
    
    try {
        // Simuler une vérification de version depuis votre GitHub
        const response = await fetch('https://api.github.com/repos/Roussel-srz/project-goaka/releases/latest');
        if (!response.ok) return null;
        
        const release = await response.json();
        const latestVersion = release.tag_name.replace('v', '');
        const currentVersion = getCurrentVersion();
        
        if (compareVersions(latestVersion, currentVersion) > 0) {
            return {
                available: true,
                latestVersion,
                currentVersion,
                downloadUrl: release.assets[0]?.browser_download_url,
                releaseNotes: release.body
            };
        }
        
        return { available: false, latestVersion, currentVersion };
        
    } catch (error) {
        console.error("Erreur lors de la vérification des mises à jour:", error);
        return null;
    }
}

// Comparaison de versions (sémantique)
function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const part1 = parts1[i] || 0;
        const part2 = parts2[i] || 0;
        
        if (part1 > part2) return 1;
        if (part1 < part2) return -1;
    }
    return 0;
}

// Afficher une notification de mise à jour
function showUpdateNotification(updateInfo) {
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm';
    notification.innerHTML = `
        <div class="flex items-start gap-3">
            <i data-lucide="download" class="w-5 h-5 mt-0.5"></i>
            <div class="flex-1">
                <h4 class="font-semibold">Mise à jour disponible</h4>
                <p class="text-sm mt-1">Version ${updateInfo.latestVersion} disponible (vous avez ${updateInfo.currentVersion})</p>
                <div class="flex gap-2 mt-3">
                    <button onclick="downloadUpdate('${updateInfo.downloadUrl}')" class="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium hover:bg-blue-50">
                        Télécharger
                    </button>
                    <button onclick="dismissUpdateNotification(this)" class="bg-blue-700 px-3 py-1 rounded text-sm font-medium hover:bg-blue-800">
                        Plus tard
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Initialiser les icônes Lucide de manière sécurisée
    initLucideIcons();
    
    // Auto-dismiss après 10 secondes
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 10000);
}

// Télécharger la mise à jour
function downloadUpdate(downloadUrl) {
    if (!downloadUrl) {
        showToast("Lien de téléchargement non disponible", "error");
        return;
    }
    
    // Ouvrir le lien dans un nouvel onglet
    window.open(downloadUrl, '_blank');
    showToast("Redirection vers le téléchargement...", "info");
}

// Masquer la notification
function dismissUpdateNotification(button) {
    button.closest('.fixed').remove();
}

// Démarrer la vérification automatique
function startAutoUpdateCheck() {
    // Vérifier immédiatement
    checkForUpdates().then(updateInfo => {
        if (updateInfo && updateInfo.available) {
            showUpdateNotification(updateInfo);
        }
        lastUpdateCheck = new Date();
    });
    
    // Puis vérifier périodiquement
    updateCheckInterval = setInterval(() => {
        if (navigator.onLine) {
            checkForUpdates().then(updateInfo => {
                if (updateInfo && updateInfo.available) {
                    showUpdateNotification(updateInfo);
                }
                lastUpdateCheck = new Date();
            });
        }
    }, UPDATE_CHECK_INTERVAL);
}

// Arrêter la vérification automatique
function stopAutoUpdateCheck() {
    if (updateCheckInterval) {
        clearInterval(updateCheckInterval);
        updateCheckInterval = null;
    }
}

// Écouter les changements de connexion
window.addEventListener('online', () => {
    console.log("Connexion rétablie - vérification des mises à jour...");
    checkForUpdates().then(updateInfo => {
        if (updateInfo && updateInfo.available) {
            showUpdateNotification(updateInfo);
        }
    });
});

window.addEventListener('offline', () => {
    console.log("Mode offline activé");
});

// Fonction pour initialiser les icônes Lucide de manière sécurisée
function initLucideIcons() {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        try {
            lucide.createIcons();
        } catch (error) {
            console.error("Erreur lors de l'initialisation des icônes Lucide:", error);
        }
    }
}

// Ajouter au démarrage de l'application
function initUpdateSystem() {
    if (navigator.onLine) {
        startAutoUpdateCheck();
    }
}
