const BaseProvider = require('./base');
const logger = require('../utils/logger');

class OllamaProvider extends BaseProvider {
    constructor(config) {
        super(config);
        this.baseUrl = config.baseUrl;
    }

    transformRequest(messages, options = {}, type = 'chat') {
        if (type === 'chat') {
            const transformed = {
                model: options.model,
                messages: messages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                })),
                stream: false,
                ...(Object.keys(options).length > 0 && {
                    options: {
                        ...(options.temperature && { temperature: options.temperature }),
                        ...(options.top_k && { top_k: options.top_k }),
                        ...(options.top_p && { top_p: options.top_p }),
                        ...(options.max_tokens && { num_ctx: options.max_tokens }),
                        ...(options.frequency_penalty && { repeat_penalty: options.frequency_penalty }),
                        ...(options.stop && { stop: options.stop }),
                        ...(options.seed && { seed: options.seed })
                    }
                })
            };

            logger.log('transform-request', {
                original: { messages, options },
                transformed
            }, 'ollama');

            return transformed;
        } else if (type === 'completion') {
            const transformed = {
                model: options.model,
                prompt: messages,
                stream: false,
                ...(Object.keys(options).length > 0 && {
                    options: {
                        ...(options.temperature && { temperature: options.temperature }),
                        ...(options.top_k && { top_k: options.top_k }),
                        ...(options.top_p && { top_p: options.top_p }),
                        ...(options.max_tokens && { num_ctx: options.max_tokens }),
                        ...(options.frequency_penalty && { repeat_penalty: options.frequency_penalty }),
                        ...(options.stop && { stop: options.stop }),
                        ...(options.seed && { seed: options.seed })
                    }
                })
            };

            logger.log('transform-request', {
                original: { messages, options },
                transformed
            }, 'ollama');

            return transformed;
        } else if (type === 'embeddings') {
            const transformed = {
                model: options.model,
                prompt: messages
            };

            logger.log('transform-request', {
                original: { messages, options },
                transformed
            }, 'ollama');

            return transformed;
        }
    }

    transformResponse(response, modelId, type = 'chat') {
        let transformed;
        if (type === 'embeddings') {
            transformed = {
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
        } else if (type === 'completion') {
            transformed = {
                id: `ollama-${Date.now()}`,
                object: 'completion',
                created: Date.now(),
                model: modelId,
                choices: [{
                    text: response.response,
                    finish_reason: 'stop',
                    index: 0
                }]
            };
        } else {
            transformed = {
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

        logger.log('transform-response', {
            type,
            original: response,
            transformed
        }, 'ollama');

        return transformed;
    }

    async listModels() {
        logger.log('provider-request', { endpoint: 'tags' }, 'ollama');
        
        const response = await fetch(`${this.baseUrl}/api/tags`);
        
        if (!response.ok) {
            const error = await response.text();
            logger.log('provider-error', error, 'ollama');
            throw this.handleError(response);
        }

        const result = await response.json();
        logger.log('provider-response', result, 'ollama');

        return {
            data: result.models.map(model => ({
                id: model.name.split(':')[0],
                object: 'model',
                created: Date.now(),
                owned_by: 'ollama'
            }))
        };
    }

    async chatCompletion(messages, options = {}) {
        const requestData = this.transformRequest(messages, options);
        logger.log('provider-request', {
            endpoint: 'chat',
            body: requestData
        }, 'ollama');

        const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const error = await response.text();
            logger.log('provider-error', error, 'ollama');
            throw this.handleError(response);
        }

        const result = await response.json();
        logger.log('provider-response', result, 'ollama');
        return this.transformResponse(result, options.model);
    }

    async textCompletion(prompt, options = {}) {
        const requestData = this.transformRequest(prompt, options, 'completion');
        logger.log('provider-request', {
            endpoint: 'generate',
            body: requestData
        }, 'ollama');

        const response = await fetch(`${this.baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const error = await response.text();
            logger.log('provider-error', error, 'ollama');
            throw this.handleError(response);
        }

        const result = await response.json();
        logger.log('provider-response', result, 'ollama');
        return this.transformResponse(result, options.model, 'completion');
    }

    async embeddings(input, options = {}) {
        const inputs = Array.isArray(input) ? input : [input];
        const embeddingsResults = [];

        for (const text of inputs) {
            const requestData = this.transformRequest(text, options, 'embeddings');
            logger.log('provider-request', {
                endpoint: 'embeddings',
                body: requestData
            }, 'ollama');

            const response = await fetch(`${this.baseUrl}/api/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const error = await response.text();
                logger.log('provider-error', error, 'ollama');
                throw this.handleError(response);
            }

            const result = await response.json();
            logger.log('provider-response', result, 'ollama');
            embeddingsResults.push(result.embedding);
        }
        
        return this.transformResponse(embeddingsResults, options.model, 'embeddings');
    }
}

module.exports = OllamaProvider;
