const fs = require('fs');
const path = require('path');
const { getBaseModel } = require('./modelAliases');
const logger = require('./utils/logger');

class AIRouter {
    constructor() {
        this.providers = new Map();
        this.modelToSource = new Map();
        this.configPath = path.join(__dirname, '../config.json');
        this.rateLimits = new Map();
        this.retryDelays = new Map();
        this.keyIndexes = new Map();
        
        this.config = {}; // Initialize config before loading
        this.loadConfig();
        this.watchConfig();
        this.refreshModels().catch(error => {
            logger.log('init-error', error.message, 'router');
        });
    }

    loadConfig() {
        try {
            const configContent = fs.readFileSync(this.configPath, 'utf8');
            try {
                this.config = JSON.parse(configContent);
            } catch (parseError) {
                logger.log('config-parse-error', `Failed to parse config.json: ${parseError.message}`, 'router');
                // Keep existing config if parsing fails
                if (!this.config) {
                    this.config = {};
                }
            }
        } catch (error) {
            logger.log('config-read-error', `Failed to read config.json: ${error.message}`, 'router');
            if (!this.config) {
                this.config = {};
            }
        }
    }

    watchConfig() {
        fs.watch(this.configPath, (eventType, filename) => {
            if (eventType === 'change') {
                logger.log('config-change', 'Config file changed, reloading...', 'router');
                this.loadConfig();
                this.refreshModels().catch(error => {
                    logger.log('config-reload-error', error.message, 'router');
                });
            }
        });
    }

    rotateApiKey(providerKey, config) {
        // If api_keys array exists, perform rotation
        if (config.api_keys && Array.isArray(config.api_keys) && config.api_keys.length > 0) {
            if (!this.keyIndexes.has(providerKey)) {
                this.keyIndexes.set(providerKey, 0);
            }

            let currentIndex = this.keyIndexes.get(providerKey);
            const key = config.api_keys[currentIndex];
            
            // Update index for next use
            currentIndex = (currentIndex + 1) % config.api_keys.length;
            this.keyIndexes.set(providerKey, currentIndex);

            return key;
        }

        // If no api_keys array is provided, this URL doesn't use key rotation
        return null;
    }

    async refreshModels() {
        this.modelToSource.clear();
        
        for (const [baseUrl, source] of Object.entries(this.config)) {
            const providerKey = `${source.type}-${baseUrl}`;
            
            try {
                if (!this.providers.has(providerKey)) {
                    const Provider = require(`./providers/${source.type}`);
                    const providerConfig = {
                        ...source,
                        baseUrl,
                    };
                    // Only set api_key if rotation is available
                    const rotatedKey = this.rotateApiKey(providerKey, source);
                    if (rotatedKey) {
                        providerConfig.api_key = rotatedKey;
                    }
                    this.providers.set(providerKey, new Provider(providerConfig));
                }

                const provider = this.providers.get(providerKey);
                const models = await provider.listModels();
                
                for (const model of models.data) {
                    // Use the complete URL (including port if present)
                    const url = new URL(baseUrl);
                    const fullUrl = url.host; // host includes both hostname and port if present
                    const combinedModelId = `${fullUrl}::${model.id}`;
                    const baseModel = getBaseModel(model.id);
                    if (!this.modelToSource.has(combinedModelId)) {
                        this.modelToSource.set(combinedModelId, {
                            sources: [],
                            modelData: { ...model, id: combinedModelId }
                        });
                    }
                    this.modelToSource.get(combinedModelId).sources.push({
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
        // Split the model name to get the actual model ID
        const [domain, actualModel] = model.split('::');
        const baseModel = getBaseModel(actualModel);
        const modelData = this.modelToSource.get(model);
        
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
                    const providerConfig = {
                        ...selected.config,
                        baseUrl: selected.baseUrl,
                    };
                    // Only set api_key if rotation is available
                    const rotatedKey = this.rotateApiKey(providerKey, selected.config);
                    if (rotatedKey) {
                        providerConfig.api_key = rotatedKey;
                    }
                    this.providers.set(providerKey, new Provider(providerConfig));
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
        const providerName = provider.constructor.name;
        
        if (endpoint === 'embeddings') {
            const options = { ...params, model: modelId };
            const response = await provider.embeddings(params.input, options);
            logger.log('embeddings-response', response, providerName);
            return response;
        }

        const options = { 
            ...params,
            model: modelId,
            stream: true
        };
        
        let response;
        switch (endpoint) {
            case 'chat/completions':
                response = await provider.chatCompletion(params.messages, options);
                break;
            case 'completions':
                response = await provider.textCompletion(params.prompt, options);
                break;
            default:
                throw new Error(`Endpoint ${endpoint} not supported`);
        }

        if (!params.stream) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let chunks = [];
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(decoder.decode(value, { stream: true }));
            }

            const fullResponse = chunks
                .join('')
                .split('\n')
                .filter(line => line.trim().startsWith('data: '))
                .map(line => line.replace('data: ', '').trim())
                .filter(line => line !== '[DONE]')
                .map(line => JSON.parse(line));

            logger.log('collected-chunks', fullResponse, providerName);

            const combinedResponse = {
                id: fullResponse[0]?.id || 'combined_response',
                object: fullResponse[0]?.object || 'chat.completion',
                created: fullResponse[0]?.created || Math.floor(Date.now() / 1000),
                model: modelId,
                choices: [{
                    index: 0,
                    message: {
                        role: "assistant",
                        content: fullResponse.map(chunk => 
                            chunk.choices[0]?.delta?.content || ''
                        ).join('')
                    },
                    finish_reason: fullResponse[fullResponse.length - 1]?.choices[0]?.finish_reason || 'stop'
                }]
            };

            logger.log('combined-response', combinedResponse, providerName);
            return combinedResponse;
        }

        return response;
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