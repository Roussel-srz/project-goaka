// === CONFIGURATION ===
const STORAGE_KEY = "enterprise_pro_db_v2.3";
const ADMIN_PASSWORD = ""; // Mot de passe par défaut (Ã  configurer via l'interface)
let mainChart = null;
let lucideInitialized = false;
window.confirmCallback = null;
window.authCallback = null;
let cart = [];
let currentInvoiceNumber = 1;

// === PERMISSIONS REFERENCE ===
const DEFAULT_PERMISSIONS = {
    dashboard: true, stock: true, sales: true, credits: true, expenses: true, logs: true, reports: true, settings: true,
    stockAdd: true, stockEdit: true, stockDelete: true, stockAdjust: true,
    salesCreate: true, salesCancel: true,
    creditsPay: true, creditsDelete: true,
    expensesAdd: true, expensesEdit: true, expensesDelete: true,
    configCompany: true, configSecurity: true, configData: true, configPostes: true
};

// === DATABASE ENGINE ===
let db = {
    produits: [],
    ventes: [],
    depenses: [],
    credits: [],
    stockMovements: [],
    logs: [],
    config: {
        version: "1.0.0",
        currency: "Ar",
        lastUpdate: new Date().toISOString(),
        caisseMin: 0,
        autoBackup: true,
        authEnabled: true,
        adminPassword: ADMIN_PASSWORD,
        categories: ["Électronique", "Mobilier", "Fournitures", "Alimentaire", "Autre"],
        expenseCategories: [], // Catégories de dépenses personnalisées
        invoiceCounter: 1,
        company: {
            name: "INFO PLUS (PORT-BERGE)",
            address: "",
            phone: "",
            nif: "",
            email: "",
            signature: "Le Gérant"
        },
        multiposteEnabled: false,
        postes: []
    }
};

// === INITIALIZATION ===
window.onload = function() {
    showLoading();
    
    // Add timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
        hideLoading();
        showToast("Chargement terminé avec timeout", "warning");
    }, 10000); // 10 seconds timeout
    
    try {
        loadDB();
        initLucide();
        switchTab('dashboard');
        updateUI();
        
        // Initialiser les dates par défaut
        document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('expense-modal-date').value = new Date().toISOString().split('T')[0];
        
        // Initialiser les catégories de dépenses
        updateExpenseCategoriesSelect();
        renderCategoriesList();
        
        // Initialiser le menu mobile
        setupMobileMenu();
        
        // Safe rendering functions - only existing ones
        safeRender(renderStock, 'stock');
        safeRender(renderSales, 'sales');
        safeRender(renderCredits, 'credits');
        safeRender(renderExpenses, 'expenses');
        safeRender(updateReports, 'reports'); // Changed from renderReports
        safeRender(updateDashboard, 'dashboard'); // Changed from renderDashboard
        safeRender(checkAlerts, 'alerts'); // Changed from renderAlerts
        
        loadCompanyInfo();

        // Start Auto-save
        setInterval(saveDB, 300000); // 5 minutes

        clearTimeout(loadingTimeout);
                hideLoading();
                checkPosteAndShowApp();
                applyPostePermissions();
            } catch(e) {
                console.error("Initialization Error", e);
                clearTimeout(loadingTimeout);
                hideLoading();
                showToast("Erreur lors de l'initialisation: " + e.message, "error");
            }
        };

// Safe render function to prevent errors
function safeRender(renderFunc, name) {
    try {
        renderFunc();
    } catch(e) {
        console.error(`Error rendering ${name}:`, e);
        // Continue with other renders even if one fails
    }
}

// Mobile menu functions
function setupMobileMenu() {
    const menuBtn = document.getElementById('mobile-menu-btn');
    const menuBtnBottom = document.getElementById('mobile-menu-btn-bottom');
    const mobileSidebar = document.getElementById('mobile-sidebar');
    
    if(menuBtn) {
        menuBtn.addEventListener('click', () => {
            mobileSidebar.classList.remove('hidden');
        });
    }
    
    if(menuBtnBottom) {
        menuBtnBottom.addEventListener('click', () => {
            mobileSidebar.classList.remove('hidden');
        });
    }
}

function closeMobileMenu() {
    const mobileSidebar = document.getElementById('mobile-sidebar');
    mobileSidebar.classList.add('hidden');
}

function showLoading() {
    document.getElementById('loading-overlay').classList.remove('hidden');
    document.getElementById('loading-overlay').classList.add('flex');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
    document.getElementById('loading-overlay').classList.remove('flex');
}

function initLucide() {
    if (!lucideInitialized && typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
        lucideInitialized = true;
    }
}

function setupEventListeners() {
    // Payment method change
    document.querySelectorAll('input[name="payment-method"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const creditInfo = document.getElementById('credit-info');
            if (this.value === 'credit') {
                creditInfo.classList.remove('hidden');
            } else {
                creditInfo.classList.add('hidden');
            }
        });
    });

    // Product select change for sale
    document.getElementById('sale-product').addEventListener('change', function() {
        const p = db.produits.find(x => x.id === this.value);
        if(p) {
            document.getElementById('sale-price').value = p.vente;
        }
    });

    // Product select change for stock adjustment
    document.getElementById('adjust-product').addEventListener('change', function() {
        const p = db.produits.find(x => x.id === this.value);
        if(p) {
            document.getElementById('product-cost-info').classList.remove('hidden');
            document.getElementById('product-cost').innerText = formatMoney(p.achat);
            updateAdjustmentCost();
        } else {
            document.getElementById('product-cost-info').classList.add('hidden');
        }
    });

    // Quantity change for stock adjustment
    document.getElementById('adjust-qty').addEventListener('input', updateAdjustmentCost);

    // Adjust type change
    document.querySelectorAll('input[name="adjust-type"]').forEach(radio => {
        radio.addEventListener('change', updateAdjustmentCost);
    });

    // Credit select change
    document.getElementById('credit-select').addEventListener('change', function() {
        const credit = db.credits.find(c => c.id === this.value);
        if(credit) {
            document.getElementById('credit-details').classList.remove('hidden');
            document.getElementById('credit-client').innerText = credit.clientName || 'Client Passager';
            document.getElementById('credit-balance').innerText = formatMoney(credit.balance);
            document.getElementById('credit-date').innerText = new Date(credit.date).toLocaleDateString('fr-FR');
            document.getElementById('credit-payment-amount').value = credit.balance;
            document.getElementById('credit-payment-amount').max = credit.balance;
        } else {
            document.getElementById('credit-details').classList.add('hidden');
        }
    });
    
    // Search input for mobile
    document.getElementById('search-stock').addEventListener('input', function() {
        renderStock();
        renderMobileStockList();
    });
    
    // Setup product search for sales
    setupProductSearch();
}

function updateAdjustmentCost() {
    const productId = document.getElementById('adjust-product').value;
    const qty = parseInt(document.getElementById('adjust-qty').value) || 0;
    const type = document.querySelector('input[name="adjust-type"]:checked').value;
    
    const product = db.produits.find(p => p.id === productId);
    if(product && qty > 0) {
        const totalCost = product.achat * qty;
        document.getElementById('total-cost').innerText = formatMoney(totalCost);
        
        if(type === 'add') {
            document.getElementById('total-cost').classList.remove('text-blue-600');
            document.getElementById('total-cost').classList.add('text-amber-600');
        } else {
            document.getElementById('total-cost').classList.remove('text-amber-600');
            document.getElementById('total-cost').classList.add('text-blue-600');
        }
    }
}

function loadCompanyInfo() {
    const company = db.config.company || {};
    
    // Update form fields
    document.getElementById('company-name').value = company.name || "INFO PLUS (PORT-BERGE)";
    document.getElementById('company-address').value = company.address || "";
    document.getElementById('company-phone').value = company.phone || "";
    document.getElementById('company-nif').value = company.nif || "";
    document.getElementById('company-email').value = company.email || "";
    document.getElementById('company-signature').value = company.signature || "Le Gérant";
    
    // Update logo preview
    updateLogoPreview(company.logo || null);
    
    // Show/hide remove button based on logo existence
    const removeBtn = document.getElementById('remove-logo-btn');
    if (removeBtn) {
        removeBtn.style.display = company.logo ? 'block' : 'none';
    }
    
    // Update mobile sidebar
    document.getElementById('mobile-sidebar-company-name').innerText = company.name;
    
    // Update settings display
    document.getElementById('settings-company-name').innerText = company.name;
}

        function updateCompanyInfo() {
            if(!canAccess('configCompany')) { showToast("Action non autorisée", "error"); return; }
            db.config.company = {
        name: document.getElementById('company-name').value.trim() || "INFO PLUS (PORT-BERGE)",
        address: document.getElementById('company-address').value.trim(),
        phone: document.getElementById('company-phone').value.trim(),
        nif: document.getElementById('company-nif').value.trim(),
        email: document.getElementById('company-email').value.trim(),
        signature: document.getElementById('company-signature').value.trim() || "Le Gérant",
        logo: db.config.company.logo || null
    };
    
    saveDB();
    loadCompanyInfo();
    showToast("Informations de l'entreprise mises Ã  jour", "success");
}

// Logo management functions
        function handleLogoUpload(event) {
            if(!canAccess('configCompany')) { showToast("Action non autorisée", "error"); return; }
            const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast("Veuillez sélectionner une image valide", "error");
        return;
    }
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        showToast("L'image ne doit pas dépasser 2MB", "error");
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const logoData = e.target.result;
        
        // Update database
        if (!db.config.company) db.config.company = {};
        db.config.company.logo = logoData;
        
        // Update preview
        updateLogoPreview(logoData);
        
        // Show remove button
        document.getElementById('remove-logo-btn').style.display = 'block';
        
        // Save to database
        saveDB();
        
        showToast("Logo ajouté avec succès", "success");
    };
    
    reader.readAsDataURL(file);
}

function removeLogo() {
    if(!canAccess('configCompany')) { showToast("Action non autorisée", "error"); return; }
    if (!confirm("Êtes-vous sûr de vouloir supprimer le logo ?")) return;
    
    // Remove from database
    if (db.config.company) {
        db.config.company.logo = null;
    }
    
    // Update preview
    updateLogoPreview(null);
    
    // Hide remove button
    document.getElementById('remove-logo-btn').style.display = 'none';
    
    // Clear file input
    document.getElementById('logo-upload').value = '';
    
    // Save to database
    saveDB();
    
    showToast("Logo supprimé", "success");
}

function updateLogoPreview(logoData) {
    const preview = document.getElementById('logo-preview');
    
    if (logoData) {
        preview.innerHTML = `<img src="${logoData}" alt="Logo" class="w-full h-full object-contain rounded-lg">`;
    } else {
        preview.innerHTML = '<i data-lucide="image" class="w-6 h-6 text-slate-400"></i>';
        initLucide(); // Re-initialize lucide icons
    }
}

function loadDB() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if(saved) {
            const parsed = JSON.parse(saved);
            // Migration from older versions
            if(!parsed.config) parsed.config = db.config;
            if(!parsed.credits) parsed.credits = [];
            if(!parsed.stockMovements) parsed.stockMovements = [];
            if(!parsed.config.adminPassword) parsed.config.adminPassword = ADMIN_PASSWORD;
            if(!parsed.config.authEnabled) parsed.config.authEnabled = true;
            if(!parsed.config.invoiceCounter) parsed.config.invoiceCounter = 1;
                    if(!parsed.config.company) parsed.config.company = db.config.company;
            if(!parsed.config.multiposteEnabled) parsed.config.multiposteEnabled = false;
            if(!parsed.config.postes) parsed.config.postes = [];
            
            // Ensure all products have category
            if(parsed.produits) {
                parsed.produits.forEach(p => {
                    if(!p.category) p.category = "Non catégorisé";
                });
            }

            db = parsed;
            addLog("Base de données chargée", "success");
        } else {
            addLog("Initialisation du système", "info");
        }
    } catch(e) {
        console.error("DB Load Error", e);
        showToast("Erreur de chargement des données", "error");
        // Initialize with default data on error
        addLog("Initialisation avec les données par défaut", "warning");
    }
}

function saveDB() {
    try {
        db.config.lastUpdate = new Date().toISOString();
        
        // Tenter de sauvegarder d'abord
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
        } catch (saveErr) {
            console.warn("Sauvegarde principale échouée, nettoyage en cours...", saveErr);
            
            // Si échec, supprimer TOUTES les anciennes sauvegardes
            const backupKeys = Object.keys(localStorage).filter(key => 
                key.startsWith(STORAGE_KEY + "_backup_")
            );
            
            backupKeys.forEach(key => {
                try {
                    localStorage.removeItem(key);
                    console.log("Suppression de la sauvegarde:", key);
                } catch (e) {}
            });
            
            // Réessayer la sauvegarde principale
            localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
            showToast("Espace libéré - sauvegarde effectuée", "success");
        }
        
        updateStorageSize();
        
        // Gestion des sauvegardes automatiques
        if(db.config.autoBackup) {
            // Nettoyer d'abord les anciennes sauvegardes
            const backupKeys = Object.keys(localStorage)
                .filter(key => key.startsWith(STORAGE_KEY + "_backup_"))
                .sort();
            
            // Garder seulement les 3 plus récentes (au lieu de 5)
            while(backupKeys.length >= 3) {
                const oldKey = backupKeys.shift();
                try {
                    localStorage.removeItem(oldKey);
                    console.log("Suppression ancienne sauvegarde:", oldKey);
                } catch(e) {}
            }
            
            // Créer nouvelle sauvegarde
            try {
                const backupKey = STORAGE_KEY + "_backup_" + Date.now();
                localStorage.setItem(backupKey, JSON.stringify(db));
            } catch(backupErr) {
                console.warn("Backup impossible (quota):", backupErr);
                // Ne pas afficher de toast pour éviter le spam
            }
        }
    } catch(e) {
        console.error("Save DB Error", e);
        // Ne pas afficher de toast pour les erreurs de quota mineures
        if (!e.toString().includes('QuotaExceededError')) {
            showToast("Erreur de sauvegarde", "error");
        }
    }
}

// === MULTIPOSTE SYSTEM ===
const POSTE_SESSION_KEY = 'enterprise_current_poste';

function getCurrentPoste() {
    if(!db.config.multiposteEnabled) return null;
    const id = sessionStorage.getItem(POSTE_SESSION_KEY);
    if(!id) return null;
    return db.config.postes.find(p => p.id === id) || null;
}

function canAccess(permission) {
    if(!db.config.multiposteEnabled) return true;
    if(sessionStorage.getItem(POSTE_SESSION_KEY) === '_admin_') return true;
    const poste = getCurrentPoste();
    if(!poste) return false;
    if(!poste.permissions) poste.permissions = { ...DEFAULT_PERMISSIONS };
    return poste.permissions[permission] !== false;
}

function requirePostePermission(perm, action, msg) {
    if(!canAccess(perm)) { showToast(msg || "Action non autorisée pour ce poste", "error"); return; }
    if(action && typeof action === 'function') action();
}

function loginPoste(posteId, password) {
    const poste = db.config.postes.find(p => p.id === posteId);
    if(!poste) return false;
    if(poste.password !== password) return false;
    sessionStorage.setItem(POSTE_SESSION_KEY, posteId);
    return true;
}

// Nouvelle fonction pour afficher le modal admin
function showAdminLoginModal() {
    // Nettoyer les champs
    document.getElementById('admin-login-password').value = '';
    document.getElementById('admin-login-error').classList.add('hidden');
    
    // Debug info
    const dbReady = !!db && !!db.config;
    const storedLen = dbReady ? String(db.config.adminPassword || '').length : '?';
    console.log("[DEBUG Admin] Ouverture modal admin | db prêt:", dbReady, "| Mdp stocké (long.):", storedLen);
    addLog("[DEBUG Admin] Ouverture modal connexion admin", "info");
    
    // Ouvrir le modal
    // S'assurer que l'overlay de chargement est masqué (évite qu'il cache le modal)
    try { hideLoading(); } catch(e) {}
    // Si un ancêtre est masqué (par ex. #app-content display:none), détacher le modal
    try {
        const modalEl = document.getElementById('modal-admin-login');
        if(modalEl) {
            let ancestor = modalEl.parentElement;
            let hiddenAncestor = false;
            while(ancestor) {
                try {
                    const cs = window.getComputedStyle(ancestor);
                    if(cs.display === 'none') { hiddenAncestor = true; break; }
                } catch(e) {}
                ancestor = ancestor.parentElement;
            }
            if(hiddenAncestor) {
                try { document.body.appendChild(modalEl); } catch(e) { console.warn('Could not move modal to body', e); }
            }
        }
    } catch(e) {}
    openModal('modal-admin-login');
}

// Nouvelle fonction pour exécuter la connexion admin
function executeAdminLogin() {
    const password = document.getElementById('admin-login-password').value;
    const errorDiv = document.getElementById('admin-login-error');
    
    console.log('[executeAdminLogin] Tentative de connexion, longueur saisie:', password ? password.length : 0);
    
    if (!password) {
        errorDiv.innerText = "Veuillez entrer le mot de passe administrateur";
        errorDiv.classList.remove('hidden');
        return;
    }
    
    // Vérifier le mot de passe
    const stored = (db.config.adminPassword === undefined || db.config.adminPassword === null) ? '' : String(db.config.adminPassword).trim();
    const entered = password.trim();
    const match = entered === stored;
    
    const msg = `[DEBUG Admin] Entré: ${entered.length} car. | Stocké: ${stored.length} car. | Match: ${match}`;
    console.log(msg);
    addLog(msg, "info");
    
    if (!match) {
        errorDiv.innerText = "Mot de passe administrateur incorrect";
        errorDiv.classList.remove('hidden');
        
        // Hint pour le débogage
        if (stored === 'zaza') {
            const hint = "Le mot de passe par défaut est 'zaza'";
            console.warn(hint);
            addLog(hint, "warning");
        }
        return;
    }
    
    // Connexion réussie
    console.log("[DEBUG Admin] Connexion admin OK");
    addLog("[DEBUG Admin] Connexion admin réussie", "success");
    
    // Enregistrer la session
    sessionStorage.setItem(POSTE_SESSION_KEY, '_admin_');
    
    // Fermer le modal
    closeModal('modal-admin-login');
    
    // Masquer les overlays et afficher l'app
    const posteOverlay = document.getElementById('poste-login-overlay');
    const licenseOverlay = document.getElementById('license-overlay');
    const appContent = document.getElementById('app-content');
    
    if (posteOverlay) posteOverlay.style.display = 'none';
    if (licenseOverlay) licenseOverlay.style.display = 'none';
    if (appContent) appContent.style.display = 'block';
    
    // Appliquer les permissions
    applyPostePermissions();
    
    showToast("Connexion administrateur réussie", "success");
}

// Modifier la fonction showAdminLoginPoste existante pour utiliser le nouveau modal
function showAdminLoginPoste() {
    showAdminLoginModal();
}

// Améliorer loginAsAdmin pour garder la compatibilité
function loginAsAdmin(adminPassword) {
    const stored = (db.config.adminPassword === undefined || db.config.adminPassword === null) ? '' : String(db.config.adminPassword).trim();
    const entered = (adminPassword || '').trim();
    const match = entered === stored;
    
    const msg = `[DEBUG Admin] Entré: ${entered.length} car. | Stocké: ${stored.length} car. | Match: ${match}`;
    console.log(msg);
    addLog(msg, "info");
    
    if(!match) {
        const hint = "[DEBUG Admin] Si mot de passe vide par défaut: appuyez OK sans rien taper. Sinon configurez dans Paramètres > Sécurité.";
        console.warn(hint);
        addLog(hint, "warning");
        return false;
    }
    
    sessionStorage.setItem(POSTE_SESSION_KEY, '_admin_');
    console.log("[DEBUG Admin] Connexion admin OK");
    addLog("[DEBUG Admin] Connexion admin réussie", "success");
    return true;
}

function logoutPoste() {
    sessionStorage.removeItem(POSTE_SESSION_KEY);
    document.getElementById('poste-login-overlay').style.display = 'flex';
    document.getElementById('app-content').style.display = 'none';
}

function getFirstAccessibleTab() {
    const tabs = ['dashboard','stock','sales','credits','expenses','logs','reports','settings'];
    return tabs.find(t => canAccess(t)) || 'dashboard';
}

function debugAdminPassword() {
    const stored = db.config.adminPassword;
    console.log("=== DEBUG MOT DE PASSE ADMIN ===");
    console.log("Valeur stockée:", stored);
    console.log("Type:", typeof stored);
    console.log("Longueur:", stored ? stored.length : 0);
    console.log("Caractères:", stored ? stored.split('').map(c => c.charCodeAt(0)) : []);
    console.log("Est 'zaza'?:", stored === 'zaza');
    console.log("Est vide?:", stored === '');
    console.log("=================================");
    
    showToast("Info admin dans la console (F12)", "info");
}

