# RouterAI

[中文](README_zh-CN.md) | English

A (work in progress) robust AI model router providing unified access to multiple AI providers through a standardized OpenAI-compatible API interface. RouterAI implements intelligent routing, failover mechanisms, and rate limit handling to ensure reliable access to AI models.

## Why RouterAI?

RouterAI stands apart from alternatives like OneAPI and FastChat by focusing on these key aspects:

- **Minimal Dependencies**: Built with pure Node.js, requiring no complex dependencies or runtime environments.
- **Smart Routing**: Implements intelligent failover between providers when rate limits are hit or errors occur.
- **Production Ready**: Handles retries, rate limits, and provider-specific error cases robustly.
- **Standard Format**: All provider responses are normalized to match OpenAI's format, making it easy to switch providers.
- **Zero Lock-in**: Easy to extend with new providers through a simple provider interface.

## Features

### Core Features
- 🔄 Unified OpenAI-compatible API
- 🔀 Automatic failover between providers
- ⏱️ Built-in rate limit handling and retry mechanism
- 🎯 Same model mapping for cross-provider compatibility
- 🔌 Extensible provider architecture

### Supported Providers
- OpenAI/OpenAI Compatible Providers
- Azure OpenAI
- Anthropic Claude
- Google Vertex AI
- Google AI Studio
- Amazon Bedrock
- Ollama (local models)

### Supported Endpoints
- Chat Completions (`/v1/chat/completions`)
- Text Completions (`/v1/completions`)
- Embeddings (`/v1/embeddings`)
- Model Listing (`/v1/models`)

## Installation

```bash
npm install
```

## Configuration

Create a `config.json` file based on the example below:

```json
{
    "https://api.openai.com": {
        "type": "openai",
        "api_key": "sk-your-api-key"
    }
    // Add other providers as needed
}
```

See `config_example.json` for full provider configuration options.

## Usage

### Starting the Server
```bash
node src/index.js
```

### API Examples

#### Chat Completion
```http
POST /v1/chat/completions
Content-Type: application/json

{
    "model": "gpt-4",
    "messages": [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello!"}
    ],
    "temperature": 0.7
}
```

#### Text Embeddings
```http
POST /v1/embeddings
Content-Type: application/json

{
    "model": "text-embedding-ada-002",
    "input": "Hello world"
}
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

GNU Affero General Public License v3.0 (AGPL-3.0)

## Support

If you encounter any issues or have questions, please file an issue on GitHub.
