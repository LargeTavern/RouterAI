import { initializeDarkMode, initializeSearch, initializeDeleteButtons, initializeKeyToggles, renderConnections, initializeDragAndDrop } from './ui/ui.js';
import { loadConnections } from './utils/api.js';

async function initialize() {
    initializeDarkMode();
    initializeSearch();
    
    try {
        const connections = await loadConnections();
        if (!Array.isArray(connections)) {
            throw new Error('Invalid response format');
        }
        
        renderConnections(connections);
        initializeDeleteButtons();
        initializeKeyToggles();
        initializeDragAndDrop();
    } catch (error) {
        console.error('Initialization failed:', error);
    }
}

document.addEventListener('DOMContentLoaded', initialize);