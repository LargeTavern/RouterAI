const ADMIN_PASSWORD = localStorage.getItem('adminPassword') || prompt('Enter admin password:');
localStorage.setItem('adminPassword', ADMIN_PASSWORD);

async function fetchWithAuth(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'Content-Type': 'application/json',
            'Authorization': ADMIN_PASSWORD
        }
    });
    
    if (response.status === 401) {
        localStorage.removeItem('adminPassword');
        alert('Authentication failed. Please reload and try again.');
        location.reload();
    }
    return response;
}

// Toggle dark mode
function initializeDarkMode() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    prefersDark.addEventListener('change', e => {
        document.body.classList.toggle('dark-mode', e.matches);
    });
}

// Search functionality
function initializeSearch() {
    const searchInput = document.querySelector('.search-input');
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const connections = document.querySelectorAll('.connection-name');
        
        connections.forEach(connection => {
            const text = connection.textContent.toLowerCase();
            const connectionItem = connection.closest('.connection-item');
            connectionItem.style.display = text.includes(searchTerm) ? 'flex' : 'none';
        });
    });
}

// Delete confirmation
function initializeDeleteButtons() {
    const deleteButtons = document.querySelectorAll('.button-danger');
    deleteButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            if (confirm('Are you sure you want to delete this connection?')) {
                const connectionItem = e.target.closest('.connection-item');
                connectionItem.remove();
            }
        });
    });
}

function initializeKeyToggles() {
    document.querySelectorAll('.toggle-sensitive').forEach(button => {
        button.addEventListener('click', (e) => {
            const valueElement = e.target.nextElementSibling;
            const isHidden = valueElement.classList.toggle('show');
            e.target.textContent = isHidden ? 'Hide' : 'Show';
        });
    });
}

function initializeDragAndDrop() {
    const list = document.querySelector('.connections-list');
    let draggedItem = null;

    list.addEventListener('dragstart', (e) => {
        draggedItem = e.target.closest('.connection-item');
        draggedItem.classList.add('dragging');
    });

    list.addEventListener('dragend', (e) => {
        e.target.closest('.connection-item')?.classList.remove('dragging');
        draggedItem = null;
        saveOrder();
    });

    list.addEventListener('dragover', (e) => {
        e.preventDefault();
        const item = e.target.closest('.connection-item');
        if (!item || item === draggedItem) return;

        const box = item.getBoundingClientRect();
        const offset = e.clientY - box.top - box.height / 2;
        
        const next = offset > 0 ? item.nextElementSibling : item;
        if (next !== draggedItem) {
            list.insertBefore(draggedItem, offset > 0 ? item.nextElementSibling : item);
        }
    });
}

async function saveOrder() {
    const items = document.querySelectorAll('.connection-name');
    const urls = Array.from(items).map(item => item.textContent);
    
    try {
        // Update order first
        await fetchWithAuth('/admin/api/update-order', {
            method: 'POST',
            body: JSON.stringify({ urls })
        });

        // No need to call refresh-models separately as it's handled by the backend now
    } catch (error) {
        console.error('Failed to save order:', error);
    }
}

async function loadConnections() {
    const connectionsList = document.querySelector('.connections-list');
    connectionsList.innerHTML = '<div class="loading">Loading connections...</div>';

    try {
        const response = await fetchWithAuth('/admin/api/connections');
        const connections = await response.json();

        if (!Array.isArray(connections)) {
            throw new Error('Invalid response format');
        }

        connectionsList.innerHTML = connections.map(conn => `
            <div class="connection-item" draggable="true">
                <div class="connection-info">
                    <span class="connection-handle">::</span>
                    <span class="connection-name">${conn.url}</span>
                    <span class="connection-type">${conn.type}</span>
                    <div class="connection-details">
                        ${Object.entries(conn.config)
                            .filter(([key, value]) => value)
                            .map(([key, value]) => {
                                const isSensitive = key.includes('key') || key.includes('secret');
                                const displayKey = key === 'api_key' ? 'API Key' : 
                                    key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                                return `
                                    <div class="config-item">
                                        <span class="config-key">${displayKey}:</span>
                                        ${isSensitive ? `
                                            <div class="sensitive-value-container">
                                                <button class="toggle-sensitive">Show</button>
                                                <span class="config-value sensitive">${value}</span>
                                            </div>
                                        ` : `
                                            <span class="config-value">${value}</span>
                                        `}
                                    </div>
                                `;
                            }).join('')}
                    </div>
                </div>
                <div class="connection-actions">
                    <button class="button button-danger">DELETE</button>
                </div>
            </div>
        `).join('');

        initializeDeleteButtons();
        initializeKeyToggles();
    } catch (error) {
        connectionsList.innerHTML = '<div class="error">Failed to load connections</div>';
    }
}

// Initialize all functionality
document.addEventListener('DOMContentLoaded', () => {
    initializeDarkMode();
    initializeSearch();
    loadConnections().then(() => {
        initializeDragAndDrop();
    });
});