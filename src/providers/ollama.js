const BaseProvider = require('./base');

class OllamaProvider extends BaseProvider {
    constructor(config) {
        super(config);
        this.baseUrl = config.baseUrl;
    }

    transformRequest(messages, options = {}) {
        return {
            model: options.model,
            messages: messages.map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            stream: false,
            options: {
                temperature: options.temperature || 0.7,
                top_k: options.top_k || 40,
                top_p: options.top_p || 0.95,
                num_ctx: options.max_tokens || 1000
            }
        };
    }

    transformResponse(response, modelId, type = 'chat') {
        if (type === 'embeddings') {
            return {
                object: 'list',
                data: Array.isArray(response) ? response.map((embedding, i) => ({
                    object: 'embedding',
                    embedding: embedding,
                    index: i
                })) : [{
                    object: 'embedding',
                    embedding: response.embedding,
                    index: 0
                }],
                model: modelId
            };
        }

        return {
            id: `ollama-${Date.now()}`,
            object: 'chat.completion',
            created: Date.now(),
            model: modelId,
            choices: [{
                message: {
                    role: 'assistant',
                    content: response.message.content
                },
                finish_reason: 'stop',
                index: 0
            }],
            usage: {
                prompt_tokens: -1,
                completion_tokens: -1,
                total_tokens: -1
            }
        };
    }

    async listModels() {
        const response = await fetch(`${this.baseUrl}/api/tags`);
        
        if (!response.ok) {
            throw this.handleError(response);
        }

        const { models } = await response.json();

        return {
            data: models.map(model => ({
                id: model.name.split(':')[0],
                object: 'model',
                created: Date.now(),
                owned_by: 'ollama'
            }))
        };
    }

    async chatCompletion(messages, options = {}) {
        const endpoint = `${this.baseUrl}/api/chat`;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.transformRequest(messages, options))
        });

        if (!response.ok) {
            throw this.handleError(response);
        }

        const result = await response.json();
        return this.transformResponse(result, options.model);
    }

    async textCompletion(prompt, options = {}) {
        const endpoint = `${this.baseUrl}/api/generate`;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: options.model,
                prompt: prompt,
                stream: false,
                options: {
                    temperature: options.temperature || undefined,
                    top_k: options.top_k || undefined,
                    top_p: options.top_p || undefined,
                    num_ctx: options.max_tokens || undefined
                }
            })
        });

        if (!response.ok) {
            throw this.handleError(response);
        }

        const result = await response.json();
        return {
            id: `ollama-${Date.now()}`,
            object: 'completion',
            created: Date.now(),
            model: options.model,
            choices: [{
                text: result.response,
                finish_reason: 'stop',
                index: 0
            }]
        };
    }

    async embeddings(input, options = {}) {
        const inputs = Array.isArray(input) ? input : [input];
        const embeddingsResults = [];

        for (const text of inputs) {
            const endpoint = `${this.baseUrl}/api/embeddings`;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: options.model,
                    prompt: text
                })
            });

            if (!response.ok) {
                throw this.handleError(response);
            }

            const result = await response.json();
            embeddingsResults.push(result.embedding);
        }
        
        return this.transformResponse(embeddingsResults, options.model, 'embeddings');
    }
}

module.exports = OllamaProvider;
