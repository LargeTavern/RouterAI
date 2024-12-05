const BaseProvider = require('./base');

class AzureProvider extends BaseProvider {
    constructor(config) {
        super(config);
        this.apiKey = config.api_key;
        this.deploymentName = config.deployment_name;
        this.apiVersion = config.api_version;
    }

    transformRequest(messages, options) {
        return {
            messages,
            temperature: options.temperature  || 0.7,
            max_tokens: options.max_tokens  || 1000,
            stream: options.stream || false
        };
    }

    transformResponse(response, type = 'chat') {
        if (type === 'embeddings') {
            return {
                object: 'list',
                data: response.data.map((item, index) => ({
                    object: 'embedding',
                    embedding: item.embedding,
                    index: index
                })),
                model: this.deploymentName
            };
        }

        return {
            id: `azure-${Date.now()}`,
            object: 'chat.completion',
            created: Date.now(),
            model: this.deploymentName,
            choices: response.choices.map(choice => ({
                message: choice.message,
                finish_reason: choice.finish_reason,
                index: choice.index
            })),
            usage: response.usage
        };
    }

    async listModels() {
        const response = await fetch(`${this.baseUrl}/openai/deployments?api-version=${this.apiVersion}`, {
            headers: {
                'api-key': this.apiKey
            }
        });

        if (!response.ok) {
            throw this.handleError(response);
        }

        const data = await response.json();
        return {
            data: data.value.map(deployment => ({
                id: deployment.id,
                object: 'model',
                created: new Date(deployment.properties.createdOn).getTime(),
                owned_by: 'azure'
            }))
        };
    }

    async chatCompletion(messages, options = {}) {
        const endpoint = `${this.baseUrl}/openai/deployments/${this.deploymentName}/chat/completions?api-version=${this.apiVersion}`;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'api-key': this.apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(this.transformRequest(messages, options))
        });

        if (!response.ok) {
            throw this.handleError(response);
        }

        const rawResponse = await response.json();
        return this.transformResponse(rawResponse);
    }

    async textCompletion(prompt, options = {}) {
        const response = await fetch(`${this.baseUrl}/openai/deployments/${this.deploymentName}/completions?api-version=${this.apiVersion}`, {
            method: 'POST',
            headers: {
                'api-key': this.apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt, ...options })
        });

        if (!response.ok) {
            throw this.handleError(response);
        }

        return await response.json();
    }

    async embeddings(input, options = {}) {
        const response = await fetch(`${this.baseUrl}/openai/deployments/${this.deploymentName}/embeddings?api-version=${this.apiVersion}`, {
            method: 'POST',
            headers: {
                'api-key': this.apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ input, ...options })
        });

        if (!response.ok) {
            throw this.handleError(response);
        }

        const result = await response.json();
        return this.transformResponse(result, 'embeddings');
    }
}

module.exports = AzureProvider;
