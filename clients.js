// === CLIENT MANAGEMENT ===

// Helper function pour échapper le HTML (si non défini dans app.js)
function escapeHtml(text) {
    if(!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Test global pour vérifier si la fonction est accessible
window.showAddClientModal = function() {
    const modal = document.getElementById('client-modal');
    const title = document.getElementById('client-modal-title');
    
    if(!modal) {
        return;
    }
    
    title.innerText = 'Ajouter un client';
    document.getElementById('client-id').value = '';
    document.getElementById('form-client').reset();
    
    // Retirer la classe hidden ET afficher le modal
    modal.classList.remove('hidden');
    modal.style.display = 'block';
    
    // Initialiser les icônes après un court délai
    setTimeout(() => {
        initLucide();
    }, 10);
};

// Render clients list
function renderClients() {
    // S'assurer que la collection clients existe
    if(!db.clients) {
        db.clients = [];
    }
    
    const clientsList = document.getElementById('clients-list');
    const noClientsMessage = document.getElementById('no-clients-message');
    
    if(!clientsList) {
        return;
    }
    
    if(db.clients.length === 0) {
        clientsList.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-8 text-slate-400">
                    <i data-lucide="users" class="w-12 h-12 mx-auto mb-2 opacity-30"></i>
                    <p class="text-sm">Aucun client enregistré</p>
                    <p class="text-xs mt-1">Cliquez sur "Ajouter un client" pour commencer</p>
                </td>
            </tr>
        `;
        if(noClientsMessage) noClientsMessage.classList.add('hidden');
        initLucide();
        return;
    }
    
    // Cacher le message "aucun client" car il y en a
    if(noClientsMessage) noClientsMessage.classList.add('hidden');
    
    clientsList.innerHTML = db.clients.map(client => `
        <tr class="border-b border-slate-100 hover:bg-slate-50">
            <td class="py-3 px-2">
                <div class="font-medium text-slate-800">${escapeHtml(client.name)}</div>
            </td>
            <td class="py-3 px-2 text-slate-600">${escapeHtml(client.phone || '-')}</td>
            <td class="py-3 px-2 text-slate-600">${escapeHtml(client.nif || '-')}</td>
            <td class="py-3 px-2 text-slate-600">${escapeHtml(client.stat || '-')}</td>
            <td class="py-3 px-2 text-slate-600 text-sm">${escapeHtml(client.address || '-')}</td>
            <td class="py-3 px-2">
                <div class="flex gap-1">
                    <button onclick="editClient('${client.id}')" class="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Modifier">
                        <i data-lucide="edit" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteClient('${client.id}')" class="p-1 text-red-600 hover:bg-red-50 rounded" title="Supprimer">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    initLucide();
}

// Filter clients
function filterClients(searchTerm) {
    const clientsList = document.getElementById('clients-list');
    const noClientsMessage = document.getElementById('no-clients-message');
    
    if(!clientsList) return;
    
    const filteredClients = db.clients.filter(client => 
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (client.phone && client.phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (client.nif && client.nif.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (client.address && client.address.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    
    if(filteredClients.length === 0) {
        clientsList.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-8 text-slate-400">
                    <i data-lucide="search" class="w-12 h-12 mx-auto mb-2 opacity-30"></i>
                    <p class="text-sm">Aucun client trouvé</p>
                    <p class="text-xs mt-1">Essayez avec d'autres critères de recherche</p>
                </td>
            </tr>
        `;
        if(noClientsMessage) noClientsMessage.classList.add('hidden');
        initLucide();
        return;
    }
    
    if(noClientsMessage) noClientsMessage.classList.add('hidden');
    
    clientsList.innerHTML = filteredClients.map(client => `
        <tr class="border-b border-slate-100 hover:bg-slate-50">
            <td class="py-3 px-2">
                <div class="font-medium text-slate-800">${escapeHtml(client.name)}</div>
            </td>
            <td class="py-3 px-2 text-slate-600">${escapeHtml(client.phone || '-')}</td>
            <td class="py-3 px-2 text-slate-600">${escapeHtml(client.nif || '-')}</td>
            <td class="py-3 px-2 text-slate-600">${escapeHtml(client.stat || '-')}</td>
            <td class="py-3 px-2 text-slate-600 text-sm">${escapeHtml(client.address || '-')}</td>
            <td class="py-3 px-2">
                <div class="flex gap-1">
                    <button onclick="editClient('${client.id}')" class="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Modifier">
                        <i data-lucide="edit" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteClient('${client.id}')" class="p-1 text-red-600 hover:bg-red-50 rounded" title="Supprimer">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    initLucide();
}


// Edit client
function editClient(clientId) {
    const client = db.clients.find(c => c.id === clientId);
    if(!client) return;
    
    document.getElementById('client-modal-title').innerText = 'Modifier le client';
    document.getElementById('client-id').value = client.id;
    document.getElementById('client-modal-name').value = client.name || '';
    document.getElementById('client-modal-phone').value = client.phone || '';
    document.getElementById('client-modal-nif').value = client.nif || '';
    document.getElementById('client-modal-stat').value = client.stat || '';
    document.getElementById('client-modal-address').value = client.address || '';
    document.getElementById('client-modal-postal').value = client.postalCode || '';
    document.getElementById('client-modal-email').value = client.email || '';
    
    const modal = document.getElementById('client-modal');
    
    // Retirer la classe hidden ET afficher le modal
    modal.classList.remove('hidden');
    modal.style.display = 'block';
    
    // Initialiser les icônes après un court délai
    setTimeout(() => {
        initLucide();
    }, 10);
}

// Delete client
function deleteClient(clientId) {
    const client = db.clients.find(c => c.id === clientId);
    if(!client) return;
    
    showConfirm(
        "Supprimer le client",
        `Supprimer le client ${client.name} ?`,
        "Supprimer",
        "error",
        () => {
            db.clients = db.clients.filter(c => c.id !== clientId);
            addLog(`Client supprimé: ${client.name}`, "warning");
            saveDB();
            updateUI();
            showToast("Client supprimé", "success");
        }
    );
}

// Close client modal
function closeClientModal() {
    const modal = document.getElementById('client-modal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
}

// Select client in sale form
function selectClient(clientId) {
    const clientNameInput = document.getElementById('client-name');
    const clientPhoneInput = document.getElementById('client-phone');
    
    if(clientId === 'new') {
        // Clear fields for new client
        clientNameInput.value = '';
        clientPhoneInput.value = '';
        clientNameInput.focus();
    } else if(clientId === '') {
        // No client selected - clear fields
        clientNameInput.value = '';
        clientPhoneInput.value = '';
    } else {
        // Client selected from database - fill fields
        const client = db.clients.find(c => c.id === clientId);
        if(client) {
            clientNameInput.value = client.name || '';
            clientPhoneInput.value = client.phone || '';
        }
    }
}

// Handle client form submission
document.getElementById('form-client')?.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const clientId = document.getElementById('client-id').value;
    const clientData = {
        name: document.getElementById('client-modal-name').value.trim(),
        phone: document.getElementById('client-modal-phone').value.trim(),
        nif: document.getElementById('client-modal-nif').value.trim(),
        stat: document.getElementById('client-modal-stat').value.trim(),
        address: document.getElementById('client-modal-address').value.trim(),
        postalCode: document.getElementById('client-modal-postal').value.trim(),
        email: document.getElementById('client-modal-email').value.trim()
    };
    
    if(!clientData.name) {
        showToast("Le nom du client est obligatoire", "error");
        return;
    }
    
    if(clientId) {
        // Update existing client
        const clientIndex = db.clients.findIndex(c => c.id === clientId);
        if(clientIndex !== -1) {
            db.clients[clientIndex] = { ...db.clients[clientIndex], ...clientData };
            addLog(`Client modifié: ${clientData.name}`, "info");
            showToast("Client modifié", "success");
        }
    } else {
        // Add new client
        const newClient = {
            id: 'client_' + Date.now(),
            ...clientData,
            createdAt: new Date().toISOString()
        };
        db.clients.unshift(newClient);
        addLog(`Client ajouté: ${clientData.name}`, "success");
        showToast("Client ajouté", "success");
    }
    
    saveDB();
    updateUI();
    closeClientModal();
});
