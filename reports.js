// ============================================
// SYSTÈME DE RAPPORTS AVANCÉS - Enterprise Pro
// ============================================

class ReportSystem {
    constructor() {
        this.init();
    }
    
    init() {
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Les événements seront liés après le chargement du DOM
    }
    
    // ===== RAPPORT DE RENTABILITÉ =====
    generateProfitabilityReport() {
        const report = db.produits.map(product => {
            // Calculer les ventes pour ce produit
            const productSales = db.ventes.flatMap(sale => 
                sale.items.filter(item => item.productId === product.id)
            );
            
            const totalSold = productSales.reduce((sum, item) => sum + item.quantity, 0);
            const totalRevenue = productSales.reduce((sum, item) => sum + item.total, 0);
            const totalCost = productSales.reduce((sum, item) => sum + (item.cost || product.achat * item.quantity), 0);
            const profit = totalRevenue - totalCost;
            const margin = totalRevenue > 0 ? (profit / totalRevenue * 100) : 0;
            
            return {
                produit: product.nom,
                categorie: product.category || 'Non catégorisé',
                vendus: totalSold,
                revenu: totalRevenue,
                cout: totalCost,
                profit: profit,
                marge: margin,
                stock: product.stock,
                rotation: product.stock > 0 ? (totalSold / product.stock).toFixed(2) : '∞'
            };
        }).sort((a, b) => b.profit - a.profit); // Trier par profit décroissant
        
        return report;
    }
    
