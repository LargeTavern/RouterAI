const express = require('express');
const path = require('path');
const router = express.Router();
const fs = require('fs').promises;
const configPath = path.join(__dirname, '../config.json');

// Basic authentication middleware
const adminAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminPassword) {
        return res.status(500).json({ error: 'Server authentication not configured' });
    }

    if (authHeader === adminPassword) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// Serve static files only after authentication
router.use(adminAuth, express.static(path.join(__dirname, 'admin_panel')));

// Admin API routes
router.get('/api/connections', adminAuth, (req, res) => {
    try {
        const config = require('../config.json');
        const connections = Object.entries(config).map(([url, details]) => {
            const { type, ...rest } = details;
            return {
                url,
                type,
                config: rest
            };
        });
        res.json(connections);
    } catch (error) {
        res.status(500).json({ error: { message: 'Failed to load connections' } });
    }
});

router.post('/api/test-connection', adminAuth, async (req, res) => {
    const { url } = req.body;
    try {
        // Implement actual connection testing logic here
        res.json({ status: 'success' });
    } catch (error) {
        res.status(500).json({ error: { message: 'Connection test failed' } });
    }
});

router.post('/refresh-models', adminAuth, async (req, res) => {
    try {
        await router.refreshModels();
        res.json({
            success: true,
            models: router.getAvailableModels()
        });
    } catch (error) {
        res.status(500).json({
            error: {
                message: error.message,
                type: "internal_server_error"
            }
        });
    }
});

router.post('/api/update-order', adminAuth, async (req, res) => {
    try {
        const { urls } = req.body;
        const config = require('../config.json');
        
        // Create new ordered config
        const newConfig = {};
        urls.forEach(url => {
            if (config[url]) {
                newConfig[url] = config[url];
            }
        });

        // Save to file
        await fs.writeFile(configPath, JSON.stringify(newConfig, null, 4));
        
        // Clear require cache to reload config
        delete require.cache[configPath];
        
        // Trigger config reload
        await fetch('http://localhost:' + process.env.PORT + '/api/reload-config', {
            method: 'POST'
        });
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: { message: 'Failed to update config' } });
    }
});

module.exports = router;
