const fs = require('fs');
const path = require('path');
const { getBaseModel } = require('./modelAliases');

class AIRouter {
    constructor() {
        this.providers = new Map();
        this.modelToSource = new Map();
        try {
            this.config = JSON.parse(fs.readFileSync(path.join(__dirname, '../config.json'), 'utf8'));
        } catch (error) {
            console.error('Failed to load config.json:', error);
            this.config = {};
        }
        this.refreshModels();
        this.rateLimits = new Map();
        this.retryDelays = new Map();
    }

    async refreshModels() {
        this.modelToSource.clear();
        
        for (const [baseUrl, source] of Object.entries(this.config)) {
            const providerKey = `${source.type}-${baseUrl}`;
            
            try {
                if (!this.providers.has(providerKey)) {
                    const Provider = require(`./providers/${source.type}`);
                    this.providers.set(providerKey, new Provider({
                        ...source,
                        baseUrl
                    }));
                }

                const provider = this.providers.get(providerKey);
                const models = await provider.listModels();
                
                for (const model of models.data) {
                    const baseModel = getBaseModel(model.id);
                    if (!this.modelToSource.has(baseModel)) {
                        this.modelToSource.set(baseModel, {
                            sources: [],
                            modelData: model
                        });
                    }
                    this.modelToSource.get(baseModel).sources.push({
                        baseUrl,
                        model: model.id,
                        config: source
                    });
                }
            } catch (error) {
                console.error(`Failed to fetch models from ${baseUrl}:`, error);
            }
        }
    }

    isRateLimited(providerKey) {
        const retryAfter = this.retryDelays.get(providerKey);
        if (!retryAfter) return false;
        return Date.now() < retryAfter;
    }

    markRateLimited(providerKey, retryAfter) {

        const retryTime = typeof retryAfter === 'number' 
            ? Date.now() + (retryAfter * 1000)
            : new Date(retryAfter).getTime();
        this.retryDelays.set(providerKey, retryTime);
        
        setTimeout(() => {
            this.retryDelays.delete(providerKey);
        }, retryTime - Date.now());
    }

    async route(endpoint, params) {
        const { model } = params;
        const baseModel = getBaseModel(model);
        const modelData = this.modelToSource.get(baseModel);
        
        if (!modelData || modelData.sources.length === 0) {
            throw new Error(`Model ${model} not supported`);
        }

        const configOrder = Object.keys(this.config);
        const sources = modelData.sources.sort((a, b) => 
            configOrder.indexOf(a.baseUrl) - configOrder.indexOf(b.baseUrl)
        );

        let lastError;
        let isStreaming = params.stream === true;

        for (const selected of sources) {
            const providerKey = `${selected.config.type}-${selected.baseUrl}`;

            if (this.isRateLimited(providerKey)) {
                continue;
            }

            try {
                if (!this.providers.has(providerKey)) {
                    const Provider = require(`./providers/${selected.config.type}`);
                    this.providers.set(providerKey, new Provider({
                        ...selected.config,
                        baseUrl: selected.baseUrl
                    }));
                }

                const provider = this.providers.get(providerKey);
                const result = await this.callEndpoint(endpoint, provider, params, selected.model);
                
                if (isStreaming && !result.body) {
                    throw new Error('Provider does not support streaming');
                }
                
                return result;

            } catch (error) {
                lastError = error;
                if (this.isRateLimitError(error)) {
                    const retryAfter = this.extractRetryAfter(error);
                    this.markRateLimited(providerKey, retryAfter);
                    continue;
                }
                if (this.shouldTryNextProvider(error)) {
                    continue;
                }
                throw error;
            }
        }

        throw lastError || new Error('All providers failed or rate limited');
    }

    async callEndpoint(endpoint, provider, params, modelId) {
        const options = { ...params, model: modelId };
        
        switch (endpoint) {
            case 'chat/completions':
                return provider.chatCompletion(params.messages, options);
            case 'completions':
                return provider.textCompletion(params.prompt, options);
            case 'embeddings':
                return provider.embeddings(params.input, options);
            default:
                throw new Error(`Endpoint ${endpoint} not supported`);
        }
    }

    isRateLimitError(error) {
        return error.status === 429 || 
               error.message.includes('rate limit') ||
               error.message.includes('quota exceeded');
    }

    extractRetryAfter(error) {
        return error.headers?.['retry-after'] || 60;
    }

    shouldTryNextProvider(error) {
        return error.status >= 500 || 
               error.status === 429 || 
               error.message.includes('timeout');
    }

    getAvailableModels() {
        return Array.from(this.modelToSource.entries()).map(([id, data]) => ({
            ...data.modelData,
            id
        }));
    }
}

module.exports = new AIRouter();