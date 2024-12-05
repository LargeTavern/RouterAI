const BaseProvider = require('./base');

class OpenAIProvider extends BaseProvider {
    constructor(config) {
        super(config);
        this.apiKey = config.api_key;
    }

    async listModels() {
        const response = await fetch(`${this.baseUrl}/v1/models`, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`
            }
        });
        
        if (!response.ok) {
            throw this.handleError(response);
        }
        
        return await response.json();
    }

    async chatCompletion(messages, options = {}) {
        const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ messages, ...options })
        });

        if (!response.ok) {
            throw this.handleError(response);
        }

        if (options.stream) {
            return response;
        }

        return await response.json();
    }

    async textCompletion(prompt, options = {}) {
        const response = await fetch(`${this.baseUrl}/v1/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt,
                model: options.model || 'text-davinci-003',
                ...options
            })
        });

        if (!response.ok) {
            throw this.handleError(response);
        }

        if (options.stream) {
            return response;
        }

        return await response.json();
    }

    async embeddings(input, options = {}) {
        const response = await fetch(`${this.baseUrl}/v1/embeddings`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                input,
                model: options.model || 'text-embedding-ada-002',
                ...options
            })
        });

        if (!response.ok) {
            throw this.handleError(response);
        }

        return await response.json();
    }
}

module.exports = OpenAIProvider;
