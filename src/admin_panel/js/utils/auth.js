const ADMIN_PASSWORD = localStorage.getItem('adminPassword') || prompt('Enter admin password:');
localStorage.setItem('adminPassword', ADMIN_PASSWORD);

export async function fetchWithAuth(url, options = {}) {
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