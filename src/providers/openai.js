const BaseProvider = require('./base');
const logger = require('../utils/logger');

class OpenAIProvider extends BaseProvider {
    constructor(config) {
        super(config);
        this.apiKey = config.api_key;
    }

    async listModels() {
        logger.log('provider-request', { endpoint: 'models' }, 'openai');
        
        const response = await fetch(`${this.baseUrl}/v1/models`, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`
            }
        });
        
        if (!response.ok) {
            const error = await response.text();
            logger.log('provider-error', error, 'openai');
            throw this.handleError(response);
        }
        
        const result = await response.json();
        logger.log('provider-response', result, 'openai');
        return result;
    }

    async chatCompletion(messages, options = {}) {
        const requestData = { messages, ...options };
        logger.log('provider-request', {
            endpoint: 'chat/completions',
            body: requestData
        }, 'openai');

        const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const error = await response.text();
            logger.log('provider-error', error, 'openai');
            throw this.handleError(response);
        }

        if (options.stream) {
            logger.log('provider-stream-start', {
                status: response.status
            }, 'openai');
            return response;
        }

        const result = await response.json();
        logger.log('provider-response', result, 'openai');
        return result;
    }

    async textCompletion(prompt, options = {}) {
        const requestData = {
            prompt,
            model: options.model || 'text-davinci-003',
            ...options
        };
        logger.log('provider-request', {
            endpoint: 'completions',
            body: requestData
        }, 'openai');

        const response = await fetch(`${this.baseUrl}/v1/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const error = await response.text();
            logger.log('provider-error', error, 'openai');
            throw this.handleError(response);
        }

        if (options.stream) {
            logger.log('provider-stream-start', {
                status: response.status
            }, 'openai');
            return response;
        }

        const result = await response.json();
        logger.log('provider-response', result, 'openai');
        return result;
    }

    async embeddings(input, options = {}) {
        const requestData = {
            input,
            model: options.model || 'text-embedding-ada-002',
            ...options
        };
        logger.log('provider-request', {
            endpoint: 'embeddings',
            body: requestData
        }, 'openai');

        const response = await fetch(`${this.baseUrl}/v1/embeddings`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const error = await response.text();
            logger.log('provider-error', error, 'openai');
            throw this.handleError(response);
        }

        const result = await response.json();
        logger.log('provider-response', result, 'openai');
        return result;
    }
}

module.exports = OpenAIProvider;
