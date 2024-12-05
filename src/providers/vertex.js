const BaseProvider = require('./base');

class VertexProvider extends BaseProvider {
    constructor(config) {
        super(config);
        this.projectId = config.project_id;
        this.location = config.location;
    }

    transformRequest(messages, options = {}) {
        return {
            instances: [{
                context: "",
                examples: [],
                messages: messages.map(msg => ({
                    author: msg.role === 'user' ? 'user' : 'assistant',
                    content: msg.content
                }))
            }],
            parameters: {
                temperature: options.temperature || 0.7,
                maxOutputTokens: options.max_tokens || 1000,
                topK: options.top_k || 40,
                topP: options.top_p || 0.95,
            }
        };
    }

    transformResponse(response, modelId, type = 'chat') {
        if (type === 'embeddings') {
            return {
                object: 'list',
                data: response.predictions.map((pred, i) => ({
                    object: 'embedding',
                    embedding: pred.embeddings.values,
                    index: i
                })),
                model: modelId
            };
        }

        const prediction = response.predictions[0];
        return {
            id: `vertex-${Date.now()}`,
            object: 'chat.completion',
            created: Date.now(),
            model: modelId,
            choices: [{
                message: {
                    role: 'assistant',
                    content: prediction.candidates[0].content
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
        return {
            data: [
                {
                    id: 'chat-bison',
                    object: 'model',
                    created: 1683758123,
                    owned_by: 'google'
                },
                {
                    id: 'chat-bison-32k',
                    object: 'model',
                    created: 1683758123,
                    owned_by: 'google'
                },
                {
                    id: 'text-bison',
                    object: 'model',
                    created: 1683758123,
                    owned_by: 'google'
                },
                {
                    id: 'textembedding-gecko',
                    object: 'model',
                    created: 1683758123,
                    owned_by: 'google'
                }
            ]
        };
    }

    async chatCompletion(messages, options = {}) {
        const modelId = options.model;
        const endpoint = `${this.baseUrl}/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${modelId}:predict`;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await this._getAccessToken()}`
            },
            body: JSON.stringify(this.transformRequest(messages, options))
        });

        if (!response.ok) {
            throw this.handleError(response);
        }

        const rawResponse = await response.json();
        return this.transformResponse(rawResponse, modelId);
    }

    async textCompletion(prompt, options = {}) {
        return this.chatCompletion([{ role: 'user', content: prompt }], options);
    }

    async embeddings(input, options = {}) {
        const modelId = options.model || 'textembedding-gecko';
        const endpoint = `${this.baseUrl}/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${modelId}:predict`;
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await this._getAccessToken()}`
            },
            body: JSON.stringify({
                instances: Array.isArray(input) ? input : [input]
            })
        });

        if (!response.ok) {
            throw this.handleError(response);
        }

        const result = await response.json();
        return this.transformResponse(result, modelId, 'embeddings');
    }

    async _getAccessToken() {
        // Implementation depends on your authentication method
        // Could use Google Cloud SDK, service account, or other methods
        throw new Error('Authentication method not implemented');
    }
}

module.exports = VertexProvider;