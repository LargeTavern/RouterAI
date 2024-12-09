const fs = require('fs');
const path = require('path');
const ensureDir = require('./ensureDir');

class Logger {
    constructor() {
        this.disabled = process.env.LOGGING === 'false';
        if (this.disabled) {
            return;
        }

        this.logDir = path.join(__dirname, '../../logs');
        ensureDir(this.logDir);
        
        this.currentDay = new Date().toISOString().split('T')[0];
        this.openStream();
        
        setInterval(() => this.checkDayChange(), 60000);
        
        process.on('beforeExit', () => this.stream?.end());
    }

    openStream() {
        if (this.stream) {
            this.stream.end();
        }
        
        const logPath = path.join(this.logDir, `routerai-${this.currentDay}.log`);
        this.stream = fs.createWriteStream(logPath, { flags: 'a' });
    }

    checkDayChange() {
        const newDay = new Date().toISOString().split('T')[0];
        if (newDay !== this.currentDay) {
            this.currentDay = newDay;
            this.openStream();
        }
    }

    formatTimestamp(date) {
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}.${date.getMilliseconds().toString().padStart(3, '0')}`;
    }

    log(type, data, provider = 'system') {
        if (this.disabled) return;
        
        const now = new Date();
        const timestamp = this.formatTimestamp(now);
        const logMessage = `[${timestamp} | ${provider} | ${type}] ${JSON.stringify(data)}\n`;
        
        this.stream.write(logMessage);
    }
}

module.exports = new Logger();