function applyPostePermissions() {
    const btnChanger = document.getElementById('btn-changer-poste');
    if(btnChanger) btnChanger.classList.toggle('hidden', !db.config.multiposteEnabled);
    if(!db.config.multiposteEnabled) return;
    const isAdmin = sessionStorage.getItem(POSTE_SESSION_KEY) === '_admin_';
    const tabs = ['dashboard','stock','sales','credits','expenses','logs','reports','settings'];
    tabs.forEach(tab => {
        const btn = document.getElementById('btn-' + tab);
        const mobileBtn = document.querySelector(`.mobile-link[data-tab="${tab}"]`);
        const mobileSidebarBtn = document.querySelector(`.mobile-sidebar-link[data-tab="${tab}"]`);
        const hasAccess = isAdmin || canAccess(tab);
        if(btn) { btn.style.display = hasAccess ? '' : 'none'; }
        if(mobileBtn) { mobileBtn.style.display = hasAccess ? '' : 'none'; }
        if(mobileSidebarBtn) { mobileSidebarBtn.style.display = hasAccess ? '' : 'none'; }
    });
    const cards = document.querySelectorAll('#tab-settings .glass-card');
    cards.forEach(card => {
        if(card.id === 'postes-management-card') { card.style.display = (isAdmin || canAccess('configPostes')) ? '' : 'none'; return; }
        if(card.querySelector('[onclick="updateCompanyInfo()"]')) { card.style.display = (isAdmin || canAccess('configCompany')) ? '' : 'none'; return; }
        if(card.querySelector('#auth-enabled')) { card.style.display = (isAdmin || canAccess('configSecurity')) ? '' : 'none'; return; }
        if(card.querySelector('[onclick="exportData()"]')) { card.style.display = (isAdmin || canAccess('configData')) ? '' : 'none'; }
    });
    // Si poste restreint et tableau de bord non accessible : basculer vers le premier onglet autorisé
    if(!isAdmin && !canAccess('dashboard')) {
        const activeTabEl = document.querySelector('.tab-content.active');
        const currentTab = activeTabEl ? (activeTabEl.id || '').replace('tab-', '') : 'dashboard';
        if(!canAccess(currentTab)) {
            switchTab(getFirstAccessibleTab());
        }
    }
}

function checkPosteAndShowApp() {
    const overlay = document.getElementById('poste-login-overlay');
    if(!overlay) return;
    if(!db.config.multiposteEnabled) {
        overlay.style.display = 'none';
        const app = document.getElementById('app-content');
        if(app) app.style.display = 'block';
        return;
    }
    if(getCurrentPoste() || sessionStorage.getItem(POSTE_SESSION_KEY) === '_admin_') {
        overlay.style.display = 'none';
        const app = document.getElementById('app-content');
        if(app) app.style.display = 'block';
        applyPostePermissions();
    } else {
        populatePosteLoginSelect();
        overlay.style.display = 'flex';
        const app = document.getElementById('app-content');
        if(app) app.style.display = 'none';
    }
}

function populatePosteLoginSelect() {
    const sel = document.getElementById('poste-login-select');
    if(!sel) return;
    sel.innerHTML = '<option value="">-- Choisir un poste --</option>' +
        (db.config.postes || []).map(p => `<option value="${p.id}">${escapeHtml(p.name || p.id)}</option>`).join('');
}

function doPosteLogin() {
    const posteId = document.getElementById('poste-login-select').value;
    const password = document.getElementById('poste-login-password').value;
    if(!posteId) { showToast("Sélectionnez un poste", "error"); return; }
    if(loginPoste(posteId, password)) {
        document.getElementById('poste-login-password').value = '';
        checkPosteAndShowApp();
        addLog(`Connexion poste: ${db.config.postes.find(p=>p.id===posteId)?.name || posteId}`, "info");
    } else {
        showToast("Mot de passe incorrect", "error");
    }
}

function resetAdminPasswordPoste() {
    // Function removed to prevent insecure password reset via UI.
    // Previously allowed resetting admin password to default 'zaza'.
    // If an admin-initiated reset workflow is required, implement a secure flow.
}



function toggleMultiposte() {
    const cb = document.getElementById('multiposte-enabled');
    db.config.multiposteEnabled = cb ? cb.checked : false;
    saveDB();
    renderPostesList();
    showToast(db.config.multiposteEnabled ? "Mode multiposte activé" : "Mode multiposte désactivé", "success");
}

function renderPostesList() {
    const list = document.getElementById('postes-list');
    const cb = document.getElementById('multiposte-enabled');
    if(!list) return;
    if(cb) cb.checked = db.config.multiposteEnabled;
    list.innerHTML = (db.config.postes || []).map(p => `
        <div class="p-3 bg-slate-50 rounded-lg flex justify-between items-center">
            <div>
                <span class="font-medium">${escapeHtml(p.name || p.id)}</span>
            </div>
            <div class="flex gap-2">
                <button onclick="editPoste('${p.id}')" class="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">
                    <i data-lucide="edit-2" class="w-4 h-4"></i>
                </button>
                <button onclick="deletePoste('${p.id}')" class="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    `).join('') || '<p class="text-slate-500 text-sm">Aucun poste configuré. Cliquez sur "Nouveau poste".</p>';
    initLucide();
}

function savePoste(e) {
    e.preventDefault();
    const editId = document.getElementById('poste-edit-id').value;
    const name = document.getElementById('poste-name').value.trim();
    const password = document.getElementById('poste-password').value;
    const perms = {};
    document.querySelectorAll('.poste-perm').forEach(cb => {
        perms[cb.dataset.perm] = cb.checked;
    });
    if(!name) { showToast("Nom requis", "error"); return; }
    const poste = {
        id: editId || 'poste_' + Date.now(),
        name,
        password: password || (db.config.postes.find(p=>p.id===editId)?.password || ''),
        permissions: perms,
        createdAt: editId ? (db.config.postes.find(p=>p.id===editId)?.createdAt) : new Date().toISOString()
    };
    if(!editId && !password) { showToast("Mot de passe requis pour un nouveau poste", "error"); return; }
    if(password && password.length < 4) { showToast("Mot de passe min. 4 caractères", "error"); return; }
    if(editId) {
        const idx = db.config.postes.findIndex(p => p.id === editId);
        if(idx >= 0) db.config.postes[idx] = { ...db.config.postes[idx], ...poste };
    } else {
        poste.password = password;
        db.config.postes.push(poste);
    }
    saveDB();
    closeModal('modal-poste');
    renderPostesList();
    showToast("Poste enregistré", "success");
}

function editPoste(id) {
    const p = db.config.postes.find(x => x.id === id);
    if(!p) return;
    document.getElementById('poste-edit-id').value = p.id;
    document.getElementById('poste-name').value = p.name || '';
    document.getElementById('poste-password').value = '';
    document.getElementById('poste-password').required = false;
    document.getElementById('poste-pwd-hint').classList.remove('hidden');
    document.querySelectorAll('.poste-perm').forEach(cb => {
        cb.checked = p.permissions && p.permissions[cb.dataset.perm] !== false;
    });
    document.getElementById('poste-modal-title').innerText = 'Modifier le poste';
    openModal('modal-poste');
}

function deletePoste(id) {
    const p = db.config.postes.find(x => x.id === id);
    if(!p) return;
    if(!confirm(`Supprimer le poste "${p.name}" ?`)) return;
    db.config.postes = db.config.postes.filter(x => x.id !== id);
    saveDB();
    renderPostesList();
    showToast("Poste supprimé", "success");
}

// === NAVIGATION ===
function switchTab(tabId) {
    if(db.config.multiposteEnabled && !canAccess(tabId) && sessionStorage.getItem(POSTE_SESSION_KEY) !== '_admin_') {
        showToast("Accès non autorisé à cette section", "error");
        return;
    }
    // Hide all
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    // Show target
    document.getElementById('tab-' + tabId).classList.add('active');
    
    // Sidebar buttons
    document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));
    const desktopBtn = document.getElementById('btn-' + tabId);
    if(desktopBtn) desktopBtn.classList.add('active');

    // Mobile buttons
    document.querySelectorAll('.mobile-link').forEach(b => {
        b.classList.remove('text-blue-600', 'active');
        b.classList.add('text-slate-400');
        if(b.dataset.tab === tabId) {
            b.classList.add('text-blue-600', 'active');
        }
    });

    // Header Title
    const titles = {
        dashboard: 'Tableau de bord',
        stock: 'Gestion du Stock',
        sales: 'Ventes & Facturation',
        credits: 'Crédits Clients',
        expenses: 'Dépenses / Caisse',
        logs: 'Journal du Système',
        reports: 'Rapports',
        settings: 'Paramètres'
    };
    document.getElementById('current-tab-title').innerText = titles[tabId] || 'Application';

    updateUI();
    initLucide();
    
    // Scroll to top
    document.getElementById('scroll-area').scrollTop = 0;
    
            // Update mobile-specific displays
            if(tabId === 'stock') {
                renderMobileStockList();
            } else if(tabId === 'credits') {
                renderMobileCreditsList();
            } else if(tabId === 'expenses') {
                renderMobileExpensesList();
                updateExpenseCategoriesSelect();
                renderCategoriesList();
            } else if(tabId === 'settings') {
                renderPostesList();
            }
        }

