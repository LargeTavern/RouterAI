import { saveOrder, loadConnections } from '../utils/api.js';

// Toggle dark mode
export function initializeDarkMode() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
    prefersDark.addEventListener('change', e => {
        document.body.classList.toggle('dark-mode', e.matches);
    });
}

// Search functionality
export function initializeSearch() {
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
export function initializeDeleteButtons() {
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

export function initializeKeyToggles() {
    document.querySelectorAll('.toggle-sensitive').forEach(button => {
        button.addEventListener('click', (e) => {
            const valueElement = e.target.nextElementSibling;
            const isHidden = valueElement.classList.toggle('show');
            e.target.textContent = isHidden ? 'Hide' : 'Show';
        });
    });
}

export function initializeDragAndDrop() {
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

export async function renderConnections() {
    const connectionsList = document.querySelector('.connections-list');
    connectionsList.innerHTML = '<div class="loading">Loading connections...</div>';

    try {
        const connections = await loadConnections();
        
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
                                const displayKey = key === 'api_keys' ? 'API Keys' : 
                                    key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                                
                                if (Array.isArray(value) && isSensitive) {
                                    return `
                                        <div class="config-item">
                                            <span class="config-key">${displayKey}:</span>
                                            ${value.map((item, index) => `
                                                <div class="sensitive-value-container">
                                                    <button class="toggle-sensitive">Show</button>
                                                    <span class="config-value sensitive">${item}</span>
                                                </div>
                                            `).join('')}
                                        </div>
                                    `;
                                }
                                
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

