class BaseProvider {
    constructor(config) {
        this.config = config;
        this.baseUrl = config.baseUrl;
    }

    async listModels() {
        throw new Error('Not implemented');
    }

    async chatCompletion(messages, options = {}) {
        throw new Error('Not implemented');
    }

    async textCompletion(prompt, options = {}) {
        throw new Error('Not implemented');
    }

    async embeddings(input, options = {}) {
        throw new Error('Not implemented');
    }

    handleError(error) {
        // Convert provider-specific errors to standard format
        const standardError = new Error(error.message);
        standardError.status = error.status || error.statusCode || 500;
        standardError.headers = error.response?.headers || {};
        return standardError;
    }
}

module.exports = BaseProvider;