// === MOBILE-SPECIFIC RENDER FUNCTIONS ===
function renderMobileStockList() {
    const container = document.getElementById('mobile-stock-list');
    if(!container) return;
    
    const search = document.getElementById('search-stock')?.value.toLowerCase() || '';
    const categoryFilter = document.getElementById('filter-category')?.value || '';
    const statusFilter = document.getElementById('filter-stock-status')?.value || '';
    
    let filtered = db.produits.filter(p => {
        const matchesSearch = p.nom.toLowerCase().includes(search) || 
                             p.fournisseur.toLowerCase().includes(search) ||
                             p.category.toLowerCase().includes(search);
        const matchesCategory = !categoryFilter || p.category === categoryFilter;
        let matchesStatus = true;
        
        if(statusFilter === 'critique') {
            matchesStatus = p.stock <= p.min && p.stock > 0;
        } else if(statusFilter === 'zero') {
            matchesStatus = p.stock === 0;
        } else if(statusFilter === 'normal') {
            matchesStatus = p.stock > p.min;
        }
        
        return matchesSearch && matchesCategory && matchesStatus;
    });
    
    if(filtered.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-slate-400">
                <i data-lucide="package" class="w-12 h-12 mx-auto mb-2 opacity-30"></i>
                <p class="text-sm">Aucun produit trouvé</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filtered.map(p => {
        let statusClass = '';
        let statusText = '';
        if(p.stock === 0) {
            statusClass = 'bg-red-100 text-red-600';
            statusText = 'Épuisé';
        } else if(p.stock <= p.min) {
            statusClass = 'bg-amber-100 text-amber-600';
            statusText = 'Critique';
        } else {
            statusClass = 'bg-emerald-100 text-emerald-600';
            statusText = 'Normal';
        }
        
        const margin = ((p.vente - p.achat) / p.achat * 100).toFixed(1);
        
        return `
        <div class="glass-card p-4 rounded-xl shadow-sm">
            <div class="flex justify-between items-start mb-2">
                <div class="flex-1">
                    <div class="font-bold text-slate-700 text-sm">${p.nom}</div>
                    <div class="text-xs text-slate-500">${p.category}</div>
                </div>
                <div class="flex gap-2">
                    <button onclick="editProduct('${p.id}')" class="p-2 bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300 rounded-lg transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                    </button>
                    <button onclick="deleteProduct('${p.id}')" class="p-2 bg-red-100 text-red-700 hover:bg-red-200 border border-red-300 rounded-lg transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-2 mb-3">
                <div class="text-xs">
                    <div class="text-slate-500">Fournisseur</div>
                    <div class="font-medium">${p.fournisseur}</div>
                </div>
                <div class="text-xs">
                    <div class="text-slate-500">Stock</div>
                    <div class="flex flex-col gap-1">
                        <span class="px-2 py-0.5 rounded-full text-xs ${statusClass}">${statusText}</span>
                        <div class="font-bold text-slate-600">${p.stock} unité(s)</div>
                    </div>
                </div>
                <div class="text-xs">
                    <div class="text-slate-500">Achat</div>
                    <div class="font-medium">${formatMoney(p.achat)}</div>
                </div>
                <div class="text-xs">
                    <div class="text-slate-500">Vente</div>
                    <div class="font-medium">${formatMoney(p.vente)} <span class="text-emerald-600">+${margin}%</span></div>
                </div>
            </div>
            
            <div class="flex gap-2">
                <button onclick="openStockAdjust('${p.id}', 10, 'add')" class="flex-1 px-3 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-medium flex items-center justify-center gap-1">
                    <i data-lucide="plus" class="w-3 h-3"></i> Ajouter
                </button>
                <button onclick="openStockAdjust('${p.id}', 1, 'remove')" class="flex-1 px-3 py-2 bg-amber-50 text-amber-600 rounded-lg text-xs font-medium flex items-center justify-center gap-1">
                    <i data-lucide="minus" class="w-3 h-3"></i> Retirer
                </button>
            </div>
        </div>
        `;
    }).join('');
    
    initLucide();
}

function renderMobileCreditsList() {
    const container = document.getElementById('mobile-credits-list');
    if(!container) return;
    
    if(db.credits.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-slate-400">
                <i data-lucide="credit-card" class="w-12 h-12 mx-auto mb-2 opacity-30"></i>
                <p class="text-sm">Aucun crédit en cours</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = db.credits.map(c => {
        let statusClass = '';
        let statusText = '';
        
        if(c.status === 'paid') {
            statusClass = 'badge-success';
            statusText = 'Soldé';
        } else {
            const days = Math.floor((new Date() - new Date(c.date)) / (1000 * 60 * 60 * 24));
            if(days > 30) {
                statusClass = 'badge-danger';
                statusText = 'En retard';
            } else {
                statusClass = 'badge-warning';
                statusText = 'En attente';
            }
        }
        
        return `
        <div class="glass-card p-4 rounded-xl shadow-sm">
            <div class="flex justify-between items-start mb-2">
                <div class="flex-1">
                    <div class="font-bold text-slate-700 text-sm">${c.clientName || 'Client Passager'}</div>
                    <div class="text-xs text-slate-500">Facture #${String(c.invoiceNumber).padStart(3, '0')}</div>
                </div>
                <span class="px-2 py-1 text-xs rounded-full ${statusClass}">${statusText}</span>
            </div>
            
            <div class="grid grid-cols-2 gap-2 mb-3">
                <div class="text-xs">
                    <div class="text-slate-500">Date</div>
                    <div class="font-medium">${new Date(c.date).toLocaleDateString('fr-FR')}</div>
                </div>
                <div class="text-xs">
                    <div class="text-slate-500">Total</div>
                    <div class="font-medium">${formatMoney(c.totalAmount)}</div>
                </div>
                <div class="text-xs">
                    <div class="text-slate-500">Payé</div>
                    <div class="font-medium text-emerald-600">${formatMoney(c.paidAmount)}</div>
                </div>
                <div class="text-xs">
                    <div class="text-slate-500">Reste</div>
                    <div class="font-medium text-rose-600">${formatMoney(c.balance)}</div>
                </div>
            </div>
            
            ${c.status === 'pending' ? `
            <div class="flex gap-2">
                <button onclick="openCreditPayment('${c.id}')" class="flex-1 px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1">
                    <i data-lucide="credit-card" class="w-3 h-3"></i> Régler
                </button>
                <button onclick="requireAuth(() => {deleteCredit('${c.id}')})" class="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-medium">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
            </div>
            ` : ''}
        </div>
        `;
    }).join('');
    
    initLucide();
}

function renderMobileExpensesList() {
    const container = document.getElementById('mobile-expenses-list');
    if(!container) return;
    
    const categoryFilter = document.getElementById('expense-filter-category')?.value || '';
    const monthFilter = document.getElementById('expense-filter-month')?.value || '';
    
    let filteredExpenses = db.depenses;
    
    if(categoryFilter) {
        filteredExpenses = filteredExpenses.filter(e => e.category === categoryFilter);
    }
    
    if(monthFilter) {
        const [year, month] = monthFilter.split('-');
        filteredExpenses = filteredExpenses.filter(e => {
            const expenseDate = new Date(e.date);
            return expenseDate.getFullYear() == year && 
                   (expenseDate.getMonth() + 1) == month;
        });
    }
    
    if(filteredExpenses.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-slate-400">
                <i data-lucide="receipt" class="w-12 h-12 mx-auto mb-2 opacity-30"></i>
                <p class="text-sm">Aucune dépense</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredExpenses.map(e => {
        return `
        <div class="glass-card p-4 rounded-xl shadow-sm">
            <div class="flex justify-between items-start mb-2">
                <div class="flex-1">
                    <div class="font-bold text-slate-700 text-sm">${e.motif}</div>
                    <div class="text-xs text-slate-500">${new Date(e.date).toLocaleDateString('fr-FR', { 
                        day: '2-digit', 
                        month: '2-digit'
                    })}</div>
                </div>
                <div class="flex gap-2">
                    <button onclick="editExpense('${e.id}')" class="p-2 bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300 rounded-lg transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                    </button>
                    <button onclick="deleteExpense('${e.id}')" class="p-2 bg-red-100 text-red-700 hover:bg-red-200 border border-red-300 rounded-lg transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            </div>
            
            <div class="flex justify-between items-center">
                <span class="px-2 py-1 text-xs rounded-full ${e.category === 'achat_stock' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}">${e.category}</span>
                <div class="font-bold text-amber-600">-${formatMoney(e.amount)}</div>
            </div>
        </div>
        `;
    }).join('');
    
    initLucide();
}

// Update cart count for mobile
function updateCartDisplay() {
    const cartItems = document.getElementById('cart-items');
    const clearBtn = document.getElementById('clear-cart-btn');
    const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
    
    // Update cart count
    document.getElementById('cart-count').innerText = `${cart.length} article(s)`;
    
    // Show/hide clear cart button
    if(cart.length > 0) {
        clearBtn.classList.remove('hidden');
    } else {
        clearBtn.classList.add('hidden');
    }
    
    if(cart.length === 0) {
        cartItems.innerHTML = `
            <div class="text-center py-6 md:py-8 text-slate-400">
                <i data-lucide="shopping-cart" class="w-8 h-8 md:w-12 md:h-12 mx-auto mb-2 opacity-30"></i>
                <p class="text-sm">Aucun article ajouté</p>
            </div>
        `;
    } else {
        cartItems.innerHTML = cart.map((item, index) => {
            const product = db.produits.find(p => p.id === item.productId);
            const stockStatus = product ? (product.stock <= 0 ? 'text-red-500' : product.stock < 5 ? 'text-amber-500' : 'text-green-500') : 'text-slate-500';
            const stockText = product ? `Stock: ${product.stock}` : 'Stock: ?';
            
            return `
                <div class="flex items-center justify-between p-2 md:p-3 bg-white rounded-lg border border-slate-200 hover:border-blue-300 transition-colors">
                    <div class="flex-1 min-w-0">
                        <div class="font-medium text-sm text-slate-800 truncate">${product ? product.nom : 'Produit inconnu'}</div>
                        <div class="flex items-center gap-3 text-xs text-slate-500">
                            <span>${item.quantity} Ã— ${formatMoney(item.price)}</span>
                            <span class="${stockStatus}">${stockText}</span>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="font-bold text-blue-600 text-sm">${formatMoney(item.total)}</div>
                        <button onclick="removeFromCart(${index})" class="text-xs text-red-400 hover:text-red-600">
                            <i data-lucide="trash-2" class="w-3 h-3"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // Update totals
    document.getElementById('invoice-subtotal').innerText = formatMoney(subtotal);
    document.getElementById('invoice-total').innerText = formatMoney(subtotal);
    
    // Re-initialize lucide icons
    setTimeout(() => initLucide(), 100);
}

// === AUTHENTICATION SYSTEM ===
function requireAuth(action, message = "Cette action nécessite une authentification.") {
    if(!db.config.authEnabled) {
        if(action && typeof action === 'function') {
            action();
        }
        return true;
    }
    
    showAuthModal(message, action);
    return false;
}

function showAuthModal(message, callback) {
    console.log('[showAuthModal] message:', message);
    document.getElementById('auth-message').innerText = message;
    document.getElementById('auth-password').value = '';
    document.getElementById('auth-error').classList.add('hidden');
    window.authCallback = callback;
    openModal('modal-auth');
}

function executeAuth() {
    console.log('[executeAuth] called');
    const password = document.getElementById('auth-password').value;
    console.log('[executeAuth] entered password length', password ? password.length : 0);
    if(password === db.config.adminPassword) {
        console.log('[executeAuth] password OK');
        console.log('[executeAuth] authCallback exists?', !!window.authCallback);
        // Capture callback before closing modal (closeModal may clear it)
        const cb = window.authCallback;
        try {
            closeModal('modal-auth');
        } catch(e) { console.error('[executeAuth] closeModal error', e); }
        if(cb) {
            try {
                console.log('[executeAuth] calling authCallback');
                cb();
                console.log('[executeAuth] authCallback returned');
            } catch(cbErr) {
                console.error('[executeAuth] authCallback error', cbErr);
            }
        } else {
            console.warn('[executeAuth] no authCallback to call');
        }
        window.authCallback = null;
    } else {
        console.log('[executeAuth] password incorrect');
        document.getElementById('auth-error').innerText = "Mot de passe incorrect";
        document.getElementById('auth-error').classList.remove('hidden');
    }
}

        function updatePassword() {
            if(!canAccess('configSecurity')) { showToast("Action non autorisée", "error"); return; }
            const current = document.getElementById('current-password').value;
    const newPass = document.getElementById('new-password').value;
    const confirm = document.getElementById('confirm-password').value;

    if(current !== db.config.adminPassword) {
        showToast("Mot de passe actuel incorrect", "error");
        return;
    }

    if(newPass.length < 4) {
        showToast("Le mot de passe doit contenir au moins 4 caractères", "error");
        return;
    }

    if(newPass !== confirm) {
        showToast("Les mots de passe ne correspondent pas", "error");
        return;
    }

    db.config.adminPassword = newPass;
    saveDB();
    showToast("Mot de passe mis Ã  jour avec succès", "success");
    
    // Clear fields
    document.getElementById('current-password').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
}

        // === PRODUCT MANAGEMENT ===
        document.getElementById('form-product').onsubmit = function(e) {
            e.preventDefault();
            if(!canAccess('stockAdd') && !document.getElementById('edit-id').value) { showToast("Action non autorisée", "error"); return; }
            if(!canAccess('stockEdit') && document.getElementById('edit-id').value) { showToast("Action non autorisée", "error"); return; }
    
    const editId = document.getElementById('edit-id').value;
    const data = {
        id: editId || 'P' + Date.now() + Math.floor(Math.random() * 1000),
        nom: document.getElementById('prod-nom').value.trim(),
        category: document.getElementById('prod-category').value.trim() || "Non catégorisé",
        fournisseur: document.getElementById('prod-fournisseur').value.trim() || 'Inconnu',
        achat: parseFloat(document.getElementById('prod-achat').value),
        vente: parseFloat(document.getElementById('prod-vente').value),
        stock: parseInt(document.getElementById('prod-stock').value),
        min: parseInt(document.getElementById('prod-min').value) || 5,
        createdAt: editId ? db.produits.find(p => p.id === editId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    // Validation
    const validationError = validateProduct(data);
    if(validationError) {
        document.getElementById('product-error').innerText = validationError;
        document.getElementById('product-error').classList.remove('hidden');
        return;
    }

    // Add category to config if new
    if(data.category && !db.config.categories.includes(data.category)) {
        db.config.categories.push(data.category);
    }

    if(editId) {
        const idx = db.produits.findIndex(p => p.id === editId);
        db.produits[idx] = data;
        addLog(`Modification produit: ${data.nom}`, "info");
    } else {
        db.produits.push(data);
        addLog(`Nouveau produit: ${data.nom}`, "info");
    }

    saveDB();
    closeModal('modal-product');
    showToast("Matériel enregistré avec succès", "success");
    updateUI();
    
    // Update mobile display if on stock tab
    if(document.getElementById('tab-stock').classList.contains('active')) {
        renderMobileStockList();
    }
};

function validateProduct(data) {
    if(!data.nom || data.nom.length < 2) return "Le nom doit contenir au moins 2 caractères";
    if(isNaN(data.achat) || data.achat <= 0) return "Le prix d'achat doit Ãªtre supérieur Ã  0";
    if(isNaN(data.vente) || data.vente <= 0) return "Le prix de vente doit Ãªtre supérieur Ã  0";
    if(data.vente < data.achat) return "Le prix de vente doit Ãªtre supérieur au prix d'achat";
    if(isNaN(data.stock) || data.stock < 0) return "Le stock ne peut pas Ãªtre négatif";
    if(isNaN(data.min) || data.min < 0) return "Le seuil minimal ne peut pas Ãªtre négatif";
    return null;
}

        function deleteProduct(id) {
            if(!canAccess('stockDelete')) { showToast("Action non autorisée", "error"); return; }
            const product = db.produits.find(p => p.id === id);
            if(!product) return;
            
            requireAuth(() => {
        showConfirm(
            "Supprimer le produit",
            `ÃŠtes-vous sÃ»r de vouloir supprimer "${product.nom}" ? Cette action est irréversible.`,
            "Supprimer",
            "error",
            () => {
                db.produits = db.produits.filter(x => x.id !== id);
                addLog(`Produit supprimé: ${product.nom}`, "warning");
                saveDB();
                updateUI();
                showToast("Produit supprimé", "success");
            }
        );
    }, "Supprimer un produit nécessite une authentification.");
}

        function editProduct(id) {
            if(!canAccess('stockEdit')) { showToast("Action non autorisée", "error"); return; }
            const p = db.produits.find(x => x.id === id);
    document.getElementById('edit-id').value = p.id;
    document.getElementById('prod-nom').value = p.nom;
    document.getElementById('prod-category').value = p.category || "";
    document.getElementById('prod-fournisseur').value = p.fournisseur;
    document.getElementById('prod-achat').value = p.achat;
    document.getElementById('prod-vente').value = p.vente;
    document.getElementById('prod-stock').value = p.stock;
    document.getElementById('prod-min').value = p.min;
    
    document.getElementById('product-modal-title').innerText = "Modifier Matériel";
    document.getElementById('product-error').classList.add('hidden');
    openModal('modal-product');
}

        // Open stock adjust modal and prefill form for a given product
        function openStockAdjust(productId, qty = 1, type = 'add') {
            if(!canAccess('stockAdjust')) { showToast("Action non autorisée", "error"); return; }
            try {
        const select = document.getElementById('adjust-product');
        // Ensure select exists
        if (select) {
            // If option for productId is missing, try to add it from db.produits
            if (!select.querySelector(`option[value="${productId}"]`)) {
                const prod = (window.db && db.produits) ? db.produits.find(p => p.id === productId) : null;
                if (prod) {
                    const opt = document.createElement('option');
                    opt.value = prod.id;
                    opt.textContent = `${prod.nom} (Stock: ${prod.stock})`;
                    select.appendChild(opt);
                }
            }

            select.value = productId;
            const radio = document.querySelector(`input[name="adjust-type"][value="${type}"]`);
            if (radio) radio.checked = true;
            const q = document.getElementById('adjust-qty');
            if (q) q.value = qty;
        } else {
            console.warn('openStockAdjust: adjust-product select not found');
        }
    } catch (err) {
        console.error('openStockAdjust error', err);
        try { showToast('Erreur interne (voir console)', 'error'); } catch(e){}
    }
    openModal('modal-stock-adjust');
}

// === STOCK ADJUSTMENT ===
document.getElementById('form-stock-adjust').onsubmit = function(e) {
    e.preventDefault();
    
    console.log('[form-stock-adjust] submit');
    const productId = document.getElementById('adjust-product').value;
    const type = document.querySelector('input[name="adjust-type"]:checked').value;
    const qty = parseInt(document.getElementById('adjust-qty').value);
    const reason = document.getElementById('adjust-reason').value.trim() || "Ajustement manuel";
    console.log('[form-stock-adjust] values', { productId, type, qty, reason });
    
    const product = db.produits.find(p => p.id === productId);
    if(!product) {
        showToast("Veuillez sélectionner un produit", "error");
        return;
    }
    
    if(isNaN(qty) || qty <= 0) {
        showToast("Quantité invalide", "error");
        return;
    }
    
    const oldStock = product.stock;
    if(type === 'add') {
        product.stock += qty;
        
        // Create expense for stock purchase
        const totalCost = product.achat * qty;
        const expense = {
            id: 'EX' + Date.now(),
            date: new Date().toISOString(),
            category: 'achat_stock',
            motif: `Achat stock: ${product.nom} x${qty}`,
            amount: totalCost,
            productId: productId,
            productName: product.nom,
            quantity: qty,
            unitPrice: product.achat
        };
        
        db.depenses.unshift(expense);
        addLog(`Achat stock: ${product.nom} x${qty} = ${formatMoney(totalCost)}`, "info");
        
    } else {
        if(product.stock < qty) {
            showToast(`Stock insuffisant ! Il reste ${product.stock} unité(s)`, "error");
            return;
        }
        product.stock -= qty;
    }
    
    // Record stock movement
    const movement = {
        id: 'M' + Date.now(),
        date: new Date().toISOString(),
        productId: productId,
        productName: product.nom,
        type: type === 'add' ? 'achat' : 'retrait',
        quantity: qty,
        oldStock: oldStock,
        newStock: product.stock,
        reason: reason,
        cost: type === 'add' ? product.achat * qty : 0
    };
    
    db.stockMovements.unshift(movement);
    addLog(`Ajustement stock: ${product.nom} (${type === 'add' ? '+' : '-'}${qty}) - ${reason}`, "info");
    
    saveDB();
    console.log('[form-stock-adjust] saved movement', movement);
    closeModal('modal-stock-adjust');
    showToast("Stock ajusté avec succès", "success");
    updateUI();
};

        // === SALES & INVOICING ===
        function addToCart() {
            if(!canAccess('salesCreate')) { showToast("Action non autorisée", "error"); return; }
            const productId = document.getElementById('sale-product').value;
    const qty = parseInt(document.getElementById('sale-qty').value);
    const price = parseFloat(document.getElementById('sale-price').value);
    
    const product = db.produits.find(p => p.id === productId);
    if(!product) {
        showToast("Veuillez sélectionner un produit", "error");
        return;
    }
    
    if(isNaN(qty) || qty <= 0) {
        showToast("Quantité invalide", "error");
        return;
    }
    
    // Enhanced stock validation
    if(product.stock <= 0) {
        // Vérifier si c'est un service ou produit de productivité
        const isService = product.category && (
            product.category.toLowerCase().includes('service') || 
            product.category.toLowerCase().includes('productivité')
        );
        
        if(!isService) {
            showToast("Produit en rupture de stock", "error");
            return;
        }
    }
    
    if(product.stock < qty) {
            // Vérifier si c'est un service ou produit de productivité
            const isService = product.category && (
                product.category.toLowerCase().includes('service') || 
                product.category.toLowerCase().includes('productivité')
            );
            
            if(!isService) {
                showToast(`Stock insuffisant ! Disponible: ${product.stock} unité(s), Demandé: ${qty}`, "error");
                // Auto-adjust quantity to available stock
                document.getElementById('sale-qty').value = product.stock;
                return;
            }
        }
    
    // Check if product already in cart
    const existingIndex = cart.findIndex(item => item.productId === productId);
    if(existingIndex !== -1) {
        const newQuantity = cart[existingIndex].quantity + qty;
        
        // Check if combined quantity exceeds stock
        if(newQuantity > product.stock) {
            // Vérifier si c'est un service ou produit de productivité
            const isService = product.category && (
                product.category.toLowerCase().includes('service') || 
                product.category.toLowerCase().includes('productivité')
            );
            
            if(!isService) {
                showToast(`Stock insuffisant ! Total dans panier: ${newQuantity}, Disponible: ${product.stock}`, "error");
                return;
            }
        }
        
        cart[existingIndex].quantity = newQuantity;
        cart[existingIndex].total = cart[existingIndex].quantity * price;
        cart[existingIndex].cost = product.achat * cart[existingIndex].quantity;
    } else {
        cart.push({
            productId: productId,
            productName: product.nom,
            price: price,
            quantity: qty,
            total: price * qty,
            cost: product.achat * qty
        });
    }
    
    updateCartDisplay();
    document.getElementById('sale-qty').value = 1;
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartDisplay();
}

function clearCart() {
    if(cart.length === 0) return;
    
    showConfirm(
        "Vider le panier",
        "ÃŠtes-vous sÃ»r de vouloir vider complètement le panier ?",
        "Vider",
        "warning",
        () => {
            cart = [];
            updateCartDisplay();
            showToast("Panier vidé avec succès", "success");
        }
    );
}

        function completeSale() {
            if(!canAccess('salesCreate')) { showToast("Action non autorisée", "error"); return; }
            const clientName = document.getElementById('client-name').value.trim();
    const clientPhone = document.getElementById('client-phone').value.trim();
    const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;
    
    // Le nom du client est maintenant facultatif
    if(cart.length === 0) {
        showToast("Veuillez ajouter des articles au panier", "error");
        return;
    }
    
    const invoiceTotal = cart.reduce((sum, item) => sum + item.total, 0);
    const invoiceProfit = cart.reduce((sum, item) => sum + (item.total - item.cost), 0);
    
    // Generate invoice ID
    const invoiceId = 'INV' + String(currentInvoiceNumber).padStart(3, '0');
    
    // Check stock availability before completing sale
    let stockError = false;
    let errorMessage = "";
    
    cart.forEach(item => {
        const product = db.produits.find(p => p.id === item.productId);
        if(product) {
            // Vérifier si c'est un service ou produit de productivité
            const isService = product.category && (
                product.category.toLowerCase().includes('service') || 
                product.category.toLowerCase().includes('productivité')
            );
            
            if(!isService && product.stock < item.quantity) {
                stockError = true;
                errorMessage = `Stock insuffisant pour ${product.nom}. Disponible: ${product.stock}, Demandé: ${item.quantity}`;
            }
        }
    });
    
    if(stockError) {
        showToast(errorMessage, "error");
        return;
    }
    
    // Update stock for each product
    cart.forEach(item => {
        const product = db.produits.find(p => p.id === item.productId);
        if(product) {
            // Vérifier si c'est un service ou produit de productivité
            const isService = product.category && (
                product.category.toLowerCase().includes('service') || 
                product.category.toLowerCase().includes('productivité')
            );
            
            // Ne pas déduire le stock pour les services
            if(!isService) {
                product.stock -= item.quantity;
                // Ensure stock never goes below 0
                if(product.stock < 0) product.stock = 0;
            }
        }
    });
    
    // Create invoice
    const invoice = {
        id: invoiceId,
        number: currentInvoiceNumber,
        date: new Date().toISOString(),
        client: clientName || 'Client Passager', // Utiliser Client Passager si pas de nom
        clientPhone: clientPhone,
        items: [...cart],
        subtotal: invoiceTotal,
        total: invoiceTotal,
        paymentMethod: paymentMethod,
        status: paymentMethod === 'credit' ? 'pending' : 'paid',
        paidAmount: paymentMethod === 'credit' ? 0 : invoiceTotal,
        profit: invoiceProfit
    };
    
    db.ventes.unshift(invoice);
    
    // If credit, add to credits
    if(paymentMethod === 'credit') {
        const credit = {
            id: 'CR' + Date.now(),
            invoiceId: invoiceId,
            invoiceNumber: currentInvoiceNumber,
            date: new Date().toISOString(),
            clientName: clientName,
            clientPhone: clientPhone,
            totalAmount: invoiceTotal,
            paidAmount: 0,
            balance: invoiceTotal,
            status: 'pending'
        };
        db.credits.unshift(credit);
        addLog(`Crédit créé: ${clientName} - ${formatMoney(invoiceTotal)}`, "warning");
    }
    
    // Increment invoice counter
    currentInvoiceNumber++;
    db.config.invoiceCounter = currentInvoiceNumber;
    
    addLog(`Facture ${invoiceId}: ${clientName} - ${formatMoney(invoiceTotal)} (${paymentMethod})`, "success");
    saveDB();
    
    // Show invoice preview
    showInvoice(invoice);
    
    // Reset form
    resetSaleForm();
    showToast("Vente enregistrée avec succès", "success");
    updateUI();
}

function showInvoice(invoice) {
    const company = db.config.company;
    const invoiceContent = document.getElementById('invoice-content');
    
    // Find credit information if this is a credit invoice
    const creditInfo = invoice.paymentMethod === 'credit' ? db.credits.find(c => c.invoiceId === invoice.id) : null;
    const paidAmount = creditInfo ? creditInfo.paidAmount : 0;
    const remainingBalance = creditInfo ? creditInfo.balance : invoice.total;
    
    // Use escapeHtml to sanitize all user-provided values before injecting
    invoiceContent.innerHTML = `
        <div class="mb-6 md:mb-8">
            <!-- Company Header with Logo -->
            <div class="flex justify-between items-start mb-6 md:mb-8">
                <!-- Logo and Company Info -->
                <div class="flex items-start gap-4 md:gap-6 flex-1">
                    ${company.logo ? `
                        <div class="flex-shrink-0">
                            <img src="${company.logo}" alt="Logo" class="h-16 md:h-20 w-auto object-contain max-w-[120px] md:max-w-[150px] rounded-lg shadow-sm">
                        </div>
                    ` : ''}
                    <div class="flex-1 min-w-0">
                        <h1 class="text-2xl md:text-3xl font-bold text-slate-800 mb-3">${escapeHtml(company.name)}</h1>
                        <div class="space-y-1">
                            ${company.address ? `<div class="text-slate-600 text-sm md:text-base">${escapeHtml(company.address)}</div>` : ''}
                            <div class="flex flex-wrap gap-3 md:gap-4 text-sm md:text-base text-slate-600">
                                ${company.phone ? `<div class="flex items-center gap-1">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
                                    </svg>
                                    ${escapeHtml(company.phone)}
                                </div>` : ''}
                                ${company.email ? `<div class="flex items-center gap-1">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                                    </svg>
                                    ${escapeHtml(company.email)}
                                </div>` : ''}
                                ${company.nif ? `<div class="flex items-center gap-1">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                    </svg>
                                    NIF/STAT: ${escapeHtml(company.nif)}
                                </div>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
                <!-- Invoice Info -->
                <div class="text-right ml-4 md:ml-6">
                    <div class="inline-block bg-slate-100 px-4 py-2 rounded-lg mb-3">
                        <h2 class="text-xl md:text-2xl font-bold text-slate-800">FACTURE</h2>
                    </div>
                    <div class="space-y-1 text-sm md:text-base">
                        <div class="font-semibold text-slate-700">${escapeHtml(invoice.id)}</div>
                        <div class="text-slate-600">Date: ${escapeHtml(new Date(invoice.date).toLocaleDateString('fr-FR'))}</div>
                        <div class="text-slate-600">Heure: ${escapeHtml(new Date(invoice.date).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'}))}</div>
                    </div>
                </div>
            </div>
            
            <!-- Client Info -->
            <div class="mb-4 md:mb-8 p-3 md:p-4 bg-slate-50 rounded-lg">
                <h3 class="font-bold text-slate-700 mb-2 text-sm md:text-base">Client</h3>
                <div class="text-slate-600 text-sm md:text-base">${escapeHtml(invoice.client || 'Client Passager')}</div>
                ${invoice.clientPhone ? `<div class="text-slate-600 text-sm md:text-base">${escapeHtml(invoice.clientPhone)}</div>` : ''}
            </div>
            
            <!-- Items Table -->
            <table class="w-full mb-4 md:mb-8">
                <thead>
                    <tr class="border-b">
                        <th class="text-left py-2 md:py-3 text-slate-600 font-medium text-sm md:text-base">Produit</th>
                        <th class="text-right py-2 md:py-3 text-slate-600 font-medium text-sm md:text-base">Qté</th>
                        <th class="text-right py-2 md:py-3 text-slate-600 font-medium text-sm md:text-base">Prix</th>
                        <th class="text-right py-2 md:py-3 text-slate-600 font-medium text-sm md:text-base">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoice.items.map(item => `
                        <tr class="border-b">
                            <td class="py-2 md:py-3 text-sm md:text-base">${escapeHtml(item.productName)}</td>
                            <td class="text-right py-2 md:py-3 text-sm md:text-base">${escapeHtml(item.quantity)}</td>
                            <td class="text-right py-2 md:py-3 text-sm md:text-base">${formatMoney(item.price)}</td>
                            <td class="text-right py-2 md:py-3 text-sm md:text-base">${formatMoney(item.total)}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr class="border-t">
                        <td colspan="3" class="text-right py-2 md:py-3 font-bold text-sm md:text-base">Total</td>
                        <td class="text-right py-2 md:py-3 font-bold text-lg md:text-xl text-blue-600">${formatMoney(invoice.total)}</td>
                    </tr>
                </tfoot>
            </table>
            
            <!-- Payment Info -->
            <div class="mb-4 md:mb-8 p-3 md:p-4 bg-slate-50 rounded-lg">
                <h3 class="font-bold text-slate-700 mb-2 text-sm md:text-base">Paiement</h3>
                <div class="text-slate-600 text-sm md:text-base">
                    Mode: <span class="font-bold">${escapeHtml(getPaymentMethodText(invoice.paymentMethod))}</span>
                </div>
                ${invoice.status === 'pending' ? `
                    <div class="mt-2 text-amber-600 text-xs md:text-sm">
                        <i data-lucide="alert-circle" class="w-3 h-3 md:w-4 md:h-4 inline mr-1"></i>
                        Facture en crédit - Solde: ${formatMoney(remainingBalance)}
                    </div>
                ` : ''}
            </div>
            
            ${invoice.status === 'pending' && invoice.paymentMethod === 'credit' ? `
            <!-- Credit Payment Summary -->
            <div class="mb-4 md:mb-8 p-3 md:p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                <h3 class="font-bold text-blue-700 mb-3 text-sm md:text-base">Récapitulatif du Paiement</h3>
                <div class="space-y-2 text-sm md:text-base">
                    <div class="flex justify-between">
                        <span class="text-slate-600">Montant Total du Crédit:</span>
                        <span class="font-medium">${formatMoney(invoice.total)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-slate-600">Montant Total Payé:</span>
                        <span class="font-medium text-green-600">${formatMoney(paidAmount)}</span>
                    </div>
                    <div class="flex justify-between font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded">
                        <span>Reste Ã  Payer:</span>
                        <span>${formatMoney(remainingBalance)}</span>
                    </div>
                </div>
                <div class="mt-3">
                    <span class="inline-block px-3 py-1 ${remainingBalance === 0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'} rounded-full text-xs font-medium">
                        ${remainingBalance === 0 ? 'âœ“ Payé Complètement' : 'â³ En attente de paiement'}
                    </span>
                </div>
            </div>
            
            <!-- Client Signature Section -->
            <div class="mb-4 md:mb-8 p-4 md:p-6 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50">
                <h3 class="font-bold text-slate-700 mb-3 text-center text-sm md:text-base">Signature du Client</h3>
                <div class="text-center">
                    <div class="border-t-2 border-slate-400 w-72 h-16 mx-auto mb-2"></div>
                    <p class="text-xs md:text-sm text-slate-500">Signature obligatoire pour valider le crédit</p>
                </div>
            </div>
            ` : ''}
            
            <!-- Footer -->
            <div class="border-t pt-3 text-center">
                <div class="mb-3">
                    <div class="text-slate-600 text-sm md:text-base">Merci pour votre confiance !</div>
                    <div class="text-xs md:text-sm text-slate-500 mt-1">Pour toute réclamation, contacter le service client.</div>
                </div>
                <div class="flex justify-between items-center">
                    <div class="text-left">
                        <div class="border-t border-slate-800 w-32 mb-1"></div>
                        <div class="text-xs md:text-sm text-slate-600">${escapeHtml(company.signature)}</div>
                    </div>
                    <div class="text-xs md:text-sm text-slate-500">
                        Généré le ${new Date().toLocaleDateString('fr-FR')} Ã  ${new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Reinitialize lucide icons in the modal
    setTimeout(() => {
        const icons = invoiceContent.querySelectorAll('[data-lucide]');
        icons.forEach(icon => {
            const iconName = icon.getAttribute('data-lucide');
            icon.innerHTML = '';
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '16');
            svg.setAttribute('height', '16');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', 'currentColor');
            svg.setAttribute('stroke-width', '2');
            svg.setAttribute('stroke-linecap', 'round');
            svg.setAttribute('stroke-linejoin', 'round');
            
            // Simple icon representation
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z');
            svg.appendChild(path);
            icon.appendChild(svg);
        });
    }, 100);
    
    openModal('modal-invoice');
}

function getPaymentMethodText(method) {
    switch(method) {
        case 'cash': return 'Espèces';
        case 'credit': return 'Crédit';
        case 'mobile': return 'Mobile Money';
        default: return method;
    }
}

function printInvoice() {
    const printWindow = window.open('', '_blank');
    const company = db.config.company;
    const invoiceId = document.querySelector('#invoice-content .text-right .text-slate-600')?.textContent || '';
    const invoiceDate = document.querySelectorAll('#invoice-content .text-right .text-slate-600')[1]?.textContent || '';
    const invoiceTime = document.querySelectorAll('#invoice-content .text-right .text-slate-600')[2]?.textContent || '';
    
    // Get invoice data to check if it's a credit invoice and get credit info
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = document.getElementById('invoice-content').innerHTML;
    const clientInfo = tempDiv.querySelector('.bg-slate-50');
    const table = tempDiv.querySelector('table');
    const paymentInfo = tempDiv.querySelectorAll('.bg-slate-50')[1];
    const footer = tempDiv.querySelector('.border-t');
    
    // Check if this is a credit invoice by looking for credit indicators
    const isCreditInvoice = paymentInfo && paymentInfo.textContent.includes('crédit');
    
    // Get credit information for accurate payment details
    let creditInfo = null;
    let paidAmount = 0;
    let remainingBalance = 0;
    let totalAmount = 0;
    
    if (isCreditInvoice && table) {
        totalAmount = parseFloat(table.querySelector('tfoot td:last-child').textContent.replace(/[^0-9.-]/g, ''));
        
        // Try to find credit by matching amount and extracting date from invoice
        const invoiceDateStr = invoiceDate.replace(/Date:\s*/i, '').trim();
        const invoiceTimeStr = invoiceTime.replace(/Heure:\s*/i, '').trim();
        
        // Create a Date object from the invoice date/time
        let invoiceDateTime = null;
        try {
            const dateParts = invoiceDateStr.split('/');
            if (dateParts.length === 3) {
                const [day, month, year] = dateParts;
                const timeParts = invoiceTimeStr.split(':');
                if (timeParts.length === 2) {
                    const [hours, minutes] = timeParts;
                    invoiceDateTime = new Date(`${year}-${month}-${day}T${hours}:${minutes}:00`);
                }
            }
        } catch(e) {
            console.error('Error parsing invoice date:', e);
        }
        
        // Find credit by matching amount and date (within reasonable range)
        creditInfo = null;
        if (invoiceDateTime) {
            creditInfo = db.credits.find(c => {
                const creditDate = new Date(c.date);
                const timeDiff = Math.abs(creditDate.getTime() - invoiceDateTime.getTime());
                const minutesDiff = timeDiff / (1000 * 60);
                return Math.abs(c.totalAmount - totalAmount) < 0.01 && minutesDiff < 5; // Within 5 minutes and same amount
            });
        }
        
        // Fallback: find by amount only if multiple matches, pick the most recent
        if (!creditInfo) {
            const creditsByAmount = db.credits.filter(c => Math.abs(c.totalAmount - totalAmount) < 0.01);
            if (creditsByAmount.length > 0) {
                creditInfo = creditsByAmount.reduce((mostRecent, credit) => {
                    return new Date(credit.date) > new Date(mostRecent.date) ? credit : mostRecent;
                });
            }
        }
        
        if (creditInfo) {
            paidAmount = creditInfo.paidAmount;
            remainingBalance = creditInfo.balance;
        } else {
            remainingBalance = totalAmount;
        }
    }
    
    // Build invoice content manually for print with proper styling
    let invoiceContent = `
        <div class="header">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;">
                <div style="flex: 1;">
                    ${company.logo ? `
                        <div style="margin-bottom: 15px;">
                            <img src="${company.logo}" alt="Logo" style="height: 150px; max-width: 150px; object-fit: contain;">
                        </div>
                    ` : ''}
                    <div class="company-name">${company.name}</div>
                    ${company.address ? `<div>${company.address}</div>` : ''}
                    ${company.phone ? `<div>Tél: ${company.phone}</div>` : ''}
                    ${company.email ? `<div>Email: ${company.email}</div>` : ''}
                    ${company.nif ? `<div>NIF/STAT: ${company.nif}</div>` : ''}
                </div>
                <div style="text-align: right;">
                    <div class="invoice-title">FACTURE</div>
                    <div>${invoiceId}</div>
                    <div>${invoiceDate}</div>
                    <div>${invoiceTime}</div>
                </div>
            </div>
        </div>
    `;
    
    // Add the rest of the invoice content
    if (clientInfo) invoiceContent += clientInfo.outerHTML;
    if (table) invoiceContent += table.outerHTML;
    if (paymentInfo) invoiceContent += paymentInfo.outerHTML;
    
    // Add credit payment summary and signature if it's a credit invoice
    if (isCreditInvoice) {
        invoiceContent += `
            <div style="margin: 10px 0; padding: 5px; background: #dbeafe; border-radius: 8px; border-left: 4px solid #3b82f6;">
                <h3 style="font-weight: bold; color: #1d4ed8; margin-bottom: 10px;">Récapitulatif du Paiement</h3>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px;">
                    <div>Montant Total du Crédit:</div>
                    <div style="text-align: right; font-weight: bold;">${formatMoney(totalAmount)}</div>
                    <div>Montant Total Payé:</div>
                    <div style="text-align: right; font-weight: bold; color: #059669;">${formatMoney(paidAmount)}</div>
                    <div style="font-weight: bold; color: #1d4ed8; background: #bfdbfe; padding: 5px; border-radius: 4px;">Reste Ã  Payer:</div>
                    <div style="text-align: right; font-weight: bold; color: #1d4ed8; background: #bfdbfe; padding: 5px; border-radius: 4px;">${formatMoney(remainingBalance)}</div>
                </div>
                <div style="text-align: center; margin-top: 5px;">
                    <span style="display: inline-block; padding: 4px 12px; background: ${remainingBalance === 0 ? '#dcfce7; color: #166534' : '#fef3c7; color: #92400e'}; border-radius: 20px; font-size: 12px; font-weight: 600;">
                        ${remainingBalance === 0 ? 'âœ“ Payé Complètement' : 'â³ En attente de paiement'}
                    </span>
                </div>
            </div>
            
            <div style="margin: 5px 0; padding: 5px; border: 2px dashed #cbd5e1; border-radius: 8px; background: #f8fafc; text-align: center;">
                <h3 style="font-weight: bold; color: #374151; margin-bottom: 3px;">Signature du Client</h3>
                <div style="border-top: 2px solid #334155; width: 300px; height: 60px; margin: 0 auto 10px;"></div>
                <div style="font-size: 12px; color: #64748b;">Signature obligatoire pour valider le crédit</div>
            </div>
        `;
    }
    
    if (footer) invoiceContent += `<div class="footer">${footer.innerHTML}</div>`;
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Facture ${company.name}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; font-size: 14px; }
                .header { margin-bottom: 3px; }
                .company-name { font-size: 20px; font-weight: bold; margin-bottom: 5px; }
                .invoice-title { font-size: 18px; font-weight: bold; margin: 20px 0; }
                .client-info { margin-bottom: 20px; padding: 10px; background: #f8fafc; border-radius: 8px; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
                th, td { padding: 6px; text-align: left; border-bottom: 1px solid #ddd; }
                th { background-color: #f8fafc; font-weight: bold; }
                .total { font-size: 16px; font-weight: bold; text-align: right; color: #2563eb; }
                .footer { margin-top: 5px; padding-top: 5px; border-top: 1px solid #ddd; }
                .signature-line { border-top: 1px solid #000; width: 200px; margin-top: 40px; }
                @media print { 
                    button { display: none; } 
                    body { margin: 0; padding: 20px; }
                    @page { size: auto; margin: 0mm; }
                }
            </style>
        </head>
        <body>
            ${invoiceContent}
            <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
                <div style="text-align: center;">
                    <div style="margin-bottom: 10px; font-weight: bold;">Signature et cachet</div>
                    <div class="signature-line"></div>
                </div>
            </div>
            <div class="footer">
                <button onclick="window.print()" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Imprimer
                </button>
                <button onclick="window.close()" style="padding: 10px 20px; background: #64748b; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">
                    Fermer
                </button>
            </div>
        </body>
        </html>
    `);
    
    printWindow.document.close();
}

function resetSaleForm() {
    cart = [];
    document.getElementById('client-name').value = '';
    document.getElementById('client-phone').value = '';
    document.querySelector('input[name="payment-method"][value="cash"]').checked = true;
    document.getElementById('credit-info').classList.add('hidden');
    document.getElementById('sale-product').selectedIndex = 0;
    document.getElementById('sale-price').value = '';
    document.getElementById('sale-qty').value = 1;
    updateSalePrice(); // Réinitialiser l'affichage du prix
    updateCartDisplay();
    document.getElementById('invoice-number').innerText = `Facture #${String(currentInvoiceNumber).padStart(3, '0')}`;
}

        // === CREDIT MANAGEMENT ===
        document.getElementById('form-credit-payment').onsubmit = function(e) {
            e.preventDefault();
            if(!canAccess('creditsPay')) { showToast("Action non autorisée", "error"); return; }
    
    const creditId = document.getElementById('credit-select').value;
    const amount = parseFloat(document.getElementById('credit-payment-amount').value);
    
    const credit = db.credits.find(c => c.id === creditId);
    if(!credit) {
        showToast("Veuillez sélectionner un crédit", "error");
        return;
    }
    
    if(isNaN(amount) || amount <= 0) {
        showToast("Montant invalide", "error");
        return;
    }
    
    if(amount > credit.balance) {
        showToast(`Le montant ne peut pas dépasser ${formatMoney(credit.balance)}`, "error");
        return;
    }
    
    credit.paidAmount += amount;
    credit.balance -= amount;
    
    if(credit.balance === 0) {
        credit.status = 'paid';
        // Update corresponding invoice
        const invoice = db.ventes.find(v => v.id === credit.invoiceId);
        if(invoice) {
            invoice.status = 'paid';
            invoice.paidAmount = invoice.total;
        }
        addLog(`Crédit soldé: ${credit.clientName}`, "success");
    } else {
        addLog(`Paiement crédit: ${credit.clientName} - ${formatMoney(amount)}`, "info");
    }
    
    saveDB();
    this.reset();
    document.getElementById('credit-details').classList.add('hidden');
    showToast("Paiement enregistré avec succès", "success");
    updateUI();
};

// Prefill the credit payment form for a given credit and focus the amount input
function openCreditPayment(creditId) {
    const credit = db.credits.find(c => c.id === creditId);
    if(!credit) {
        try { showToast('Crédit introuvable', 'error'); } catch(e){}
        return;
    }

    // Switch to credits tab so the payment form is visible
    try { switchTab('credits'); } catch(e){}

    // Small timeout to ensure DOM updated after tab switch
    setTimeout(() => {
        const select = document.getElementById('credit-select');
        if(select) {
            select.value = creditId;
            select.dispatchEvent(new Event('change'));
        }

        const amt = document.getElementById('credit-payment-amount');
        if(amt) {
            amt.value = credit.balance || 0;
            amt.focus();
        }
    }, 50);
}

        function deleteCredit(creditId) {
            if(!canAccess('creditsDelete')) { showToast("Action non autorisée", "error"); return; }
            const credit = db.credits.find(c => c.id === creditId);
    if(!credit) return;
    
    requireAuth(() => {
        showConfirm(
            "Supprimer le crédit",
            `Supprimer le crédit de ${credit.clientName} (${formatMoney(credit.balance)} restant) ?`,
            "Supprimer",
            "error",
            () => {
                // Restore stock if invoice exists
                const invoice = db.ventes.find(v => v.id === credit.invoiceId);
                if(invoice) {
                    invoice.items.forEach(item => {
                        const product = db.produits.find(p => p.id === item.productId);
                        if(product) {
                            product.stock += item.quantity;
                        }
                    });
                    db.ventes = db.ventes.filter(v => v.id !== credit.invoiceId);
                }
                
                db.credits = db.credits.filter(c => c.id !== creditId);
                addLog(`Crédit supprimé: ${credit.clientName}`, "warning");
                saveDB();
                updateUI();
                showToast("Crédit supprimé", "success");
            }
        );
    }, "Supprimer un crédit nécessite une authentification.");
}

        // === EXPENSES MANAGEMENT ===
        document.getElementById('form-expense').onsubmit = function(e) {
            e.preventDefault();
            if(!canAccess('expensesAdd')) { showToast("Action non autorisée", "error"); return; }
    const category = document.getElementById('expense-category').value;
    const motif = document.getElementById('expense-motif').value.trim();
    const amount = parseFloat(document.getElementById('expense-amount').value);
    const date = document.getElementById('expense-date').value;

    if(!category) return showToast("Veuillez sélectionner une catégorie", "error");
    if(!motif) return showToast("Veuillez saisir un motif", "error");
    if(isNaN(amount) || amount <= 0) return showToast("Montant invalide", "error");

    db.depenses.unshift({
        id: 'E' + Date.now() + Math.floor(Math.random() * 1000),
        date: date,
        category: category,
        motif: motif,
        amount: amount
    });

    addLog(`Sortie Caisse: ${motif} (-${formatMoney(amount)})`, "warning");
    saveDB();
    this.reset();
    // Réinitialiser la date par défaut
    document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
    showToast("Dépense enregistrée", "success");
    updateUI();
};

        // Expense modal form
        document.getElementById('form-expense-modal').onsubmit = function(e) {
            e.preventDefault();
            if(!canAccess('expensesAdd') && !this.dataset.editId) { showToast("Action non autorisée", "error"); return; }
            if(!canAccess('expensesEdit') && this.dataset.editId) { showToast("Action non autorisée", "error"); return; }
    const category = document.getElementById('expense-modal-category').value;
    const motif = document.getElementById('expense-modal-motif').value.trim();
    const amount = parseFloat(document.getElementById('expense-modal-amount').value);
    const date = document.getElementById('expense-modal-date').value;
    const editId = this.dataset.editId;
    
    if(editId) {
        // Mode édition
        const expense = db.depenses.find(e => e.id === editId);
        if(expense) {
            expense.category = category;
            expense.motif = motif;
            expense.amount = amount;
            expense.date = date;
            
            addLog(`Dépense modifiée: ${motif} (-${formatMoney(amount)})`, "warning");
            showToast("Dépense modifiée", "success");
        }
        delete this.dataset.editId;
    } else {
        // Mode création
        const expense = {
            id: 'EXP' + Date.now(),
            category,
            motif,
            amount,
            date,
            time: new Date().toISOString()
        };
        
        db.depenses.push(expense);
        addLog(`Sortie Caisse: ${motif} (-${formatMoney(amount)})`, "warning");
        showToast("Dépense enregistrée", "success");
    }
    
    saveDB();
    closeModal('modal-expense');
    updateUI();
};

        function deleteExpense(id) {
            if(!canAccess('expensesDelete')) { showToast("Action non autorisée", "error"); return; }
            requireAuth(() => {
        const expense = db.depenses.find(x => x.id === id);
        if(!expense) return;
        
        showConfirm(
            "Supprimer la dépense",
            `Supprimer la dépense "${expense.motif}" de ${formatMoney(expense.amount)} ?`,
            "Supprimer",
            "error",
            () => {
                db.depenses = db.depenses.filter(x => x.id !== id);
                saveDB();
                updateUI();
                showToast("Dépense supprimée", "success");
            }
        );
    }, "Supprimer une dépense nécessite une authentification.");
}

        function editExpense(id) {
            if(!canAccess('expensesEdit')) { showToast("Action non autorisée", "error"); return; }
            const expense = db.depenses.find(e => e.id === id);
    if(!expense) return;
    
    // Pré-remplir le formulaire de dépense
    document.getElementById('expense-modal-category').value = expense.category;
    document.getElementById('expense-modal-motif').value = expense.motif;
    document.getElementById('expense-modal-amount').value = expense.amount;
    document.getElementById('expense-modal-date').value = expense.date || new Date().toISOString().split('T')[0];
    
    // Changer le titre
    document.getElementById('expense-modal-title').innerText = "Modifier Dépense";
    
    // Ouvrir le modal
    openModal('modal-expense');
    
    // Marquer comme en mode édition
    document.getElementById('form-expense-modal').dataset.editId = id;
}

        function cancelInvoice(invoiceId) {
            if(!canAccess('salesCancel')) { showToast("Action non autorisée", "error"); return; }
            const invoice = db.ventes.find(v => v.id === invoiceId);
    if(!invoice) return;
    
    showConfirm(
        "Annuler la facture",
        `Annuler la facture ${invoice.id} de ${formatMoney(invoice.total)} ?\n\nLe stock sera automatiquement restauré.`,
        "Annuler",
        "error",
        () => {
            // Restaurer le stock
            invoice.items.forEach(item => {
                const product = db.produits.find(p => p.id === item.productId);
                if(product) {
                    product.stock += item.quantity;
                }
            });
            
            // Supprimer le crédit associé s'il existe
            const credit = db.credits.find(c => c.invoiceId === invoiceId);
            if(credit) {
                db.credits = db.credits.filter(c => c.id !== credit.id);
            }
            
            // Supprimer la facture
            db.ventes = db.ventes.filter(v => v.id !== invoiceId);
            
            // Logger l'action
            addLog(`Facture annulée: ${invoice.id} (-${formatMoney(invoice.total)})`, "error");
            
            // Sauvegarder et mettre Ã  jour
            saveDB();
            updateUI();
            showToast("Facture annulée avec succès", "success");
        }
    );
}

function resetExpenseForm() {
    // Réinitialiser le formulaire
    document.getElementById('form-expense-modal').reset();
    document.getElementById('expense-modal-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('expense-modal-title').innerText = "Nouvelle Dépense";
    delete document.getElementById('form-expense-modal').dataset.editId;
}

// === UI UPDATERS ===
function updateUI() {
    updateDashboard();
    renderStock();
    renderSales();
    renderCredits();
    renderExpenses();
    renderLogs();
    updateReports();
    updateSelects();
    updateHeaderInfo();
    updateStorageSize();
    checkAlerts();
    initLucide();
    
    // Update mobile-specific displays
    if(document.getElementById('tab-stock')?.classList.contains('active')) {
        renderMobileStockList();
    }
    if(document.getElementById('tab-credits')?.classList.contains('active')) {
        renderMobileCreditsList();
    }
    if(document.getElementById('tab-expenses')?.classList.contains('active')) {
        renderMobileExpensesList();
    }
}

function updateHeaderInfo() {
    const caisse = calculateCaisse();
    document.getElementById('header-caisse').innerText = formatMoney(caisse);
    document.getElementById('header-caisse-mobile').innerText = formatMoney(caisse);
    
    // Check caisse alert
    if(db.config.caisseMin > 0 && caisse < db.config.caisseMin) {
        document.getElementById('header-alert').classList.remove('hidden');
        document.getElementById('header-alert').innerText = `Caisse faible !`;
    } else {
        document.getElementById('header-alert').classList.add('hidden');
    }
}

function calculateCaisse() {
    const totalVentes = db.ventes.filter(v => v.status === 'paid').reduce((sum, s) => sum + s.total, 0);
    const totalDepenses = db.depenses.reduce((sum, e) => sum + e.amount, 0);
    return totalVentes - totalDepenses;
}

function updateDashboard() {
    // Read dashboard filter
    const period = (document.getElementById('dashboard-period') && document.getElementById('dashboard-period').value) || 'all';
    const customDate = document.getElementById('dashboard-date') ? document.getElementById('dashboard-date').value : null;
    const range = getRangeForPeriod(period, customDate);

    const ventesFiltered = db.ventes.filter(v => dateInRange(v.date, range.start, range.end));
    const depensesFiltered = db.depenses.filter(e => dateInRange(e.date, range.start, range.end));
    const creditsFiltered = db.credits.filter(c => dateInRange(c.date, range.start, range.end));

    const totalVentes = ventesFiltered.filter(v => v.status === 'paid').reduce((sum, s) => sum + (s.total||0), 0);
    const totalDepenses = depensesFiltered.reduce((sum, e) => sum + (e.amount||0), 0);
    const totalProfit = ventesFiltered.filter(v => v.status === 'paid').reduce((sum, s) => sum + (s.profit||0), 0) - totalDepenses;
    const totalCredits = creditsFiltered.reduce((sum, c) => sum + (c.balance||0), 0);

    const caisse = totalVentes - totalDepenses;

    const ventesCash = ventesFiltered.filter(v => v.status === 'paid' && v.paymentMethod === 'cash').reduce((sum, s) => sum + (s.total||0), 0);
    const ventesMobile = ventesFiltered.filter(v => v.status === 'paid' && v.paymentMethod === 'mobile').reduce((sum, s) => sum + (s.total||0), 0);

    document.getElementById('stat-caisse').innerText = formatMoney(caisse);
    document.getElementById('stat-ca').innerText = formatMoney(totalVentes);
    document.getElementById('stat-depenses').innerText = formatMoney(totalDepenses);
    document.getElementById('stat-ventes-cash').innerText = formatMoney(ventesCash);
    document.getElementById('stat-ventes-mobile').innerText = formatMoney(ventesMobile);
    document.getElementById('stat-total-ventes').innerText = formatMoney(totalVentes);
    document.getElementById('stat-credits').innerText = formatMoney(totalCredits);

    // Stock Alerts
    const alertsDiv = document.getElementById('stock-alerts');
    const critical = db.produits.filter(p => p.stock <= p.min);
    const zeroStock = db.produits.filter(p => p.stock === 0);
    
    const totalAlerts = critical.length + zeroStock.length;
    document.getElementById('alert-count').innerText = totalAlerts;
    
    if(totalAlerts === 0) {
        alertsDiv.innerHTML = `<div class="p-6 md:p-8 text-center text-slate-400 text-sm">
            <i data-lucide="check-circle-2" class="w-8 h-8 mx-auto mb-2 opacity-20"></i>
            Tout est en ordre
        </div>`;
    } else {
        let alertsHTML = '';
        
        // Stock zero alerts
        if(zeroStock.length > 0) {
            alertsHTML += zeroStock.map(p => `
                <div class="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100 hover:bg-red-100 transition-colors cursor-pointer" onclick="openStockAdjust('${p.id}')">
                    <div class="flex items-center gap-3">
                        <div class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                        <div>
                            <span class="text-sm font-semibold">${p.nom}</span>
                            <div class="text-xs text-red-600">Stock épuisé</div>
                        </div>
                    </div>
                    <button onclick="document.getElementById('adjust-product').value = '${p.id}'; document.querySelector('input[name=\"adjust-type\"][value=\"add\"]').checked = true; document.getElementById('adjust-qty').value = '10'; openModal('modal-stock-adjust'); event.stopPropagation();" class="text-xs px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200">
                        Réapprovisionner
                    </button>
                </div>
            `).join('');
        }
        
        // Critical stock alerts
        if(critical.length > 0) {
            alertsHTML += critical.map(p => `
                <div class="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100 hover:bg-amber-100 transition-colors cursor-pointer" onclick="openStockAdjust('${p.id}')">
                    <div class="flex items-center gap-3">
                        <div class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                        <div>
                            <span class="text-sm font-semibold">${p.nom}</span>
                            <div class="text-xs text-amber-600">Stock critique: ${p.stock}</div>
                        </div>
                    </div>
                    <span class="text-xs font-bold text-amber-700">${p.stock} restant(s)</span>
                </div>
            `).join('');
        }
        
        alertsDiv.innerHTML = alertsHTML;
    }

    // Recent Logs (top 5)
    const recentLogsDiv = document.getElementById('recent-logs');
    recentLogsDiv.innerHTML = db.logs.slice(0, 5).map(log => `
        <div class="p-3 md:p-4 flex gap-3 md:gap-4 items-start hover:bg-slate-50 transition-colors">
            <div class="mt-1">${getLogIcon(log.type)}</div>
            <div class="flex-1">
                <div class="font-medium text-slate-700 text-sm">${log.text}</div>
                <div class="text-[10px] text-slate-400">${new Date(log.time).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })}</div>
            </div>
        </div>
    `).join('');

    updateMainChart();
}

function renderStock() {
    const tbody = document.getElementById('stock-table-body');
    const search = document.getElementById('search-stock').value.toLowerCase();
    const categoryFilter = document.getElementById('filter-category').value;
    const statusFilter = document.getElementById('filter-stock-status').value;
    
    // Update category filter options
    const categorySelect = document.getElementById('filter-category');
    const categories = [...new Set(db.produits.map(p => p.category).filter(c => c))];
    const currentValue = categorySelect.value;
    
    categorySelect.innerHTML = '<option value="">Toutes catégories</option>' +
        categories.map(cat => `<option value="${cat}" ${cat === currentValue ? 'selected' : ''}>${cat}</option>`).join('');
    
    // Update stock adjust select
    const adjustSelect = document.getElementById('adjust-product');
    adjustSelect.innerHTML = '<option value="">-- Sélectionner un produit --</option>' +
        db.produits.map(p => `<option value="${p.id}">${p.nom} (Stock: ${p.stock})</option>`).join('');
    
    let filtered = db.produits.filter(p => {
        const searchLower = search.toLowerCase();
        const matchesSearch = p.nom.toLowerCase().includes(searchLower) || 
                             p.fournisseur.toLowerCase().includes(searchLower) ||
                             p.category.toLowerCase().includes(searchLower);
        const matchesCategory = !categoryFilter || p.category === categoryFilter;
        let matchesStatus = true;
        
        if(statusFilter === 'critique') {
            matchesStatus = p.stock <= p.min && p.stock > 0;
        } else if(statusFilter === 'zero') {
            matchesStatus = p.stock === 0;
        } else if(statusFilter === 'normal') {
            matchesStatus = p.stock > p.min;
        }
        
        return matchesSearch && matchesCategory && matchesStatus;
    });

    // Calculate total stock value
    const totalValue = filtered.reduce((sum, p) => sum + (p.stock * p.achat), 0);
    document.getElementById('total-stock-value').innerText = formatMoney(totalValue);

    tbody.innerHTML = filtered.map(p => {
        const stockValue = p.stock * p.achat;
        const margin = p.vente - p.achat;
        const marginPercent = ((margin / p.achat) * 100).toFixed(1);
        
        let stockClass = '';
        let stockText = '';
        if(p.stock === 0) {
            stockClass = 'bg-red-100 text-red-600 pulse';
            stockText = 'Épuisé';
        } else if(p.stock <= p.min) {
            stockClass = 'bg-amber-100 text-amber-600 pulse';
            stockText = 'Critique';
        } else {
            stockClass = 'bg-emerald-100 text-emerald-600';
            stockText = 'Normal';
        }
        
        return `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="px-6 py-4">
                <div class="font-bold text-slate-700">${p.nom}</div>
                <div class="text-xs text-slate-400">${p.category}</div>
            </td>
            <td class="px-6 py-4 text-slate-500">${p.category || "â€”"}</td>
            <td class="px-6 py-4 text-slate-500">${p.fournisseur}</td>
            <td class="px-6 py-4 text-right text-slate-400">${formatMoney(p.achat)}</td>
            <td class="px-6 py-4 text-right font-semibold text-slate-700">
                ${formatMoney(p.vente)}
                <div class="text-xs text-emerald-600">+${marginPercent}%</div>
            </td>
            <td class="px-6 py-4 text-center">
                <div class="flex flex-col items-center gap-1">
                    <span class="px-2 py-1 text-xs font-medium rounded-full ${stockClass}">${stockText}</span>
                    <span class="text-xs font-bold text-slate-600">${p.stock} unité(s)</span>
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="flex items-center justify-center gap-2">
                    <!-- Stock actions -->
                    <button onclick="openStockAdjust('${p.id}', 1, 'add')" class="p-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition-colors" title="Ajouter stock">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
                        </svg>
                    </button>
                    <button onclick="openStockAdjust('${p.id}', 1, 'remove')" class="p-2 bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors" title="Retirer stock">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path>
                        </svg>
                    </button>
                    <!-- Separator -->
                    <span class="w-px h-4 bg-slate-400 mx-2"></span>
                    <!-- Product actions -->
                    <button onclick="editProduct('${p.id}')" class="p-2 bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300 rounded-lg transition-colors" title="Modifier">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                    </button>
                    <button onclick="deleteProduct('${p.id}')" class="p-2 bg-red-100 text-red-700 hover:bg-red-200 border border-red-300 rounded-lg transition-colors" title="Supprimer">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
        `;
    }).join('') || `<tr><td colspan="7" class="px-6 py-12 text-center text-slate-400">Aucun produit trouvé</td></tr>`;
    
    // Force re-initialize Lucide icons for stock table
    setTimeout(() => {
        initLucide();
    }, 100);
    
    // Stock movements
    const movementsDiv = document.getElementById('stock-movements');
    const recentMovements = db.stockMovements.slice(0, 10);
    
    if(recentMovements.length === 0) {
        movementsDiv.innerHTML = `<div class="text-center py-4 text-slate-400 text-sm">Aucun mouvement récent</div>`;
    } else {
        movementsDiv.innerHTML = recentMovements.map(m => `
            <div class="flex items-center justify-between p-3 bg-white border rounded-lg">
                <div class="flex items-center gap-3">
                    <div class="${m.type === 'achat' ? 'text-amber-600 bg-amber-50' : 'text-slate-600 bg-slate-50'} p-2 rounded-lg">
                        <i data-lucide="${m.type === 'achat' ? 'package-plus' : 'package-minus'}" class="w-4 h-4"></i>
                    </div>
                    <div>
                        <div class="font-medium text-sm">${m.productName}</div>
                        <div class="text-xs text-slate-500">${m.reason}</div>
                    </div>
                </div>
                <div class="text-right">
                    <div class="font-bold ${m.type === 'achat' ? 'text-amber-600' : 'text-slate-600'}">
                        ${m.type === 'achat' ? '+' : '-'}${m.quantity}
                    </div>
                    <div class="text-xs text-slate-400">${new Date(m.date).toLocaleDateString('fr-FR')}</div>
                </div>
            </div>
        `).join('');
    }
    
    initLucide();
}

function renderSales() {
    const recentInvoices = document.getElementById('recent-invoices');
    const today = new Date().toDateString();
    
    // Récupérer les filtres de date
    const startDate = document.getElementById('invoice-filter-start').value;
    const endDate = document.getElementById('invoice-filter-end').value;
    
    // Filtrer les ventes selon les dates
    let filteredSales = [...db.ventes];
    
    if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filteredSales = filteredSales.filter(v => new Date(v.date) >= start);
    }
    
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filteredSales = filteredSales.filter(v => new Date(v.date) <= end);
    }
    
    // Trier par date décroissante
    filteredSales.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Calculer les ventes du jour
    const todaySales = db.ventes.filter(v => new Date(v.date).toDateString() === today).length;
    document.getElementById('sales-today-count').innerText = todaySales;
    
    if(filteredSales.length === 0) {
        recentInvoices.innerHTML = `
            <div class="text-center py-6 md:py-8 text-slate-400">
                <i data-lucide="file-text" class="w-8 h-8 md:w-12 md:h-12 mx-auto mb-2 opacity-30"></i>
                <p class="text-sm">Aucune facture trouvée pour cette période</p>
            </div>
        `;
    } else {
        recentInvoices.innerHTML = filteredSales.slice(0, 10).map(invoice => `
            <div class="p-3 border rounded-lg hover:bg-slate-50 transition-colors">
                <div class="flex justify-between items-start mb-2">
                    <div class="font-medium text-sm">${invoice.client || 'Client Passager'}</div>
                    <div class="text-xs px-2 py-1 rounded-full ${invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
                        ${invoice.status === 'paid' ? 'Payé' : 'Crédit'}
                    </div>
                </div>
                <div class="flex justify-between items-center">
                    <div class="text-xs text-slate-500">${new Date(invoice.date).toLocaleDateString('fr-FR')}</div>
                    <div class="font-bold text-blue-600 text-sm">${formatMoney(invoice.total)}</div>
                </div>
                <div class="mt-2 flex gap-1">
                    <button onclick="showInvoice(${JSON.stringify(invoice).replace(/"/g, '&quot;')})" class="flex-1 text-xs px-2 py-1 border border-slate-200 rounded hover:bg-slate-100">
                        Voir
                    </button>
                    <button onclick="requireAuth(() => {cancelInvoice('${invoice.id}')})" class="flex-1 text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100">
                        Annuler
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    initLucide();
}

// === FONCTIONS DE FILTRE DES FACTURES ===

function filterInvoices() {
    renderSales();
}

function setTodayFilter() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('invoice-filter-start').value = today;
    document.getElementById('invoice-filter-end').value = today;
    renderSales();
}

function setWeekFilter() {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    document.getElementById('invoice-filter-start').value = startOfWeek.toISOString().split('T')[0];
    document.getElementById('invoice-filter-end').value = endOfWeek.toISOString().split('T')[0];
    renderSales();
}

function setMonthFilter() {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    document.getElementById('invoice-filter-start').value = startOfMonth.toISOString().split('T')[0];
    document.getElementById('invoice-filter-end').value = endOfMonth.toISOString().split('T')[0];
    renderSales();
}

function clearInvoiceFilter() {
    document.getElementById('invoice-filter-start').value = '';
    document.getElementById('invoice-filter-end').value = '';
    renderSales();
}

function renderCredits() {
    const tbody = document.getElementById('credits-table-body');
    const totalCredits = db.credits.reduce((sum, c) => sum + c.balance, 0);
    const select = document.getElementById('credit-select');
    
    document.getElementById('total-credits').innerText = formatMoney(totalCredits);
    
    // Update credit select
    const pendingCredits = db.credits.filter(c => c.status === 'pending');
    select.innerHTML = '<option value="">-- Choisir un crédit --</option>' +
        pendingCredits.map(c => `<option value="${c.id}">${c.clientName || 'Client Passager'} - ${formatMoney(c.balance)} restant</option>`).join('');
    
    if(db.credits.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="px-6 py-8 text-center text-slate-400">Aucun crédit en cours</td></tr>`;
    } else {
        tbody.innerHTML = db.credits.map(c => {
            let statusClass = '';
            let statusText = '';
            
            if(c.status === 'paid') {
                statusClass = 'badge-success';
                statusText = 'Soldé';
            } else {
                const days = Math.floor((new Date() - new Date(c.date)) / (1000 * 60 * 60 * 24));
                if(days > 30) {
                    statusClass = 'badge-danger';
                    statusText = 'En retard';
                } else {
                    statusClass = 'badge-warning';
                    statusText = 'En attente';
                }
            }
            
            return `
            <tr class="hover:bg-slate-50">
                <td class="px-6 py-4 font-medium">${c.clientName || 'Client Passager'}</td>
                <td class="px-6 py-4 text-slate-500">#${String(c.invoiceNumber).padStart(3, '0')}</td>
                <td class="px-6 py-4 text-slate-400">${new Date(c.date).toLocaleDateString('fr-FR')}</td>
                <td class="px-6 py-4 text-right font-bold">${formatMoney(c.totalAmount)}</td>
                <td class="px-6 py-4 text-right text-emerald-600">${formatMoney(c.paidAmount)}</td>
                <td class="px-6 py-4 text-right font-bold text-rose-600">${formatMoney(c.balance)}</td>
                <td class="px-6 py-4 text-center">
                    <span class="px-2 py-1 text-xs rounded-full ${statusClass}">${statusText}</span>
                </td>
                <td class="px-6 py-4 text-right">
                    ${c.status === 'pending' ? `
                        <button onclick="openCreditPayment('${c.id}')" class="text-emerald-500 hover:text-emerald-700 mr-2 flex items-center gap-1 text-sm" title="Régler">
                            <i data-lucide="credit-card" class="w-4 h-4"></i>
                            <span>Régler</span>
                        </button>
                        <button onclick="requireAuth(() => {deleteCredit('${c.id}')})" class="text-red-400 hover:text-red-600" title="Supprimer">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    ` : ''}
                </td>
            </tr>
            `;
        }).join('');
    }
    
    initLucide();
}

// === EXPENSE CATEGORIES MANAGEMENT ===
function addExpenseCategory() {
    const input = document.getElementById('category-name-input') || document.getElementById('new-category-input');
    const categoryName = input.value.trim();
    
    if (!categoryName) {
        showToast("Veuillez entrer un nom de catégorie", "error");
        return;
    }
    
    // Initialize expenseCategories if it doesn't exist
    if (!db.config.expenseCategories) {
        db.config.expenseCategories = [];
    }
    
    // Check if category already exists
    if (db.config.expenseCategories.includes(categoryName)) {
        showToast("Cette catégorie existe déjà", "error");
        return;
    }
    
    // Add category
    db.config.expenseCategories.push(categoryName);
    saveDB();
    
    // Clear input
    input.value = '';
    
    // Refresh displays
    updateExpenseCategoriesSelect();
    renderCategoriesList();
    
    showToast("Catégorie ajoutée avec succès", "success");
    addLog('info', `Nouvelle catégorie de dépense ajoutée: ${categoryName}`);
}

function removeExpenseCategory(categoryName) {
    if (!confirm(`Voulez-vous vraiment supprimer la catégorie "${categoryName}" ?`)) {
        return;
    }
    
    // Check if category is used in expenses
    const expensesWithCategory = db.depenses.filter(e => e.category === categoryName);
    if (expensesWithCategory.length > 0) {
        showToast(`Impossible de supprimer: ${expensesWithCategory.length} dépense(s) utilisent cette catégorie`, "error");
        return;
    }
    
    // Remove category
    db.config.expenseCategories = db.config.expenseCategories.filter(cat => cat !== categoryName);
    saveDB();
    
    // Refresh displays
    updateExpenseCategoriesSelect();
    renderCategoriesList();
    
    showToast("Catégorie supprimée avec succès", "success");
    addLog('info', `Catégorie de dépense supprimée: ${categoryName}`);
}

function updateExpenseCategoriesSelect() {
    const selects = ['expense-category', 'expense-filter-category'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        const currentValue = select.value;
        const isFilter = selectId === 'expense-filter-category';
        
        // Initialize expenseCategories if it doesn't exist
        if (!db.config.expenseCategories) {
            db.config.expenseCategories = [];
        }
        
        let optionsHTML = isFilter ? 
            '<option value="">Toutes catégories</option>' : 
            '<option value="">Sélectionner</option>';
        
        // Add custom categories
        db.config.expenseCategories.forEach(category => {
            optionsHTML += `<option value="${category}" ${category === currentValue ? 'selected' : ''}>${category}</option>`;
        });
        
        // Add existing categories from expenses (for compatibility)
        const expenseCategories = [...new Set(db.depenses.map(e => e.category).filter(c => c))];
        expenseCategories.forEach(category => {
            if (!db.config.expenseCategories.includes(category)) {
                optionsHTML += `<option value="${category}" ${category === currentValue ? 'selected' : ''}>${category}</option>`;
            }
        });
        
        select.innerHTML = optionsHTML;
    });
}

function renderCategoriesList() {
    const container = document.getElementById('categories-list');
    if (!container) return;
    
    // Initialize expenseCategories if it doesn't exist
    if (!db.config.expenseCategories) {
        db.config.expenseCategories = [];
    }
    
    if (db.config.expenseCategories.length === 0) {
        container.innerHTML = '<div class="col-span-full text-center text-slate-500 text-sm py-4">Aucune catégorie personnalisée. Ajoutez vos premières catégories ci-dessus.</div>';
        return;
    }
    
    // Use scrollable container for many categories
    if (db.config.expenseCategories.length > 12) {
        container.innerHTML = `
            <div class="col-span-full max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2">
                <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                    ${db.config.expenseCategories.map(category => `
                        <div class="flex items-center justify-between p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors group">
                            <span class="text-sm font-medium text-slate-700 truncate flex-1">${category}</span>
                            <button onclick="removeExpenseCategory('${category}')" class="ml-2 p-1 text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all">
                                <i data-lucide="trash-2" class="w-3 h-3"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } else {
        // Normal grid layout for fewer categories
        container.innerHTML = db.config.expenseCategories.map(category => `
            <div class="flex items-center justify-between p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors group">
                <span class="text-sm font-medium text-slate-700 truncate flex-1">${category}</span>
                <button onclick="removeExpenseCategory('${category}')" class="ml-2 p-1 text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
            </div>
        `).join('');
    }
    
    // Re-initialize lucide icons
    initLucide();
}

function renderExpenses() {
    const tbody = document.getElementById('expenses-table-body');
    const categoryFilter = document.getElementById('expense-filter-category').value;
    const monthFilter = document.getElementById('expense-filter-month').value;
    
    // Update category filter using our new function
    updateExpenseCategoriesSelect();
    
    let filteredExpenses = db.depenses;
    
    if(categoryFilter) {
        filteredExpenses = filteredExpenses.filter(e => e.category === categoryFilter);
    }
    
    if(monthFilter) {
        const [year, month] = monthFilter.split('-');
        filteredExpenses = filteredExpenses.filter(e => {
            const expenseDate = new Date(e.date);
            return expenseDate.getFullYear() == year && 
                   (expenseDate.getMonth() + 1) == month;
        });
    }
    
    // Calculate total
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    document.getElementById('total-expenses').innerText = formatMoney(totalExpenses);
    
    tbody.innerHTML = filteredExpenses.map(e => `
        <tr class="hover:bg-slate-50">
            <td class="px-6 py-4 text-slate-400">
                ${new Date(e.date).toLocaleDateString('fr-FR', { 
                    day: '2-digit', 
                    month: '2-digit'
                })}
            </td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 text-xs rounded-full ${e.category === 'achat_stock' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}">${e.category}</span>
            </td>
            <td class="px-6 py-4 font-medium">${e.motif}</td>
            <td class="px-6 py-4 text-right font-bold text-amber-600">-${formatMoney(e.amount)}</td>
            <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                    <button onclick="editExpense('${e.id}')" class="p-2 bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300 rounded-lg transition-colors" title="Modifier">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                    </button>
                    <button onclick="deleteExpense('${e.id}')" class="p-2 bg-red-100 text-red-700 hover:bg-red-200 border border-red-300 rounded-lg transition-colors" title="Supprimer">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('') || `<tr><td colspan="5" class="px-6 py-8 text-center text-slate-400">Aucune dépense enregistrée</td></tr>`;
    
    initLucide();
}

function renderLogs() {
    const list = document.getElementById('full-logs-list');
    const typeFilter = document.getElementById('log-filter-type').value;
    
    let filteredLogs = db.logs;
    if(typeFilter) {
        filteredLogs = db.logs.filter(log => log.type === typeFilter);
    }
    
    list.innerHTML = filteredLogs.map(log => `
        <div class="p-3 md:p-4 flex gap-3 md:gap-4 items-center bg-white hover:bg-slate-50 transition-colors">
            <div class="flex-shrink-0">${getLogIcon(log.type)}</div>
            <div class="flex-1">
                <div class="text-sm font-medium text-slate-800">${log.text}</div>
                <div class="text-[10px] text-slate-400 uppercase tracking-tighter font-bold">
                    ${new Date(log.time).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                    })}
                </div>
            </div>
        </div>
    `).join('') || `<div class="p-8 text-center text-slate-400">Aucun log disponible</div>`;
    
    initLucide();
}

// Helpers for dashboard/chart filtering
function getRangeForPeriod(period, customDateString) {
    const now = new Date();
    let start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let end = new Date(start.getTime() + 24*60*60*1000 - 1);

    if(period === 'today') {
        // start/end already set
    } else if(period === 'week') {
        start.setDate(start.getDate() - 6); // last 7 days
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23,59,59,999);
    } else if(period === 'month') {
        start.setDate(start.getDate() - 29); // last 30 days
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23,59,59,999);
    } else if(period === 'year') {
        start.setFullYear(start.getFullYear() - 1);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23,59,59,999);
    } else if(period === 'all') {
        // Toutes les données : commencer par une date très ancienne
        start = new Date(2000, 0, 1); // 1er janvier 2000
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23,59,59,999);
    } else if(period === 'custom' && customDateString) {
        console.log('Date personnalisée reçue:', customDateString);
        const d = new Date(customDateString);
        console.log('Date parsée:', d);
        if(!isNaN(d.getTime())) {
            start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
            console.log('Range personnalisé:', { start, end });
        } else {
            // Si la date est invalide, utiliser aujourd'hui par défaut
            console.log('Date invalide, utilisation d\'aujourd\'hui');
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        }
    } else {
        console.log('Période non reconnue ou date personnalisée manquante:', period, customDateString);
    }
    return { start, end };
}

function dateInRange(dateStr, start, end) {
    if(!dateStr) return false;
    try {
        const d = new Date(dateStr);
        // Vérifier si la date est valide
        if(isNaN(d.getTime())) return false;
        
        // Normaliser les dates pour ignorer l'heure (comparaison uniquement sur la date)
        const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        
        return dateOnly >= startDateOnly && dateOnly <= endDateOnly;
    } catch(e) {
        console.error('Erreur de date:', dateStr, e);
        return false;
    }
}

function onDashboardPeriodChange() {
    const sel = document.getElementById('dashboard-period');
    const dateInput = document.getElementById('dashboard-date');
    if(sel && dateInput) {
        if(sel.value === 'custom') dateInput.classList.remove('hidden');
        else dateInput.classList.add('hidden');
    }
    updateDashboard();
    // update chart mapping: map dashboard period to chart days
    const chartSel = document.getElementById('chart-period');
    if(chartSel) {
        if(sel.value === 'today') chartSel.value = '7';
        else if(sel.value === 'week') chartSel.value = '7';
        else if(sel.value === 'month') chartSel.value = '30';
        else if(sel.value === 'year') chartSel.value = '90';
        else if(sel.value === 'all') chartSel.value = '365'; // 1 an pour le graphique
        else if(sel.value === 'custom') chartSel.value = '7';
        updateMainChart();
    }
}

// === CHARTING ===
function updateMainChart() {
    const ctx = document.getElementById('chart-main').getContext('2d');
    const days = parseInt(document.getElementById('chart-period').value) || 7;

    // Destroy existing chart
    if (mainChart) {
        mainChart.destroy();
    }

    // Build labels for the range
    const labels = [...Array(days)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (days - 1 - i));
        return days === 7 ? d.toLocaleDateString('fr-FR', { weekday: 'short' }) : d.getDate().toString();
    });

    const inD = Array(days).fill(0);
    const outD = Array(days).fill(0);

    const now = new Date();
    const startOfRange = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));

    // Aggregate ventes (only paid) and depenses
    db.ventes.forEach(v => {
        if (v.status !== 'paid') return;
        const vDate = new Date(v.date);
        const diff = Math.floor((vDate - startOfRange) / (1000 * 60 * 60 * 24));
        if (diff >= 0 && diff < days) inD[diff] += (v.total || 0);
    });

    db.depenses.forEach(d => {
        const dDate = new Date(d.date);
        const diff = Math.floor((dDate - startOfRange) / (1000 * 60 * 60 * 24));
        if (diff >= 0 && diff < days) outD[diff] += (d.amount || 0);
    });

    // Create line chart similar to the initial version
    mainChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Recettes', data: inD, borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.05)', fill: true, tension: 0.4, borderWidth: 3, pointRadius: 2 },
                { label: 'Sorties', data: outD, borderColor: '#ef4444', backgroundColor: 'transparent', fill: false, tension: 0.4, borderDash: [5,5], borderWidth: 2, pointRadius: 0 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 9 }, callback: function(value) { return formatMoney(value, true); } } },
                x: { grid: { display: false }, ticks: { font: { size: 9 } } }
            },
            interaction: { intersect: false, mode: 'index' }
        }
    });
}

// === TOOLS & HELPERS ===
function updateSelects() {
    // Sale product select - only show products with stock > 0 or services (category contains "service" or "productivité")
    const saleSelect = document.getElementById('sale-product');
    const availableProducts = db.produits.filter(p => {
        // Services et produits de productivité sont toujours disponibles
        const isService = p.category && (
            p.category.toLowerCase().includes('service') || 
            p.category.toLowerCase().includes('productivité')
        );
        return p.stock > 0 || isService;
    });
    
    saleSelect.innerHTML = '<option value="">-- Sélectionner un produit --</option>' + 
        availableProducts
            .map(p => `<option value="${p.id}">${p.nom} (Stock: ${p.stock}) - ${formatMoney(p.vente)}</option>`)
            .join('');
}

function filterProducts(searchTerm) {
    const saleSelect = document.getElementById('sale-product');
    
    if(searchTerm.length > 0) {
        const filteredProducts = db.produits.filter(p => {
            // Services et produits de productivité sont toujours disponibles
            const isService = p.category && (
                p.category.toLowerCase().includes('service') || 
                p.category.toLowerCase().includes('productivité')
            );
            return (p.stock > 0 || isService) && (
                p.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.fournisseur.toLowerCase().includes(searchTerm.toLowerCase())
            );
        });
        
        saleSelect.innerHTML = '<option value="">-- Sélectionner un produit --</option>' + 
            filteredProducts
                .map(p => `<option value="${p.id}">${p.nom} (Stock: ${p.stock}) - ${formatMoney(p.vente)}</option>`)
                .join('');
        
        // Sélectionner automatiquement le premier résultat
        if(filteredProducts.length > 0) {
            saleSelect.value = filteredProducts[0].id;
            updateSalePrice();
        }
    } else {
        updateSelects(); // Restaurer la liste complète
    }
}

function setupProductSearch() {
    const searchInput = document.getElementById('product-search');
    if(searchInput) {
        searchInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const saleSelect = document.getElementById('sale-product');
            
            if(searchTerm.length > 0) {
                const filteredProducts = db.produits.filter(p => {
                    // Services et produits de productivité sont toujours disponibles
                    const isService = p.category && (
                        p.category.toLowerCase().includes('service') || 
                        p.category.toLowerCase().includes('productivité')
                    );
                    return (p.stock > 0 || isService) && (
                        p.nom.toLowerCase().includes(searchTerm) ||
                        p.category.toLowerCase().includes(searchTerm) ||
                        p.fournisseur.toLowerCase().includes(searchTerm)
                    );
                });
                
                saleSelect.innerHTML = '<option value="">-- Sélectionner un produit --</option>' + 
                    filteredProducts
                        .map(p => `<option value="${p.id}">${p.nom} (Stock: ${p.stock}) - ${formatMoney(p.vente)}</option>`)
                        .join('');
                
                // Sélectionner automatiquement le premier résultat
                if(filteredProducts.length > 0) {
                    saleSelect.value = filteredProducts[0].id;
                    updateSalePrice();
                }
            } else {
                updateSelects(); // Restaurer la liste complète
            }
        });
    }
}

function updateSalePrice() {
    const productId = document.getElementById('sale-product').value;
    const qty = parseInt(document.getElementById('sale-qty').value) || 1;
    const priceInput = document.getElementById('sale-price');
    
    if(!productId) {
        priceInput.value = '';
        return;
    }
    
    const product = db.produits.find(p => p.id === productId);
    if(product) {
        priceInput.value = product.vente;
        
        // Vérifier si la quantité est disponible (sauf pour les services)
        const isService = product.category && (
            product.category.toLowerCase().includes('service') || 
            product.category.toLowerCase().includes('productivité')
        );
        
        if(!isService && product.stock < qty) {
            priceInput.classList.add('border-red-300', 'bg-red-50');
            priceInput.classList.remove('border-slate-200', 'bg-slate-50');
        } else {
            priceInput.classList.remove('border-red-300', 'bg-red-50');
            priceInput.classList.add('border-slate-200', 'bg-slate-50');
        }
    } else {
        priceInput.value = '';
    }
}

function formatMoney(n, short = false) {
    if(isNaN(n)) n = 0;
    const currency = db.config.currency || "Ar";
    const formatter = new Intl.NumberFormat('fr-FR');
    
    if(short && n >= 1000000) {
        return (n / 1000000).toFixed(1) + 'M ' + currency;
    } else if(short && n >= 1000) {
        return (n / 1000).toFixed(0) + 'k ' + currency;
    } else {
        return formatter.format(n) + ' ' + currency;
    }
}

// Fonction spécifique pour le PDF (sans espaces dans les nombres)
function formatMoneyPDF(n, short = false) {
    if(isNaN(n)) n = 0;
    const currency = db.config.currency || "Ar";
    
    if(short && n >= 1000000) {
        return (n / 1000000).toFixed(1) + 'M' + currency;
    } else if(short && n >= 1000) {
        return (n / 1000).toFixed(0) + 'k' + currency;
    } else {
        // Format sans espaces pour éviter les problèmes dans certains lecteurs PDF
        return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + currency;
    }
}

// Échappe une chaîne pour éviter l'injection HTML
function escapeHtml(input) {
    if(input === null || input === undefined) return '';
    return String(input)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function addLog(text, type = "info") {
    db.logs.unshift({
        time: new Date().toISOString(),
        text: text,
        type: type
    });
    // Cap at 1000 logs
    if(db.logs.length > 1000) db.logs.pop();
}

function getLogIcon(type) {
    const icons = {
        'info': '<div class="p-2 bg-blue-100 text-blue-600 rounded-lg"><i data-lucide="info" class="w-4 h-4"></i></div>',
        'warning': '<div class="p-2 bg-amber-100 text-amber-600 rounded-lg"><i data-lucide="alert-triangle" class="w-4 h-4"></i></div>',
        'error': '<div class="p-2 bg-red-100 text-red-600 rounded-lg"><i data-lucide="x-circle" class="w-4 h-4"></i></div>',
        'success': '<div class="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><i data-lucide="check-circle" class="w-4 h-4"></i></div>'
    };
    return icons[type] || icons['info'];
}

function openModal(id) {
    try {
        console.log('[openModal] opening', id);
        const el = document.getElementById(id);
        if (!el) { console.warn('[openModal] element not found', id); return; }

        // Debug: état avant modification
        console.log('[openModal] before', id, 'classList=', Array.from(el.classList).join(' '));
        try {
            const cs = window.getComputedStyle(el);
            console.log('[openModal] computed before display=', cs.display, 'visibility=', cs.visibility, 'zIndex=', cs.zIndex);
        } catch(e) {}

        // S'assurer que le modal et ses ancêtres ne sont pas masqués
        let p = el.parentElement;
        let hiddenAncestor = false;
        while(p) {
            const c = Array.from(p.classList).join(' ');
            try {
                const pcs = window.getComputedStyle(p);
                if(pcs.display === 'none' || pcs.visibility === 'hidden') {
                    console.warn('[openModal] ancestor hidden', p.tagName, 'class=', c, 'display=', pcs.display, 'visibility=', pcs.visibility);
                    hiddenAncestor = true;
                    break;
                }
            } catch(e) {}
            p = p.parentElement;
        }

        // Si un ancêtre est masqué, déplacer le modal dans le body (portal dynamique)
        try {
            if(hiddenAncestor && el.parentElement !== document.body) {
                document.body.appendChild(el);
                console.log('[openModal] moved', id, 'to document.body to avoid hidden ancestors');
            }
        } catch(e) { console.warn('[openModal] failed to move modal to body', e); }

        // Fallback inline styles pour forcer l'affichage et priorité au-dessus des overlays
        try {
            el.style.position = 'fixed';
            el.style.zIndex = '99999';
            // ensure flex display (some CSS frameworks use display utilities)
            el.style.display = 'flex';
        } catch(e) {}

        el.classList.remove('hidden');
        el.classList.add('flex');
        document.body.style.overflow = 'hidden';

        // Debug: état après modification
        console.log('[openModal] after', id, 'classList=', Array.from(el.classList).join(' '));
        try {
            const cs2 = window.getComputedStyle(el);
            console.log('[openModal] computed after display=', cs2.display, 'visibility=', cs2.visibility, 'zIndex=', cs2.zIndex);
        } catch(e) {}

        initLucide();
    } catch (err) {
        console.error('[openModal] error', err, id);
    }
}

function closeModal(id) {
    try {
        console.log('[closeModal] closing', id);
        console.trace('[closeModal] trace');
        const el = document.getElementById(id);
        if (!el) { console.warn('[closeModal] element not found', id); return; }
        el.classList.add('hidden');
        el.classList.remove('flex');
        // remove inline fallbacks if present
        try {
            el.style.zIndex = '';
            el.style.position = '';
            el.style.display = '';
        } catch(e) {}
        document.body.style.overflow = 'auto';
    } catch (err) { console.error('[closeModal] error', err, id); }
    
    if(id === 'modal-product') {
        document.getElementById('form-product').reset();
        document.getElementById('edit-id').value = "";
        document.getElementById('product-modal-title').innerText = "Nouveau Matériel";
        document.getElementById('product-error').classList.add('hidden');
    }
    if(id === 'modal-stock-adjust') {
        document.getElementById('form-stock-adjust').reset();
        document.getElementById('product-cost-info').classList.add('hidden');
    }
    if(id === 'modal-reset') {
        document.getElementById('reset-pwd').value = "";
        document.getElementById('reset-error').classList.add('hidden');
    }
    if(id === 'modal-poste') {
        document.getElementById('poste-edit-id').value = "";
        document.getElementById('poste-name').value = "";
        document.getElementById('poste-password').value = "";
        document.getElementById('poste-password').required = true;
        const hint = document.getElementById('poste-pwd-hint');
        if(hint) hint.classList.add('hidden');
        document.getElementById('poste-modal-title').innerText = "Nouveau poste";
    }
    if(id === 'modal-auth') {
        document.getElementById('auth-password').value = "";
        document.getElementById('auth-error').classList.add('hidden');
        window.authCallback = null;
    }
}

function showConfirm(title, message, actionText, type = "info", callback) {
    document.getElementById('confirm-title').innerText = title;
    document.getElementById('confirm-message').innerText = message;
    document.getElementById('confirm-action').innerText = actionText;
    
    // Set icon based on type
    const iconDiv = document.getElementById('confirm-icon');
    iconDiv.className = 'w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center mx-auto mb-4';
    
    if(type === 'error') {
        iconDiv.classList.add('bg-red-100', 'text-red-600');
        iconDiv.innerHTML = '<i data-lucide="alert-circle" class="w-6 h-6 md:w-8 md:h-8"></i>';
    } else if(type === 'warning') {
        iconDiv.classList.add('bg-amber-100', 'text-amber-600');
        iconDiv.innerHTML = '<i data-lucide="alert-triangle" class="w-6 h-6 md:w-8 md:h-8"></i>';
    } else {
        iconDiv.classList.add('bg-blue-100', 'text-blue-600');
        iconDiv.innerHTML = '<i data-lucide="help-circle" class="w-6 h-6 md:w-8 md:h-8"></i>';
    }
    
    window.confirmCallback = callback;
    openModal('modal-confirm');
}

function executeConfirm() {
    if(window.confirmCallback) {
        window.confirmCallback();
    }
    closeModal('modal-confirm');
    window.confirmCallback = null;
}

function showToast(msg, type = "info") {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toast-icon');
    document.getElementById('toast-message').innerText = msg;

    // Reset classes
    toast.className = "fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-[200] px-4 md:px-6 py-2 md:py-3 text-white rounded-full shadow-2xl flex items-center gap-2 md:gap-3 transform translate-y-[-100px] transition-transform duration-300 pointer-events-none max-w-[90%]";
    
    if(type === 'success') {
        toast.classList.add('bg-emerald-600');
        icon.innerHTML = '<i data-lucide="check" class="w-3 h-3 md:w-4 md:h-4"></i>';
    } else if(type === 'error') {
        toast.classList.add('bg-red-600');
        icon.innerHTML = '<i data-lucide="alert-circle" class="w-3 h-3 md:w-4 md:h-4"></i>';
    } else if(type === 'warning') {
        toast.classList.add('bg-amber-600');
        icon.innerHTML = '<i data-lucide="alert-triangle" class="w-3 h-3 md:w-4 md:h-4"></i>';
    } else {
        toast.classList.add('bg-slate-900');
        icon.innerHTML = '<i data-lucide="info" class="w-3 h-3 md:w-4 md:h-4"></i>';
    }

    initLucide();
    toast.style.transform = "translate(-50%, 0)";
    setTimeout(() => { 
        toast.style.transform = "translate(-50%, -100px)"; 
    }, 3000);
}

// === DATA MANAGEMENT ===
function exportData() {
    if(!canAccess('configData')) { showToast("Action non autorisée", "error"); return; }
    try {
        const dataStr = JSON.stringify(db, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Enterprise_Backup_${new Date().toISOString().split('T')[0]}_v2.3.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        addLog("Backup exporté", "success");
        showToast("Backup téléchargé avec succès", "success");
    } catch(e) {
        console.error("Export Error", e);
        showToast("Erreur lors de l'export", "error");
    }
}

function exportStockCSV() {
    const headers = ['Nom', 'Catégorie', 'Fournisseur', 'Prix Achat', 'Prix Vente', 'Stock', 'Alerte Mini', 'Valeur Stock'];
    const rows = db.produits.map(p => [
        p.nom,
        p.category,
        p.fournisseur,
        p.achat,
        p.vente,
        p.stock,
        p.min,
        p.stock * p.achat
    ]);
    
    exportCSV(headers, rows, 'stock_inventaire');
}

function importStockCSV(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const text = e.target.result;
            const lines = text.split('\n').filter(line => line.trim());
            
            if (lines.length < 2) {
                showToast("Le fichier CSV est vide ou invalide", "error");
                return;
            }
            
            // Parser le CSV
            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const expectedHeaders = ['Nom', 'Catégorie', 'Fournisseur', 'Prix Achat', 'Prix Vente', 'Stock', 'Alerte Mini'];
            
            // Vérifier les en-tÃªtes
            const hasValidHeaders = expectedHeaders.every(header => 
                headers.some(h => h.toLowerCase().includes(header.toLowerCase()))
            );
            
            if (!hasValidHeaders) {
                showToast("Format CSV invalide. Les colonnes requises sont: Nom, Catégorie, Fournisseur, Prix Achat, Prix Vente, Stock, Alerte Mini", "error");
                return;
            }
            
            let importCount = 0;
            let updateCount = 0;
            let errorCount = 0;
            
            // Traiter chaque ligne
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
                
                if (values.length >= 7) {
                    try {
                        const productData = {
                            nom: values[0],
                            category: values[1] || 'Autre',
                            fournisseur: values[2] || 'Non spécifié',
                            achat: parseFloat(values[3]) || 0,
                            vente: parseFloat(values[4]) || 0,
                            stock: parseInt(values[5]) || 0,
                            min: parseInt(values[6]) || 1
                        };
                        
                        // Validation
                        if (!productData.nom || productData.achat <= 0 || productData.vente <= 0) {
                            errorCount++;
                            continue;
                        }
                        
                        // Vérifier si le produit existe déjÃ 
                        const existingProduct = db.produits.find(p => 
                            p.nom.toLowerCase() === productData.nom.toLowerCase()
                        );
                        
                        if (existingProduct) {
                            // Mettre Ã  jour le produit existant
                            Object.assign(existingProduct, productData);
                            updateCount++;
                        } else {
                            // Ajouter un nouveau produit
                            productData.id = 'P' + Date.now() + Math.floor(Math.random() * 1000);
                            db.produits.push(productData);
                            importCount++;
                        }
                    } catch (error) {
                        errorCount++;
                        console.error('Erreur ligne ' + (i + 1) + ':', error);
                    }
                } else {
                    errorCount++;
                }
            }
            
            // Sauvegarder et mettre Ã  jour
            saveDB();
            updateUI();
            
            // Afficher le résultat
            let message = `Importation terminée:\n`;
            if (importCount > 0) message += `â€¢ ${importCount} produit(s) ajouté(s)\n`;
            if (updateCount > 0) message += `â€¢ ${updateCount} produit(s) mis Ã  jour\n`;
            if (errorCount > 0) message += `â€¢ ${errorCount} erreur(s) ignorée(s)`;
            
            showToast(message, importCount > 0 ? "success" : "warning");
            
            // Logger l'action
            addLog(`Importation stock: ${importCount} ajoutés, ${updateCount} mis Ã  jour`, "info");
            
        } catch (error) {
            console.error('Erreur importation:', error);
            showToast("Erreur lors de l'importation du fichier", "error");
        }
    };
    
    reader.readAsText(file);
    
    // Réinitialiser l'input file
    event.target.value = '';
}

function exportSalesCSV() {
    const headers = ['Date', 'Facture', 'Client', 'Téléphone', 'Articles', 'Quantité Total', 'Total', 'Mode Paiement', 'Statut'];
    const rows = db.ventes.map(s => [
        new Date(s.date).toLocaleDateString('fr-FR'),
        s.id,
        s.client || 'Client Passager',
        s.clientPhone || '',
        s.items.map(i => i.productName).join('; '),
        s.items.reduce((sum, i) => sum + i.quantity, 0),
        s.total,
        getPaymentMethodText(s.paymentMethod),
        s.status === 'paid' ? 'Payé' : 'Crédit'
    ]);
    
    exportCSV(headers, rows, 'ventes_historique');
}

function exportExpensesCSV() {
    const headers = ['Date', 'Catégorie', 'Description', 'Montant'];
    const rows = db.depenses.map(e => [
        new Date(e.date).toLocaleDateString('fr-FR'),
        e.category,
        e.motif,
        e.amount
    ]);
    
    exportCSV(headers, rows, 'depenses_historique');
}

function exportCSV(headers, rows, filename) {
    try {
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        addLog(`Export CSV: ${filename}`, "info");
        showToast("Export CSV terminé", "success");
    } catch(e) {
        console.error("CSV Export Error", e);
        showToast("Erreur lors de l'export CSV", "error");
    }
}

function importData(event) {
    if(!canAccess('configData')) { showToast("Action non autorisée", "error"); return; }
    const file = event.target.files[0];
    if(!file) return;

    requireAuth(() => {
        showConfirm(
            "Importer des données",
            "Attention : cette action remplacera toutes vos données actuelles. Voulez-vous continuer ?",
            "Importer",
            "warning",
            () => {
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        const imported = JSON.parse(e.target.result);
                        if(imported.produits && imported.ventes) {
                            // Create backup before import
                            localStorage.setItem(STORAGE_KEY + "_pre_import_backup", JSON.stringify(db));
                            
                            db = imported;
                            addLog("Restauration complète effectuée", "info");
                            saveDB();
                            updateUI();
                            showToast("Données restaurées avec succès", "success");
                        } else {
                            throw new Error("Format de fichier invalide");
                        }
                    } catch(err) {
                        console.error("Import Error", err);
                        showToast("Fichier invalide ou corrompu", "error");
                    }
                };
                reader.readAsText(file);
            }
        );
    }, "Importer des données nécessite une authentification.");
}

function triggerReset() { 
    if(!canAccess('configData')) { showToast("Action non autorisée", "error"); return; }
    console.log('[triggerReset] invoked');
    requireAuth(() => {
        console.log('[triggerReset] auth success, showing final confirmation');
        showConfirm(
            "Confirmation finale",
            "ÃŠtes-vous ABSOLUMENT SÃ›R ? Toutes les données seront PERDUES définitivement.",
            "Je comprends, réinitialiser",
            "error",
            performFullReset
        );
    }, "Réinitialiser le système nécessite une authentification.");
}

function confirmReset() {
    console.log('[confirmReset] start');
    const pwd = document.getElementById('reset-pwd').value.trim();
    console.log('[confirmReset] provided pwd length', pwd.length);
    if(pwd === db.config.adminPassword) {
        showConfirm(
            "Confirmation finale",
            "ÃŠtes-vous ABSOLUMENT SÃ›R ? Toutes les données seront PERDUES définitivement.",
            "Je comprends, réinitialiser",
            "error",
            performFullReset
        );
    } else {
        document.getElementById('reset-error').innerText = "Mot de passe incorrect";
        document.getElementById('reset-error').classList.remove('hidden');
    }
}

// Actual reset operation (called after final confirmation)
function performFullReset() {
    try {
        // Create downloadable pre-reset backup so user can recover if needed
        try {
            const backupContent = JSON.stringify(db, null, 2);
            const blob = new Blob([backupContent], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Enterprise_pre_reset_backup_${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Pre-reset backup download failed', e);
        }

        // Clear all localStorage and sessionStorage to ensure a full reset
        try { localStorage.clear(); } catch (e) { console.error('localStorage.clear failed', e); }
        try { sessionStorage.clear(); } catch (e) { console.error('sessionStorage.clear failed', e); }

        // Attempt to delete an IndexedDB database named like STORAGE_KEY
        try {
            if (window.indexedDB && STORAGE_KEY) {
                indexedDB.deleteDatabase(STORAGE_KEY);
            }
        } catch (e) { console.error('IndexedDB delete failed', e); }

    } catch (e) {
        console.error('Error during reset process', e);
    }

    // Reload app to initialize clean state
    setTimeout(() => {
        location.reload();
    }, 800);
}

function clearLogs() {
    requireAuth(() => {
        showConfirm(
            "Vider le journal",
            "Voulez-vous vraiment vider tout le journal système ?",
            "Vider",
            "warning",
            () => {
                const backupLogs = db.logs.slice(0, 10); // Keep last 10 logs
                db.logs = [{time: new Date().toISOString(), text: "Journal vidé par l'utilisateur", type: "info"}, ...backupLogs];
                saveDB();
                updateUI();
                showToast("Journal vidé", "success");
            }
        );
    }, "Vider les logs nécessite une authentification.");
}

function updateStorageSize() {
    try {
        const size = (JSON.stringify(db).length / 1024).toFixed(2);
        document.getElementById('storage-size').innerText = size + " KB";
    } catch(e) {
        document.getElementById('storage-size').innerText = "Erreur";
    }
}

function refreshData() {
    const icon = document.querySelector('[data-lucide="refresh-cw"]');
    icon.classList.add('animate-spin');
    setTimeout(() => {
        updateUI();
        icon.classList.remove('animate-spin');
        showToast("Données actualisées", "success");
    }, 500);
}

function checkAlerts() {
    const criticalStock = db.produits.filter(p => p.stock <= p.min);
    const zeroStock = db.produits.filter(p => p.stock === 0);
    const caisse = calculateCaisse();
    const lowCaisse = db.config.caisseMin > 0 && caisse < db.config.caisseMin;
    const pendingCredits = db.credits.filter(c => c.status === 'pending').length;
    
    if(criticalStock.length > 0 || zeroStock.length > 0 || lowCaisse || pendingCredits > 0) {
        let alertMessage = "";
        if(criticalStock.length > 0) alertMessage += `${criticalStock.length} produit(s) en stock critique. `;
        if(zeroStock.length > 0) alertMessage += `${zeroStock.length} produit(s) épuisé(s). `;
        if(lowCaisse) alertMessage += `Caisse faible : ${formatMoney(caisse)}. `;
        if(pendingCredits > 0) alertMessage += `${pendingCredits} crédit(s) en attente. `;
        
        if(alertMessage) {
            showToast(alertMessage, "warning");
        }
    }
}

// === KEYBOARD SHORTCUTS ===
document.addEventListener('keydown', function(e) {
    // Ctrl+S: Save
    if((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveDB();
        showToast("Sauvegarde effectuée", "success");
    }
    
    // Ctrl+F: Focus search
    if((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.getElementById('search-stock');
        if(searchInput) {
            searchInput.focus();
        }
    }
    
    // Escape: Close modals
    if(e.key === 'Escape') {
        const openModals = document.querySelectorAll('.fixed[style*="display: flex"]');
        if(openModals.length > 0) {
            openModals.forEach(modal => {
                const modalId = modal.id;
                if(modalId && modalId.startsWith('modal-')) {
                    closeModal(modalId);
                }
            });
        }
    }
});
// === MODULE DE SÉCURITÉ (Étape 2) ===

// 1. Configuration (Vous pouvez changer la phrase secrète)
const TRIAL_DAYS = 7; 
const SECRET_SALT = "MA_PHRASE_SEC_2024"; // Gardez cette phrase pour vous

const SecurityManager = {
    // Fonction pour créer l'identifiant unique de l'ordinateur
    getDeviceId: function() {
const nav = window.navigator;
const screen = window.screen;
// On mélange les infos du matériel (écran, navigateur, processeur)
let str = nav.userAgent + nav.language + screen.colorDepth + screen.width + (nav.hardwareConcurrency || 4);
let hash = 0;
for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
}
return "EMP-" + Math.abs(hash).toString(16).toUpperCase();
    },

    // Fonction qui génère la clé valide Ã  partir d'un ID (Algorithme)
    generateKey: function(deviceId) {
let combined = deviceId + SECRET_SALT;
let hash = 0;
for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash) + combined.charCodeAt(i);
    hash |= 0;
}
return "LIC-" + Math.abs(hash).toString(36).toUpperCase();
    },

    // Vérification de l'état (Activé, Essaye ou Expiré)
    checkStatus: function() {
const deviceId = this.getDeviceId();
const storedKey = localStorage.getItem('_app_license_');
const firstRun = localStorage.getItem('_app_start_date_');

// A. Vérifier si une licence valide existe déjÃ  sur l'ordinateur
if (storedKey && storedKey === this.generateKey(deviceId)) {
    return { status: 'AUTHORIZED' };
}

// B. Gérer la période d'essaye
const now = new Date().getTime();
if (!firstRun) {
    localStorage.setItem('_app_start_date_', now);
    return { status: 'TRIAL', daysLeft: TRIAL_DAYS };
}

const diffDays = Math.floor((now - parseInt(firstRun)) / (1000 * 60 * 60 * 24));
if (diffDays < TRIAL_DAYS) {
    return { status: 'TRIAL', daysLeft: TRIAL_DAYS - diffDays };
}

return { status: 'EXPIRED' };
    }
};

// Fonction qui s'exécute au démarrage pour décider quoi afficher
function runSecurityCheck() {
    const result = SecurityManager.checkStatus();
    const deviceId = SecurityManager.getDeviceId();
    
    document.getElementById('device-id-display').value = deviceId;

    const trialBadge = document.getElementById('trial-info-badge');

    if (result.status === 'AUTHORIZED') {
// --- ÉTAT : ACTIVÉ COMPLET ---
document.getElementById('license-overlay').style.display = 'none';
document.getElementById('app-content').style.display = 'block';

// On change le texte du badge au lieu de le cacher (Optionnel)
// Ou vous pouvez faire trialBadge.style.display = 'none';
trialBadge.style.display = 'flex';
trialBadge.classList.remove('bg-amber-100', 'border-amber-200');
trialBadge.classList.add('bg-green-100', 'border-green-200'); // Couleur verte
document.getElementById('days-text').innerHTML = '<span class="text-green-700 font-bold">Version Complète Activée</span>';

// On cache l'icÃ´ne d'alerte si nécessaire
const icon = trialBadge.querySelector('i');
if(icon) icon.style.color = '#10b981';
    } 
    else if (result.status === 'TRIAL') {
// --- ÉTAT : EN ESSAI ---
document.getElementById('license-overlay').style.display = 'none';
document.getElementById('app-content').style.display = 'block';

trialBadge.style.display = 'flex';
// Affichage dynamique du temps restant
document.getElementById('days-text').innerText = result.daysLeft + " jour(s) d'essai restants";

document.getElementById('close-license').classList.remove('hidden');
    } 
    else {
// --- ÉTAT : EXPIRÉ ---
document.getElementById('license-overlay').style.display = 'flex';
document.getElementById('app-content').style.display = 'none';
trialBadge.style.display = 'none';

document.getElementById('close-license').classList.add('hidden');
document.getElementById('license-msg').innerText = "Votre période d'essai est terminée. \n veuillez activer le logiciel pour continuer Ã  l'utiliser.\n Alefa ** Mvola @ 034 18 420 13 ** : 20.000Ar";
    }
}


// Fonction pour le bouton "Activer"
function validateAndActivate() {
    const inputKey = document.getElementById('license-key-input').value.trim();
    const deviceId = SecurityManager.getDeviceId();
    const correctKey = SecurityManager.generateKey(deviceId);

    if (inputKey === correctKey) {
// Enregistrement de la licence dans le disque dure local (localStorage)
localStorage.setItem('_app_license_', inputKey);
alert("Activation réussie !");

// On recharge pour que runSecurityCheck() détecte le statut 'AUTHORIZED'
location.reload(); 
    } else {
alert("Clé invalide.");
    }
}

// === REPORTS FUNCTIONS ===
function onReportsPeriodChange() {
    const sel = document.getElementById('reports-period');
    const dateInput = document.getElementById('reports-date');
    if(sel && dateInput) {
if(sel.value === 'custom') {
    dateInput.classList.remove('hidden');
    // Ajouter un écouteur d'événement pour la date
    dateInput.addEventListener('change', updateReports);
} else {
    dateInput.classList.add('hidden');
    // Mettre Ã  jour immédiatement pour les autres périodes
    updateReports();
}
    }
}

function updateReports() {
    // Read reports filter
    const period = (document.getElementById('reports-period') && document.getElementById('reports-period').value) || 'all';
    const customDate = document.getElementById('reports-date') ? document.getElementById('reports-date').value : null;
    const range = getRangeForPeriod(period, customDate);

    // Debug: Afficher les informations de filtrage
    console.log('Rapport - Période:', period);
    console.log('Rapport - Range:', { start: range.start, end: range.end });

    const ventesFiltered = db.ventes.filter(v => dateInRange(v.date, range.start, range.end));
    const depensesFiltered = db.depenses.filter(e => dateInRange(e.date, range.start, range.end));
    const creditsFiltered = db.credits.filter(c => dateInRange(c.date, range.start, range.end));

    // Debug: Afficher les nombres de résultats
    console.log('Rapport - Ventes filtrées:', ventesFiltered.length, 'sur', db.ventes.length);
    console.log('Rapport - Dépenses filtrées:', depensesFiltered.length, 'sur', db.depenses.length);
    console.log('Rapport - Crédits filtrés:', creditsFiltered.length, 'sur', db.credits.length);

    const totalVentes = ventesFiltered.filter(v => v.status === 'paid').reduce((sum, s) => sum + (s.total||0), 0);
    const totalDepenses = depensesFiltered.reduce((sum, e) => sum + (e.amount||0), 0);
    const totalProfit = ventesFiltered.filter(v => v.status === 'paid').reduce((sum, s) => sum + (s.profit||0), 0) - totalDepenses;
    const totalCredits = creditsFiltered.reduce((sum, c) => sum + (c.balance||0), 0);

    // Debug: Afficher les totaux calculés
    console.log('Rapport - Totaux:', { totalVentes, totalDepenses, totalProfit, totalCredits });

    // Update summary cards
    document.getElementById('report-total-sales').innerText = formatMoney(totalVentes);
    document.getElementById('report-total-expenses').innerText = formatMoney(totalDepenses);
    document.getElementById('report-net-profit').innerText = formatMoney(totalProfit);
    document.getElementById('report-credits').innerText = formatMoney(totalCredits);

    // Calculate best customer (excluding Client Passager)
    const customerStats = {};
    ventesFiltered.forEach(sale => {
const clientName = sale.client || 'Client Passager';
// Exclure les clients passagers du calcul
if(clientName !== 'Client Passager') {
    if(!customerStats[clientName]) {
        customerStats[clientName] = { total: 0, count: 0 };
    }
    customerStats[clientName].total += sale.total || 0;
    customerStats[clientName].count += 1;
}
    });

    const bestCustomer = Object.entries(customerStats)
.sort((a, b) => b[1].total - a[1].total)[0];
    
    if(bestCustomer) {
document.getElementById('report-best-customer').innerText = bestCustomer[0];
    } else {
document.getElementById('report-best-customer').innerText = 'Aucun client';
    }

    // Update sales list
    const salesListDiv = document.getElementById('report-sales-list');
    if(ventesFiltered.length === 0) {
salesListDiv.innerHTML = '<div class="text-center text-slate-400 py-8">Aucune vente trouvée</div>';
    } else {
salesListDiv.innerHTML = ventesFiltered.slice(0, 10).map(sale => `
    <div class="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
        <div class="flex justify-between items-start">
            <div>
                <div class="font-semibold text-sm">${sale.client || 'Client'}</div>
                <div class="text-xs text-slate-500">${new Date(sale.date).toLocaleDateString('fr-FR')}</div>
            </div>
            <div class="text-right">
                <div class="font-bold text-sm">${formatMoney(sale.total || 0)}</div>
                <div class="text-xs ${sale.status === 'paid' ? 'text-green-600' : 'text-amber-600'}">
                    ${sale.status === 'paid' ? 'Payée' : 'En attente'}
                </div>
            </div>
        </div>
    </div>
`).join('');
    }

    // Update expenses list
    const expensesListDiv = document.getElementById('report-expenses-list');
    if(depensesFiltered.length === 0) {
expensesListDiv.innerHTML = '<div class="text-center text-slate-400 py-8">Aucune dépense trouvée</div>';
    } else {
expensesListDiv.innerHTML = depensesFiltered.slice(0, 10).map(expense => `
    <div class="p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
        <div class="flex justify-between items-start">
            <div>
                <div class="font-semibold text-sm">${expense.category || 'Dépense'}</div>
                <div class="text-xs text-slate-500">${new Date(expense.date).toLocaleDateString('fr-FR')}</div>
                ${expense.description ? `<div class="text-xs text-slate-600 mt-1">${expense.description}</div>` : ''}
            </div>
            <div class="text-right">
                <div class="font-bold text-sm text-red-600">${formatMoney(expense.amount || 0)}</div>
            </div>
        </div>
    </div>
`).join('');
    }

    // Update top products by revenue
    const topProductsRevenueDiv = document.getElementById('report-top-products-revenue');
    const productSalesRevenue = {};
    
    ventesFiltered.forEach(sale => {
if(sale.items && Array.isArray(sale.items)) {
    sale.items.forEach(item => {
        if(!productSalesRevenue[item.productName]) {
            productSalesRevenue[item.productName] = { quantity: 0, revenue: 0 };
        }
        productSalesRevenue[item.productName].quantity += item.quantity || 0;
        productSalesRevenue[item.productName].revenue += (item.quantity || 0) * (item.price || 0);
    });
}
    });

    const topProductsRevenue = Object.entries(productSalesRevenue)
.sort((a, b) => b[1].revenue - a[1].revenue)
.slice(0, 6);

    if(topProductsRevenue.length === 0) {
topProductsRevenueDiv.innerHTML = '<div class="col-span-full text-center text-slate-400 py-8">Aucune vente de produits</div>';
    } else {
topProductsRevenueDiv.innerHTML = topProductsRevenue.map(([name, data], index) => `
    <div class="p-4 bg-gradient-to-r ${index === 0 ? 'from-purple-50 to-purple-100 border-purple-200' : index === 1 ? 'from-blue-50 to-blue-100 border-blue-200' : index === 2 ? 'from-emerald-50 to-emerald-100 border-emerald-200' : 'from-slate-50 to-slate-100 border-slate-200'} border rounded-xl">
        <div class="flex justify-between items-start mb-2">
            <span class="font-semibold text-sm">${name}</span>
            <span class="text-xs font-bold ${index === 0 ? 'text-purple-600' : index === 1 ? 'text-blue-600' : index === 2 ? 'text-emerald-600' : 'text-slate-600'}">#${index + 1}</span>
        </div>
        <div class="text-xs text-slate-600">
            <div>Quantité: ${data.quantity}</div>
            <div>Revenu: ${formatMoney(data.revenue)}</div>
        </div>
    </div>
`).join('');
    }

    // Update top products by quantity
    const topProductsQuantityDiv = document.getElementById('report-top-products-quantity');
    const productSalesQuantity = {};
    
    ventesFiltered.forEach(sale => {
if(sale.items && Array.isArray(sale.items)) {
    sale.items.forEach(item => {
        if(!productSalesQuantity[item.productName]) {
            productSalesQuantity[item.productName] = { quantity: 0, revenue: 0 };
        }
        productSalesQuantity[item.productName].quantity += item.quantity || 0;
        productSalesQuantity[item.productName].revenue += (item.quantity || 0) * (item.price || 0);
    });
}
    });

    const topProductsQuantity = Object.entries(productSalesQuantity)
.sort((a, b) => b[1].quantity - a[1].quantity)
.slice(0, 6);

    if(topProductsQuantity.length === 0) {
topProductsQuantityDiv.innerHTML = '<div class="col-span-full text-center text-slate-400 py-8">Aucune vente de produits</div>';
    } else {
topProductsQuantityDiv.innerHTML = topProductsQuantity.map(([name, data], index) => `
    <div class="p-4 bg-gradient-to-r ${index === 0 ? 'from-blue-50 to-blue-100 border-blue-200' : index === 1 ? 'from-emerald-50 to-emerald-100 border-emerald-200' : index === 2 ? 'from-amber-50 to-amber-100 border-amber-200' : 'from-slate-50 to-slate-100 border-slate-200'} border rounded-xl">
        <div class="flex justify-between items-start mb-2">
            <span class="font-semibold text-sm">${name}</span>
            <span class="text-xs font-bold ${index === 0 ? 'text-blue-600' : index === 1 ? 'text-emerald-600' : index === 2 ? 'text-amber-600' : 'text-slate-600'}">#${index + 1}</span>
        </div>
        <div class="text-xs text-slate-600">
            <div>Quantité: ${data.quantity}</div>
            <div>Revenu: ${formatMoney(data.revenue)}</div>
        </div>
    </div>
`).join('');
    }
}

function generatePDFReport() {
    const { jsPDF } = window.jspdf;
    
    // Récupérer les données du rapport
    const period = (document.getElementById('reports-period') && document.getElementById('reports-period').value) || 'all';
    const customDate = document.getElementById('reports-date') ? document.getElementById('reports-date').value : null;
    const range = getRangeForPeriod(period, customDate);
    
    const ventesFiltered = db.ventes.filter(v => dateInRange(v.date, range.start, range.end));
    const depensesFiltered = db.depenses.filter(e => dateInRange(e.date, range.start, range.end));
    const creditsFiltered = db.credits.filter(c => dateInRange(c.date, range.start, range.end));
    
    const totalVentes = ventesFiltered.filter(v => v.status === 'paid').reduce((sum, s) => sum + (s.total||0), 0);
    const totalDepenses = depensesFiltered.reduce((sum, e) => sum + (e.amount||0), 0);
    const totalProfit = totalVentes - totalDepenses;
    const totalCredits = creditsFiltered.reduce((sum, c) => sum + (c.balance||0), 0);
    
    // Calculer le meilleur client
    const customerStats = {};
    ventesFiltered.forEach(sale => {
const clientName = sale.client || 'Client Passager';
if(clientName !== 'Client Passager') {
    if(!customerStats[clientName]) {
        customerStats[clientName] = { total: 0, count: 0 };
    }
    customerStats[clientName].total += sale.total || 0;
    customerStats[clientName].count += 1;
}
    });
    
    const bestCustomer = Object.entries(customerStats)
.sort((a, b) => b[1].total - a[1].total)[0];
    
    // Calculer les produits les plus vendus
    const productSales = {};
    ventesFiltered.forEach(sale => {
if(sale.items && Array.isArray(sale.items)) {
    sale.items.forEach(item => {
        if(!productSales[item.productName]) {
            productSales[item.productName] = { quantity: 0, revenue: 0 };
        }
        productSales[item.productName].quantity += item.quantity || 0;
        productSales[item.productName].revenue += (item.quantity || 0) * (item.price || 0);
    });
}
    });
    
    const topProductsRevenue = Object.entries(productSales)
.sort((a, b) => b[1].revenue - a[1].revenue)
.slice(0, 5);
    
    const topProductsQuantity = Object.entries(productSales)
.sort((a, b) => b[1].quantity - a[1].quantity)
.slice(0, 5);
    
    // Créer le PDF avec support UTF-8
    const pdf = new jsPDF({
orientation: 'p',
unit: 'mm',
format: 'a4',
compress: true
    });
    
    // Ajouter le support des caractères français
    pdf.addFont('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf', 'Roboto', 'normal');
    pdf.setFont('Roboto');
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPosition = 20;
    
    // Fonction utilitaire pour ajouter une nouvelle page si nécessaire
    function checkPageBreak(requiredHeight) {
if(yPosition + requiredHeight > pageHeight - 20) {
    pdf.addPage();
    yPosition = 20;
    return true;
}
return false;
    }
    
    // Fonction pour formater le texte sans accents (uniquement les lettres)
    function normalizeText(text) {
return text.toString()
    .replace(/[Ã€ÃÃ‚ÃƒÃ„Ã…]/g, 'A')
    .replace(/[Ã Ã¡Ã¢Ã£Ã¤Ã¥]/g, 'a')
    .replace(/[ÃˆÉÃŠÃ‹]/g, 'E')
    .replace(/[èéÃªÃ«]/g, 'e')
    .replace(/[ÃŒÃÃŽÃ]/g, 'I')
    .replace(/[Ã¬Ã­îÃ¯]/g, 'i')
    .replace(/[Ã’Ã“Ã”Ã•Ã–]/g, 'O')
    .replace(/[Ã²Ã³Ã´ÃµÃ¶]/g, 'o')
    .replace(/[Ã™ÃšÃ›Ãœ]/g, 'U')
    .replace(/[Ã¹ÃºÃ»Ã¼]/g, 'u')
    .replace(/[Ã‡]/g, 'C')
    .replace(/[ç]/g, 'c')
    .replace(/[Ã‘]/g, 'N')
    .replace(/[Ã±]/g, 'n')
    .replace(/[Ã]/g, 'Y')
    .replace(/[Ã½Ã¿]/g, 'y');
    }
    
    // En-tÃªte avec cadre
    pdf.setDrawColor(59, 130, 246);
    pdf.setFillColor(59, 130, 246);
    pdf.rect(15, 15, pageWidth - 30, 40, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(24);
    pdf.setFont(undefined, 'bold');
    pdf.text('RAPPORT DE GESTION', pageWidth / 2, 30, { align: 'center' });
    
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'normal');
    const periodText = period === 'custom' && customDate ? 
`Date: ${new Date(customDate).toLocaleDateString('fr-FR')}` :
period === 'today' ? "Aujourd'hui" :
period === 'week' ? "7 derniers jours" :
period === 'month' ? "30 derniers jours" :
period === 'year' ? "Cette annee" : "Toutes les donnees";
    
    pdf.text(`Periode: ${normalizeText(periodText)}`, pageWidth / 2, 45, { align: 'center' });
    pdf.text(`Genere le: ${new Date().toLocaleDateString('fr-FR')} a ${new Date().toLocaleTimeString('fr-FR')}`, pageWidth / 2, 50, { align: 'center' });
    
    yPosition = 70;
    
    // Resume financier avec tableau
    checkPageBreak(80);
    
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('RESUME FINANCIER', 20, yPosition);
    yPosition += 15;
    
    // Cadre pour le resume
    pdf.setDrawColor(200, 200, 200);
    pdf.setFillColor(248, 250, 252);
    pdf.rect(15, yPosition - 5, pageWidth - 30, 65, 'F');
    pdf.rect(15, yPosition - 5, pageWidth - 30, 65);
    
    // Donnees du resume en colonnes
    pdf.setFontSize(11);
    pdf.setFont(undefined, 'bold');
    pdf.text('INDICATEUR', 25, yPosition + 5);
    pdf.text('MONTANT', pageWidth - 60, yPosition + 5);
    
    pdf.setFont(undefined, 'normal');
    pdf.setTextColor(50, 50, 50);
    
    const summaryData = [
['Total Ventes', totalVentes],
['Total Depenses', totalDepenses],
['Benefice Net', totalProfit],
['Credits en cours', totalCredits],
['Meilleur Client', bestCustomer ? bestCustomer[0] : 'Aucun']
    ];
    
    summaryData.forEach(([label, value], index) => {
yPosition += 10;
pdf.setFont(undefined, 'bold');
pdf.text(normalizeText(label), 25, yPosition);
pdf.setFont(undefined, 'normal');
if(typeof value === 'number') {
    pdf.text(formatMoneyPDF(value), pageWidth - 60, yPosition);
} else {
    pdf.text(normalizeText(value.toString()), pageWidth - 60, yPosition);
}
    });
    
    yPosition += 20;
    
    // Top produits par revenus
    if(topProductsRevenue.length > 0) {
checkPageBreak(100);

pdf.setTextColor(0, 0, 0);
pdf.setFontSize(16);
pdf.setFont(undefined, 'bold');
pdf.text('TOP 5 PRODUITS (PAR REVENUS)', 20, yPosition);
yPosition += 15;

// En-tete du tableau
pdf.setDrawColor(59, 130, 246);
pdf.setFillColor(59, 130, 246);
pdf.rect(15, yPosition - 5, pageWidth - 30, 10, 'F');

pdf.setTextColor(255, 255, 255);
pdf.setFontSize(10);
pdf.setFont(undefined, 'bold');
pdf.text('#', 20, yPosition);
pdf.text('PRODUIT', 35, yPosition);
pdf.text('QUANTITE', pageWidth - 80, yPosition, { align: 'right' });
pdf.text('REVENUS', pageWidth - 25, yPosition, { align: 'right' });

yPosition += 5;

// Donnees du tableau
topProductsRevenue.forEach(([name, data], index) => {
    yPosition += 8;
    
    // Ligne alternee
    if(index % 2 === 0) {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(15, yPosition - 3, pageWidth - 30, 8, 'F');
    }
    
    pdf.setDrawColor(200, 200, 200);
    pdf.rect(15, yPosition - 3, pageWidth - 30, 8);
    
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, 'normal');
    pdf.text(`${index + 1}`, 20, yPosition + 2);
    pdf.text(normalizeText(name.length > 30 ? name.substring(0, 27) + '...' : name), 35, yPosition + 2);
    pdf.text(data.quantity.toString(), pageWidth - 80, yPosition + 2, { align: 'right' });
    pdf.text(formatMoneyPDF(data.revenue), pageWidth - 25, yPosition + 2, { align: 'right' });
});

yPosition += 15;
    }
    
    // Top produits par quantite
    if(topProductsQuantity.length > 0) {
checkPageBreak(100);

pdf.setTextColor(0, 0, 0);
pdf.setFontSize(16);
pdf.setFont(undefined, 'bold');
pdf.text('TOP 5 PRODUITS (PAR QUANTITE)', 20, yPosition);
yPosition += 15;

// En-tete du tableau
pdf.setDrawColor(34, 197, 94);
pdf.setFillColor(34, 197, 94);
pdf.rect(15, yPosition - 5, pageWidth - 30, 10, 'F');

pdf.setTextColor(255, 255, 255);
pdf.setFontSize(10);
pdf.setFont(undefined, 'bold');
pdf.text('#', 20, yPosition);
pdf.text('PRODUIT', 35, yPosition);
pdf.text('QUANTITE', pageWidth - 80, yPosition, { align: 'right' });
pdf.text('REVENUS', pageWidth - 25, yPosition, { align: 'right' });

yPosition += 5;

// Donnees du tableau
topProductsQuantity.forEach(([name, data], index) => {
    yPosition += 8;
    
    // Ligne alternee
    if(index % 2 === 0) {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(15, yPosition - 3, pageWidth - 30, 8, 'F');
    }
    
    pdf.setDrawColor(200, 200, 200);
    pdf.rect(15, yPosition - 3, pageWidth - 30, 8);
    
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, 'normal');
    pdf.text(`${index + 1}`, 20, yPosition + 2);
    pdf.text(normalizeText(name.length > 30 ? name.substring(0, 27) + '...' : name), 35, yPosition + 2);
    pdf.text(data.quantity.toString(), pageWidth - 80, yPosition + 2, { align: 'right' });
    pdf.text(formatMoneyPDF(data.revenue), pageWidth - 25, yPosition + 2, { align: 'right' });
});

yPosition += 15;
    }
    
    // Detail des ventes recentes
    if(ventesFiltered.length > 0) {
checkPageBreak(120);

pdf.setTextColor(0, 0, 0);
pdf.setFontSize(16);
pdf.setFont(undefined, 'bold');
pdf.text('DETAIL DES VENTES RECENTES', 20, yPosition);
yPosition += 15;

// En-tete du tableau
pdf.setDrawColor(156, 163, 175);
pdf.setFillColor(156, 163, 175);
pdf.rect(15, yPosition - 5, pageWidth - 30, 10, 'F');

pdf.setTextColor(255, 255, 255);
pdf.setFontSize(9);
pdf.setFont(undefined, 'bold');
pdf.text('DATE', 20, yPosition);
pdf.text('CLIENT', 50, yPosition);
pdf.text('TOTAL', pageWidth - 60, yPosition, { align: 'right' });
pdf.text('STATUT', pageWidth - 25, yPosition, { align: 'right' });

yPosition += 5;

// Donnees du tableau
const recentSales = ventesFiltered.slice(0, 15);
recentSales.forEach((sale, index) => {
    checkPageBreak(10);
    
    yPosition += 7;
    
    // Ligne alternee
    if(index % 2 === 0) {
        pdf.setFillColor(248, 250, 252);
        pdf.rect(15, yPosition - 3, pageWidth - 30, 7, 'F');
    }
    
    pdf.setDrawColor(200, 200, 200);
    pdf.rect(15, yPosition - 3, pageWidth - 30, 7);
    
    pdf.setTextColor(0, 0, 0);
    pdf.setFont(undefined, 'normal');
    
    const clientName = sale.client || 'Client Passager';
    const dateStr = new Date(sale.date).toLocaleDateString('fr-FR');
    const statusText = sale.status === 'paid' ? 'Paye' : 'Credit';
    
    pdf.text(dateStr, 20, yPosition + 2);
    pdf.text(normalizeText(clientName.length > 25 ? clientName.substring(0, 22) + '...' : clientName), 50, yPosition + 2);
    pdf.text(formatMoneyPDF(sale.total), pageWidth - 60, yPosition + 2, { align: 'right' });
    
    pdf.setTextColor(sale.status === 'paid' ? 34 : 245, sale.status === 'paid' ? 197 : 158, sale.status === 'paid' ? 94 : 11);
    pdf.setFont(undefined, 'bold');
    pdf.text(normalizeText(statusText), pageWidth - 25, yPosition + 2, { align: 'right' });
});
    }
    
    // Pied de page
    const totalPages = pdf.internal.getNumberOfPages();
    for(let i = 1; i <= totalPages; i++) {
pdf.setPage(i);

// Ligne de separation
pdf.setDrawColor(200, 200, 200);
pdf.setLineWidth(0.5);
pdf.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15);

pdf.setTextColor(100, 100, 100);
pdf.setFontSize(8);
pdf.setFont(undefined, 'normal');
pdf.text(`Page ${i} / ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
pdf.text('Enterprise Management Pro v2.3 - Rapport de Gestion', pageWidth / 2, pageHeight - 5, { align: 'center' });
    }
    
    // Telecharger le PDF
    const fileName = `rapport_gestion_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
    
    showToast('Rapport PDF genere avec succes', 'success');
}

// Lancement automatique du test de sécurité
runSecurityCheck();

