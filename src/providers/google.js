const BaseProvider = require('./base');

class GoogleAIProvider extends BaseProvider {
    constructor(config) {
        super(config);
        this.baseUrl = config.baseUrl;
        this.apiKey = config.api_key;
    }

    transformRequest(messages, options = {}) {
        return {
            contents: messages.map(msg => ({
                role: msg.role,
                parts: [{ text: msg.content }]
            })),
            generationConfig: {
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
                data: response.embeddings ? 
                    response.embeddings.map((emb, i) => ({
                        object: 'embedding',
                        embedding: emb.values,
                        index: i
                    })) :
                    [{
                        object: 'embedding',
                        embedding: response.embedding.values,
                        index: 0
                    }],
                model: modelId,
                usage: {
                    prompt_tokens: -1,
                    total_tokens: -1
                }
            };
        }

        return {
            id: `gemini-${Date.now()}`,
            object: 'chat.completion',
            created: Date.now(),
            model: modelId,
            choices: [{
                message: {
                    role: 'assistant',
                    content: response.candidates[0].content.parts[0].text
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
                    id: 'gemini-1.5-flash',
                    object: 'model',
                    created: 1699625820,
                    owned_by: 'google'
                },
                {
                    id: 'text-embedding-004',
                    object: 'model',
                    created: 1704067200,
                    owned_by: 'google'
                }
            ]
        };
    }

    async chatCompletion(messages, options = {}) {
        const modelId = options.model;
        const endpoint = `${this.baseUrl}/v1beta/models/${modelId}:generateContent?key=${this.apiKey}`;
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(this.transformRequest(messages, options))
        });

        console.log(response);

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
        const modelId = options.model;
        const endpoint = `${this.baseUrl}/v1beta/models/${modelId}:embedContent?key=${this.apiKey}`;
        
        const inputs = Array.isArray(input) ? input : [input];
        const results = [];

        for (const text of inputs) {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: { parts: [{ text }] }
                })
            });

            if (!response.ok) {
                throw this.handleError(response);
            }

            const result = await response.json();
            results.push(result.embedding);
        }

        return this.transformResponse({ embeddings: results }, modelId, 'embeddings');
    }
}

module.exports = GoogleAIProvider;
