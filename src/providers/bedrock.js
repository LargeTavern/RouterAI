const BaseProvider = require('./base');

class BedrockProvider extends BaseProvider {
    constructor(config) {
        super(config);
        this.region = config.region;
        this.accessKeyId = config.access_key_id;
        this.secretAccessKey = config.secret_access_key;
    }

    transformRequest(messages, options = {}) {
        // Using Claude format as example
        const prompt = messages.map(msg => 
            `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`
        ).join('\n\n');

        return {
            prompt,
            max_tokens_to_sample: options.max_tokens || 1000,
            temperature: options.temperature || 0.7,
            top_p: options.top_p || 0.95,
            top_k: options.top_k || 40
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
            id: `bedrock-${Date.now()}`,
            object: 'chat.completion',
            created: Date.now(),
            model: modelId,
            choices: [{
                message: {
                    role: 'assistant',
                    content: response.completion || response.generation
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
        const response = await this._makeRequest('/models', 'GET');
        return {
            data: response.models.map(model => ({
                id: model.modelId,
                object: 'model',
                created: Date.now(),
                owned_by: model.modelId.split('.')[0]
            }))
        };
    }

    async chatCompletion(messages, options = {}) {
        const modelId = options.model;
        const response = await this._makeRequest(
            `/model/${modelId}/invoke`,
            'POST',
            this.transformRequest(messages, options)
        );

        return this.transformResponse(response, modelId);
    }

    async textCompletion(prompt, options = {}) {
        return this.chatCompletion([{ role: 'user', content: prompt }], options);
    }

    async embeddings(input, options = {}) {
        const inputs = Array.isArray(input) ? input : [input];
        const embeddingsResults = [];
        const modelId = options.model;

        for (const text of inputs) {
            const response = await this._makeRequest(
                `/model/${modelId}/invoke`,
                'POST',
                { inputText: text }
            );

            if (response.embedding) {
                embeddingsResults.push(response.embedding);
            }
        }

        return {
            data: embeddingsResults.map((embedding, index) => ({
                object: 'embedding',
                embedding: embedding,
                index: index
            }))
        };
    }

    async _makeRequest(path, method, body = null) {
        // Implementation should use AWS Signature V4 signing process
        // This is a placeholder for the actual AWS request signing logic
        throw new Error('AWS request signing not implemented');
    }
}

module.exports = BedrockProvider;