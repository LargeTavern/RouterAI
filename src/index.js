const express = require('express');
const router = require('./router');
const logger = require('./utils/logger');
const ensureDir = require('./utils/ensureDir');
const path = require('path');

ensureDir(path.join(__dirname, '../logs'));

process.env.LOGGING = process.env.LOGGING || 'true';
process.env.PORT = process.env.PORT || '3000';

const app = express();

// Increased limit
app.use(express.json({
    limit: '50mb'
}));

const jsonResponse = (res, status, data) => {
    res.status(parseInt(status))
       .json(data);
};

app.get('/v1/models', (req, res) => {
    const models = {
        data: router.getAvailableModels(),
        object: "list"
    };
    jsonResponse(res, 200, models);
});

const handleStreamingResponse = (response, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    const textDecoder = new TextDecoder();

    async function streamResponse() {
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    logger.log('stream-end', 'DONE');
                    res.write('data: [DONE]\n\n');
                    res.end();
                    break;
                }
                const chunk = textDecoder.decode(value, { stream: true });
                logger.log('stream-chunk', chunk);
                res.write(chunk);
            }
        } catch (error) {
            logger.log('stream-error', error.message);
            res.end();
        }
    }

    streamResponse().catch(error => {
        logger.log('stream-processing-error', error.message);
        res.end();
    });

    req.on('close', () => {
        reader.cancel();
    });
};

app.post('/v1/chat/completions', async (req, res) => {
    if (!req.body.messages || !Array.isArray(req.body.messages)) {
        return jsonResponse(res, 400, {
            error: { message: "messages is required and must be an array" }
        });
    }

    try {
        const response = await router.route('chat/completions', req.body);
        if (req.body.stream) {
            handleStreamingResponse(response, res);
        } else {
            jsonResponse(res, 200, response);
        }
    } catch (error) {
        jsonResponse(res, 500, { error: { message: error.message } });
    }
});

app.post('/v1/completions', async (req, res) => {
    if (!req.body.prompt) {
        return jsonResponse(res, 400, {
            error: { message: "prompt is required", type: "invalid_request_error" }
        });
    }

    try {
        const response = await router.route('completions', req.body);
        if (req.body.stream) {
            handleStreamingResponse(response, res);
        } else {
            jsonResponse(res, 200, response);
        }
    } catch (error) {
        jsonResponse(res, 500, { error: { message: error.message } });
    }
});

app.post('/v1/embeddings', (req, res) => {
    if (!req.body.input) {
        return jsonResponse(res, 400, {
            error: {
                message: "input is required",
                type: "invalid_request_error"
            }
        });
    }

    router.route('embeddings', req.body)
        .then(response => jsonResponse(res, 200, response))
        .catch(error => jsonResponse(res, 500, {
            error: { message: error.message }
        }));
});

app.post('/admin/refresh-models', (req, res) => {
    router.refreshModels()
        .then(() => {
            jsonResponse(res, 200, {
                success: true,
                models: router.getAvailableModels()
            });
        })
        .catch(error => {
            jsonResponse(res, 500, {
                error: {
                    message: error.message,
                    type: "internal_server_error"
                }
            });
        });
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
