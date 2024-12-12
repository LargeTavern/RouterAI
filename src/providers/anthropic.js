const BaseProvider = require('./base');

class AnthropicProvider extends BaseProvider {
    constructor(config) {
        super(config);
        this.apiKey = config.api_key; // Will receive rotated key from router
        this.apiVersion = config.api_version;
    }

    transformRequest(messages) {
        return {
            prompt: messages.map(msg => 
                `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`
            ).join('\n\n')
        };
    }

    transformResponse(response, modelId) {
        return {
            id: `claude-${Date.now()}`,
            object: 'chat.completion',
            created: Date.now(),
            model: modelId,
            choices: [{
                message: {
                    role: 'assistant',
                    content: response.completion
                },
                finish_reason: response.stop_reason,
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
                    id: 'claude-2',
                    object: 'model',
                    owned_by: 'anthropic'
                },
                {
                    id: 'claude-2.1',
                    object: 'model',
                    owned_by: 'anthropic'
                },
                {
                    id: 'claude-instant-1.2',
                    object: 'model',
                    owned_by: 'anthropic'
                }
            ]
        };
    }

    async chatCompletion(messages, options = {}) {
        const modelId = options.model;
        const response = await fetch(`${this.baseUrl}/v1/complete`, {
            method: 'POST',
            headers: {
                'x-api-key': this.apiKey,
                'Content-Type': 'application/json',
                'anthropic-version': this.apiVersion
            },
            body: JSON.stringify({
                ...this.transformRequest(messages),
                model: modelId,
                max_tokens_to_sample: options.max_tokens || undefined,
                temperature: options.temperature || undefined
            })
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
        throw new Error('Embeddings are not supported by Anthropic Claude API');
    }
}

module.exports = AnthropicProvider;
