import { fetchWithAuth } from './auth.js';

export async function saveOrder() {
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

export async function loadConnections() {
    try {
        const response = await fetchWithAuth('/admin/api/connections');
        const connections = await response.json();

        if (!Array.isArray(connections)) {
            throw new Error('Invalid response format');
        }

        return connections;
    } catch (error) {
        throw new Error('Failed to load connections');
    }
}