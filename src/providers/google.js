const BaseProvider = require('./base');
const logger = require('../utils/logger');

class GoogleAIProvider extends BaseProvider {
    constructor(config) {
        super(config);
        this.baseUrl = config.baseUrl;
        this.apiKey = config.api_key; // Will receive rotated key from router
    }

    transformRequest(messages, options = {}, type = 'chat') {
        if (type === 'embeddings') {
            return {
                content: { parts: [{ text: messages }] }
            };
        }

        // Map OpenAI roles to Google roles
        const roleMap = {
            'user': 'user',
            'assistant': 'model',
            'system': 'user'  // Gemini doesn't have system, prepend to user
        };

        // Process messages to handle system messages
        let processedMessages = [];
        let systemMessage = '';

        let firstSystemsFound = [];
        let hasUserOrAssistant = false;

        for (const msg of messages) {
            if (msg.role === 'system' && !hasUserOrAssistant) {
                firstSystemsFound.push(msg.content);
            } else {
                hasUserOrAssistant = true;
                processedMessages.push(msg);
            }
        }

        // Combine all initial system messages
        systemMessage = firstSystemsFound.join('\n');

        const isPaLM = options.model?.toLowerCase().includes('bison');
        const transformedRequest = {
            contents: processedMessages.map(msg => ({
                role: roleMap[msg.role],
                parts: [{ text: msg.content }]
            })),
            ...(systemMessage && {
                systemInstruction: {
                    parts: [{ text: systemMessage }]
                }
            }),
            generationConfig: {
                ...(options.temperature && { temperature: options.temperature }),
                ...(options.max_tokens && { maxOutputTokens: options.max_tokens }),
                ...(options.top_k && { topK: options.top_k }),
                ...(options.top_p && { topP: options.top_p }),
                ...(options.presence_penalty && { presencePenalty: options.presence_penalty }),
                ...(options.frequency_penalty && { frequencyPenalty: options.frequency_penalty }),
                ...(options.stop && { stopSequences: options.stop })
            },
            ...(isPaLM ? {
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_UNSPECIFIED",
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_DEROGATORY",
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_TOXICITY",
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_VIOLENCE",
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_SEXUAL",
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_MEDICAL",
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_DANGEROUS",
                        threshold: "BLOCK_NONE"
                    }
                ]
            } : {
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH",
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_NONE"
                    },
                    {
                        category: "HARM_CATEGORY_CIVIC_INTEGRITY",
                        threshold: "BLOCK_NONE"
                    }
                ]
            })
        };

        logger.log('transform-request', {
            original: { messages, options },
            transformed: transformedRequest
        }, 'google');

        return transformedRequest;
    }

    transformResponse(response, modelId, type = 'chat') {
        let transformed;

        if (type === 'embeddings') {
            transformed = {
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
        } else if (type === 'stream') {
            const content = response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            transformed = {
                id: `gemini-${Date.now()}`,
                object: 'chat.completion.chunk',
                created: Date.now(),
                model: modelId,
                choices: [{
                    delta: this.streamStarted 
                        ? { content }
                        : { role: 'assistant', content },
                    finish_reason: response?.candidates?.[0]?.finishReason || null,
                    index: 0
                }]
            };
        } else {
            transformed = {
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

        logger.log('transform-response', {
            type,
            original: response,
            transformed
        }, 'google');

        return transformed;
    }

    async listModels() {
        const endpoint = `${this.baseUrl}/v1beta/models?key=${this.apiKey}`;
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw this.handleError(response);
        }

        const result = await response.json();
        
        // Transform to match OpenAI format while preserving Google's metadata
        return {
            data: result.models.map(model => ({
                id: model.name.replace('models/', ''),
                object: 'model',
                owned_by: 'google',
                // Preserve Google's model metadata as additional properties
                google_metadata: {
                    ...model
                }
            }))
        };
    }

    async chatCompletion(messages, options = {}) {
        if (options.stream) {
            this.streamStarted = false;
            this.lines = [];
            this.isAccumulating = false;
            this.waitingForBoundary = false;
            this.emptyLineCount = 0;
        }
        const modelId = options.model;
        const endpoint = options.stream ?
            `${this.baseUrl}/v1beta/models/${modelId}:streamGenerateContent?key=${this.apiKey}` :
            `${this.baseUrl}/v1beta/models/${modelId}:generateContent?key=${this.apiKey}`;
        
        const requestData = this.transformRequest(messages, options);

        logger.log('provider-request', {
            endpoint,
            body: requestData
        }, 'google');
                
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.log('provider-error', {
                status: response.status,
                error: errorText
            }, 'google');
            console.error('Google AI Error:', errorText);
            throw this.handleError({ ...response, error: errorText });
        }

        if (options.stream) {
            logger.log('provider-stream-start', {
                status: response.status
            }, 'google');

            const textDecoder = new TextDecoder();
            const transformStream = new TransformStream({
                transform: async (chunk, controller) => {
                    try {
                        const text = textDecoder.decode(chunk);
                        const lines = text.split(/\r?\n/);
                        
                        for (const line of lines) {
                            if (!this.isAccumulating) {
                                if (line === '[{' || line === '{') {
                                    this.isAccumulating = true;
                                    this.lines = [];
                                    if (line === '[{') {
                                        this.lines.push('{');
                                    } else {
                                        this.lines.push(line);
                                    }
                                }
                                continue;
                            }

                            if (line === '') {
                                this.emptyLineCount++;
                                if (this.waitingForBoundary) continue;
                            } else {
                                if (this.waitingForBoundary) {
                                    if (line === ',' || line === ']') {
                                        try {
                                            // Properly reconstruct the JSON string
                                            const jsonStr = this.lines
                                                .join('')  // Join without newlines
                                            
                                            const data = JSON.parse(jsonStr);
                                            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                                                const transformed = this.transformResponse(data, modelId, 'stream');
                                                if (transformed.choices[0].delta.content.trim()) {
                                                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(transformed)}\n\n`));
                                                }
                                            }
                                        } catch (parseError) {
                                        }

                                        // Reset state
                                        this.lines = [];
                                        this.isAccumulating = false;
                                        this.waitingForBoundary = false;
                                        this.emptyLineCount = 0;
                                    }
                                    continue;
                                }

                                if (line === '}') {
                                    this.lines.push(line);
                                    this.waitingForBoundary = true;
                                    this.emptyLineCount = 0;
                                    continue;
                                }

                                this.emptyLineCount = 0;
                                this.lines.push(line);
                            }
                        }
                    } catch (e) {
                        console.error('Error processing stream chunk:', e);
                    }
                },
                flush: (controller) => {
                    controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                }
            });

            return {
                body: response.body.pipeThrough(transformStream)
            };
        }

        const rawResponse = await response.json();
        logger.log('provider-response', rawResponse, 'google');
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
            const requestData = this.transformRequest(text, options, 'embeddings');
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
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
