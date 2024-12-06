
const fs = require('fs');
const path = require('path');

function ensureDir(dirPath) {
    const parts = dirPath.split(path.sep);
    let currentPath = '';
    
    for (const part of parts) {
        currentPath = currentPath ? path.join(currentPath, part) : part;
        if (!fs.existsSync(currentPath)) {
            fs.mkdirSync(currentPath);
        }
    }
}

module.exports = ensureDir;