    renderProfitabilityReport() {
        const report = this.generateProfitabilityReport();
        const container = document.getElementById('profitability-report');
        
        if(!container) return;
        
        if(report.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-slate-400">
                    <i data-lucide="bar-chart" class="w-12 h-12 mx-auto mb-2 opacity-30"></i>
                    <p>Aucune donnée de vente</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = report.map((item, index) => `
            <div class="p-3 border-b hover:bg-slate-50 ${index < 3 ? 'bg-emerald-50' : ''}">
                <div class="flex justify-between items-center mb-1">
                    <div class="font-medium">${item.produit}</div>
                    <div class="text-sm font-bold ${item.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}">
                        ${formatMoney(item.profit)}
                    </div>
                </div>
                <div class="flex justify-between text-xs text-slate-500">
                    <span>${item.vendus} vendus • Marge: ${item.marge.toFixed(1)}%</span>
                    <span>Rotation: ${item.rotation}</span>
                </div>
            </div>
        `).join('');
        
        // Mettre à jour les icônes
        setTimeout(() => lucide.createIcons(), 100);
    }
    
    // ===== TOP 10 CLIENTS =====
    generateTopClientsReport(limit = 10) {
        const clientMap = {};
        
        db.ventes.forEach(sale => {
            if(!clientMap[sale.clientName]) {
                clientMap[sale.clientName] = {
                    name: sale.clientName,
                    totalSpent: 0,
                    invoices: 0,
                    lastPurchase: sale.date
                };
            }
            
            clientMap[sale.clientName].totalSpent += sale.total;
            clientMap[sale.clientName].invoices += 1;
            
            if(new Date(sale.date) > new Date(clientMap[sale.clientName].lastPurchase)) {
                clientMap[sale.clientName].lastPurchase = sale.date;
            }
        });
        
        return Object.values(clientMap)
            .sort((a, b) => b.totalSpent - a.totalSpent)
            .slice(0, limit);
    }
    
    renderTopClientsReport() {
        const clients = this.generateTopClientsReport(10);
        const container = document.getElementById('top-clients-report');
        
        if(!container) return;
        
        if(clients.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-slate-400">
                    <i data-lucide="users" class="w-12 h-12 mx-auto mb-2 opacity-30"></i>
                    <p>Aucun client trouvé</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = clients.map((client, index) => `
            <div class="p-3 border-b hover:bg-slate-50 ${index < 3 ? 'bg-blue-50' : ''}">
                <div class="flex justify-between items-center mb-1">
                    <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center">
                            ${index + 1}
                        </div>
                        <div class="font-medium">${client.name}</div>
                    </div>
                    <div class="font-bold text-blue-600">${formatMoney(client.totalSpent)}</div>
                </div>
                <div class="text-xs text-slate-500">
                    ${client.invoices} facture(s) • Dernier achat: ${new Date(client.lastPurchase).toLocaleDateString('fr-FR')}
                </div>
            </div>
        `).join('');
    }
    
    // ===== RAPPORT DE STOCK =====
    generateStockReport() {
        const stockReport = db.produits.map(product => {
            const stockValue = product.stock * product.achat;
            const daysOfCover = this.calculateDaysOfCover(product);
            
            return {
                produit: product.nom,
                categorie: product.category,
                stock: product.stock,
                seuil: product.min,
                valeur: stockValue,
                joursCouverture: daysOfCover,
                statut: this.getStockStatus(product)
            };
        }).sort((a, b) => a.stock - b.stock); // Trier par stock croissant
        
        return stockReport;
    }
    
    calculateDaysOfCover(product) {
        // Calculer combien de jours le stock actuel peut couvrir
        const last30Days = new Date();
        last30Days.setDate(last30Days.getDate() - 30);
        
        const salesLast30Days = db.ventes
            .filter(sale => new Date(sale.date) >= last30Days)
            .flatMap(sale => sale.items)
            .filter(item => item.productId === product.id)
            .reduce((sum, item) => sum + item.quantity, 0);
        
        const dailyAverage = salesLast30Days / 30;
        
        if(dailyAverage <= 0) return 999; // Pas de vente récente
        
        return Math.floor(product.stock / dailyAverage);
    }
    
    getStockStatus(product) {
        if(product.stock === 0) return { text: 'Épuisé', color: 'red', icon: 'x-circle' };
        if(product.stock <= product.min) return { text: 'Critique', color: 'amber', icon: 'alert-triangle' };
        if(product.stock <= product.min * 2) return { text: 'Faible', color: 'orange', icon: 'alert-circle' };
        return { text: 'Bon', color: 'emerald', icon: 'check-circle' };
    }
    
    renderStockReport() {
        const report = this.generateStockReport();
        const container = document.getElementById('stock-report');
        
        if(!container) return;
        
        if(report.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-slate-400">
                    <i data-lucide="package" class="w-12 h-12 mx-auto mb-2 opacity-30"></i>
                    <p>Aucun produit en stock</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = report.map(item => {
            const status = item.statut;
            return `
                <div class="p-3 border-b hover:bg-slate-50">
                    <div class="flex justify-between items-center mb-1">
                        <div class="flex items-center gap-2">
                            <div class="w-6 h-6 rounded-full bg-${status.color}-100 text-${status.color}-600 flex items-center justify-center">
                                <i data-lucide="${status.icon}" class="w-3 h-3"></i>
                            </div>
                            <div class="font-medium">${item.produit}</div>
                        </div>
                        <div class="text-right">
                            <div class="font-bold">${item.stock} unités</div>
                            <div class="text-xs text-slate-500">${item.joursCouverture} jours</div>
                        </div>
                    </div>
                    <div class="flex justify-between text-xs text-slate-500">
                        <span>Valeur: ${formatMoney(item.valeur)}</span>
                        <span class="px-2 py-0.5 bg-${status.color}-100 text-${status.color}-600 rounded-full">
                            ${status.text}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
        
        setTimeout(() => lucide.createIcons(), 100);
    }
    
    // ===== RAPPORT PERSONNALISÉ =====
    generateCustomReport(type, startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        
        switch(type) {
            case 'ventes':
                return this.generateSalesReport(start, end);
            case 'depenses':
                return this.generateExpensesReport(start, end);
            case 'profit':
                return this.generateProfitReport(start, end);
            default:
                return null;
        }
    }
    
    generateSalesReport(start, end) {
        const filteredSales = db.ventes.filter(sale => {
            const saleDate = new Date(sale.date);
            return saleDate >= start && saleDate <= end;
        });
        
        const total = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
        const paidSales = filteredSales.filter(s => s.status === 'paid');
        const creditSales = filteredSales.filter(s => s.status === 'pending');
        
        return {
            type: 'Ventes',
            periode: `${start.toLocaleDateString('fr-FR')} au ${end.toLocaleDateString('fr-FR')}`,
            totalVentes: total,
            ventesPayees: paidSales.reduce((sum, s) => sum + s.total, 0),
            ventesCredit: creditSales.reduce((sum, s) => sum + s.total, 0),
            nombreVentes: filteredSales.length,
            nombreClients: new Set(filteredSales.map(s => s.clientName)).size,
            topProduit: this.getTopProduct(filteredSales)
        };
    }
    
    generateExpensesReport(start, end) {
        const filteredExpenses = db.depenses.filter(expense => {
            const expenseDate = new Date(expense.date);
            return expenseDate >= start && expenseDate <= end;
        });
        
        const byCategory = {};
        filteredExpenses.forEach(expense => {
            if(!byCategory[expense.category]) {
                byCategory[expense.category] = 0;
            }
            byCategory[expense.category] += expense.amount;
        });
        
        return {
            type: 'Dépenses',
            periode: `${start.toLocaleDateString('fr-FR')} au ${end.toLocaleDateString('fr-FR')}`,
            totalDepenses: filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
            parCategorie: byCategory,
            nombreDepenses: filteredExpenses.length,
            moyenneParJour: (filteredExpenses.reduce((sum, e) => sum + e.amount, 0) / 
                           Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)))).toFixed(0)
        };
    }
    
    generateProfitReport(start, end) {
        const salesReport = this.generateSalesReport(start, end);
        const expensesReport = this.generateExpensesReport(start, end);
        
        const profit = salesReport.ventesPayees - expensesReport.totalDepenses;
        const margin = salesReport.ventesPayees > 0 ? 
            (profit / salesReport.ventesPayees * 100) : 0;
        
        return {
            type: 'Profit',
            periode: `${start.toLocaleDateString('fr-FR')} au ${end.toLocaleDateString('fr-FR')}`,
            chiffreAffaires: salesReport.ventesPayees,
            totalDepenses: expensesReport.totalDepenses,
            profit: profit,
            marge: margin,
            ratioDepenses: salesReport.ventesPayees > 0 ? 
                (expensesReport.totalDepenses / salesReport.ventesPayees * 100).toFixed(1) + '%' : 'N/A'
        };
    }
    
    getTopProduct(sales) {
        const productSales = {};
        
        sales.forEach(sale => {
            sale.items.forEach(item => {
                if(!productSales[item.productId]) {
                    productSales[item.productId] = {
                        id: item.productId,
                        name: item.productName,
                        quantity: 0,
                        revenue: 0
                    };
                }
                productSales[item.productId].quantity += item.quantity;
                productSales[item.productId].revenue += item.total;
            });
        });
        
        const products = Object.values(productSales);
        if(products.length === 0) return null;
        
        return products.sort((a, b) => b.quantity - a.quantity)[0];
    }
    
    renderCustomReport(report) {
        const container = document.getElementById('custom-report-result');
        if(!container || !report) return;
        
        let html = '';
        
        switch(report.type) {
            case 'Ventes':
                html = `
                    <div class="bg-white rounded-xl border p-6">
                        <h5 class="font-bold text-lg mb-4">Rapport Ventes - ${report.periode}</h5>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div class="bg-blue-50 p-4 rounded-lg">
                                <div class="text-sm text-slate-500">Total Ventes</div>
                                <div class="text-2xl font-bold text-blue-600">${formatMoney(report.totalVentes)}</div>
                            </div>
                            <div class="bg-emerald-50 p-4 rounded-lg">
                                <div class="text-sm text-slate-500">Ventes Payées</div>
                                <div class="text-2xl font-bold text-emerald-600">${formatMoney(report.ventesPayees)}</div>
                            </div>
                            <div class="bg-amber-50 p-4 rounded-lg">
                                <div class="text-sm text-slate-500">En Crédit</div>
                                <div class="text-2xl font-bold text-amber-600">${formatMoney(report.ventesCredit)}</div>
                            </div>
                            <div class="bg-slate-50 p-4 rounded-lg">
                                <div class="text-sm text-slate-500">Nombre</div>
                                <div class="text-2xl font-bold text-slate-600">${report.nombreVentes}</div>
                            </div>
                        </div>
                        ${report.topProduit ? `
                            <div class="mt-6 p-4 bg-slate-50 rounded-lg">
                                <div class="text-sm text-slate-500">Produit le plus vendu</div>
                                <div class="font-bold">${report.topProduit.name}</div>
                                <div class="text-sm text-slate-500">
                                    ${report.topProduit.quantity} unités • ${formatMoney(report.topProduit.revenue)}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
                break;
                
            case 'Dépenses':
                html = `
                    <div class="bg-white rounded-xl border p-6">
                        <h5 class="font-bold text-lg mb-4">Rapport Dépenses - ${report.periode}</h5>
                        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div class="bg-amber-50 p-4 rounded-lg">
                                <div class="text-sm text-slate-500">Total Dépenses</div>
                                <div class="text-2xl font-bold text-amber-600">${formatMoney(report.totalDepenses)}</div>
                            </div>
                            <div class="bg-slate-50 p-4 rounded-lg">
                                <div class="text-sm text-slate-500">Nombre</div>
                                <div class="text-2xl font-bold text-slate-600">${report.nombreDepenses}</div>
                            </div>
                            <div class="bg-blue-50 p-4 rounded-lg">
                                <div class="text-sm text-slate-500">Moyenne/Jour</div>
                                <div class="text-2xl font-bold text-blue-600">${formatMoney(report.moyenneParJour)}</div>
                            </div>
                        </div>
                        ${Object.keys(report.parCategorie).length > 0 ? `
                            <div class="mt-6">
                                <div class="text-sm font-bold text-slate-700 mb-2">Par Catégorie</div>
                                <div class="space-y-2">
                                    ${Object.entries(report.parCategorie).map(([category, amount]) => `
                                        <div class="flex justify-between items-center p-2 border rounded">
                                            <span class="text-sm">${category}</span>
                                            <span class="font-bold text-amber-600">${formatMoney(amount)}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
                break;
                
            case 'Profit':
                html = `
                    <div class="bg-white rounded-xl border p-6">
                        <h5 class="font-bold text-lg mb-4">Rapport Profit - ${report.periode}</h5>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div class="bg-blue-50 p-4 rounded-lg">
                                <div class="text-sm text-slate-500">Chiffre d'Affaires</div>
                                <div class="text-2xl font-bold text-blue-600">${formatMoney(report.chiffreAffaires)}</div>
                            </div>
                            <div class="bg-amber-50 p-4 rounded-lg">
                                <div class="text-sm text-slate-500">Dépenses</div>
                                <div class="text-2xl font-bold text-amber-600">${formatMoney(report.totalDepenses)}</div>
                            </div>
                            <div class="bg-emerald-50 p-4 rounded-lg">
                                <div class="text-sm text-slate-500">Profit Net</div>
                                <div class="text-2xl font-bold ${report.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}">
                                    ${formatMoney(report.profit)}
                                </div>
                            </div>
                            <div class="bg-slate-50 p-4 rounded-lg">
                                <div class="text-sm text-slate-500">Marge</div>
                                <div class="text-2xl font-bold ${report.marge >= 20 ? 'text-emerald-600' : 'text-amber-600'}">
                                    ${report.marge.toFixed(1)}%
                                </div>
                            </div>
                        </div>
                        <div class="mt-6 p-4 bg-slate-50 rounded-lg">
                            <div class="text-sm text-slate-500">Ratio Dépenses/CA</div>
                            <div class="font-bold text-slate-700">${report.ratioDepenses}</div>
                        </div>
                    </div>
                `;
                break;
        }
        
        container.innerHTML = html;
    }
    
    // ===== EXPORT EXCEL SIMPLIFIÉ =====
    exportReportToExcel(reportType) {
        let data = [];
        let filename = '';
        
        switch(reportType) {
            case 'profitability':
                data = this.generateProfitabilityReport();
                filename = 'rentabilite_produits';
                break;
            case 'clients':
                data = this.generateTopClientsReport(50);
                filename = 'top_clients';
                break;
            case 'stock':
                data = this.generateStockReport();
                filename = 'analyse_stock';
                break;
            default:
                showToast("Type de rapport non supporté", "error");
                return;
        }
        
        if(data.length === 0) {
            showToast("Aucune donnée à exporter", "warning");
            return;
        }
        
        // Convertir en CSV
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(row => 
            Object.values(row).map(value => 
                `"${String(value).replace(/"/g, '""')}"`
            ).join(',')
        ).join('\n');
        
        const csv = headers + '\n' + rows;
        
        // Télécharger
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        addLog(`Export rapport: ${reportType}`, "success");
        showToast("Rapport exporté avec succès", "success");
    }
    
    // ===== INITIALISATION =====
    initReportsTab() {
        // Cette fonction est appelée quand on clique sur l'onglet Rapports
        this.renderProfitabilityReport();
        this.renderTopClientsReport();
        this.renderStockReport();
        
        // Configurer les boutons d'export
        document.querySelectorAll('[data-export]').forEach(button => {
            button.addEventListener('click', (e) => {
                const reportType = e.target.closest('[data-export]').getAttribute('data-export');
                this.exportReportToExcel(reportType);
            });
        });
        
        // Configurer le rapport personnalisé
        const customReportBtn = document.getElementById('generate-custom-report');
        if(customReportBtn) {
            customReportBtn.addEventListener('click', () => {
                const type = document.getElementById('report-type-select').value;
                const start = document.getElementById('report-start-date').value;
                const end = document.getElementById('report-end-date').value;
                
                if(!start || !end) {
                    showToast("Veuillez sélectionner une période", "error");
                    return;
                }
                
                const report = this.generateCustomReport(type, start, end);
                this.renderCustomReport(report);
            });
        }
    }
}

// Initialiser le système de rapports
let reportSystem = null;

function initReportSystem() {
    reportSystem = new ReportSystem();
}

// Exposer les fonctions utiles au scope global
window.renderReports = function() {
    if(reportSystem) {
        reportSystem.initReportsTab();
    }
};

window.generateCustomReport = function() {
    if(!reportSystem) return;
    
    const type = document.getElementById('report-type-select').value;
    const start = document.getElementById('report-start-date').value;
    const end = document.getElementById('report-end-date').value;
    
    if(!start || !end) {
        showToast("Veuillez sélectionner une période", "error");
        return;
    }
    
    const report = reportSystem.generateCustomReport(type, start, end);
    reportSystem.renderCustomReport(report);
};

window.exportReport = function(reportType) {
    if(reportSystem) {
        reportSystem.exportReportToExcel(reportType);
    }
};