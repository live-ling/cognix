调用:
curl --location --request POST 'https://api.xiaomimimo.com/v1/chat/completions' \
--header "api-key: $MIMO_API_KEY" \
--header 'Content-Type: application/json' \
--data-raw '{
    "model": "mimo-v2.5-asr",
    "messages": [
        {
            "role": "user",
            "content": [
                {
                    "type": "input_audio",
                    "input_audio": {
                        "data": "data:{MIME_TYPE};base64,$BASE64_AUDIO"
                    }
                }
            ]
        }
    ],
    "asr_options": {
        "language": "auto"
    }
}'

响应:
{
    "id": "9f51eba459dd4dfdabb31cabba0cb7dc",
    "choices": [
        {
            "finish_reason": "stop",
            "index": 0,
            "message": {
                "content": "Good morning. Could you tell me what the weather will be like today?",
                "role": "assistant",
                "audio": null,
                "tool_calls": null,
                "audio_tokens": []
            }
        }
    ],
    "created": 1780398283,
    "model": "mimo-v2.5-asr",
    "object": "chat.completion",
    "usage": {
        "completion_tokens": 20,
        "prompt_tokens": 46,
        "total_tokens": 66,
        "completion_tokens_details": {
            "reasoning_tokens": 0
        },
        "prompt_tokens_details": {
            "audio_tokens": 25,
            "cached_tokens": 45
        },
        "seconds": 4
    }
}

流式响应:
curl --location --request POST 'https://api.xiaomimimo.com/v1/chat/completions' \
--header "api-key: $MIMO_API_KEY" \
--header 'Content-Type: application/json' \
--data-raw '{
    "model": "mimo-v2.5-asr",
    "messages": [
        {
            "role": "user",
            "content": [
                {
                    "type": "input_audio",
                    "input_audio": {
                        "data": "data:{MIME_TYPE};base64,$BASE64_AUDIO"
                    }
                }
            ]
        }
    ],
    "asr_options": {
        "language": "auto"
    },
    "stream": true
}'

data: {"id":"97d2cac0fcb445a8bd01486c76af675d","choices":[{"delta":{"content":"","role":"assistant","tool_calls":null,"audio_tokens":null,"audio":null,"reasoning_content":null},"finish_reason":null,"index":0}],"created":1780398393,"model":"mimo-v2.5-asr","object":"chat.completion.chunk"}

data: {"id":"97d2cac0fcb445a8bd01486c76af675d","choices":[{"delta":{"content":"Good","role":null,"tool_calls":null,"audio_tokens":null,"audio":null,"reasoning_content":null},"finish_reason":null,"index":0}],"created":1780398393,"model":"mimo-v2.5-asr","object":"chat.completion.chunk"}

data: {"id":"97d2cac0fcb445a8bd01486c76af675d","choices":[{"delta":{"content":" morning","role":null,"tool_calls":null,"audio_tokens":null,"audio":null,"reasoning_content":null},"finish_reason":null,"index":0}],"created":1780398393,"model":"mimo-v2.5-asr","object":"chat.completion.chunk"}

data: {"id":"97d2cac0fcb445a8bd01486c76af675d","choices":[{"delta":{"content":".","role":null,"tool_calls":null,"audio_tokens":null,"audio":null,"reasoning_content":null},"finish_reason":null,"index":0}],"created":1780398393,"model":"mimo-v2.5-asr","object":"chat.completion.chunk"}

...

data: {"id":"97d2cac0fcb445a8bd01486c76af675d","choices":[{"delta":{"content":" today","role":null,"tool_calls":null,"audio_tokens":null,"audio":null,"reasoning_content":null},"finish_reason":null,"index":0}],"created":1780398393,"model":"mimo-v2.5-asr","object":"chat.completion.chunk"}

data: {"id":"97d2cac0fcb445a8bd01486c76af675d","choices":[{"delta":{"content":"?","role":null,"tool_calls":null,"audio_tokens":null,"audio":null,"reasoning_content":null},"finish_reason":null,"index":0}],"created":1780398393,"model":"mimo-v2.5-asr","object":"chat.completion.chunk"}

data: {"id":"97d2cac0fcb445a8bd01486c76af675d","choices":[{"delta":{"content":null,"role":null,"tool_calls":null,"audio_tokens":null,"audio":null,"reasoning_content":null},"finish_reason":"stop","index":0}],"created":1780398393,"model":"mimo-v2.5-asr","object":"chat.completion.chunk","usage":null}

data: {"id":"97d2cac0fcb445a8bd01486c76af675d","choices":[],"created":1780398393,"model":"mimo-v2.5-asr","object":"chat.completion.chunk","usage":{"completion_tokens":20,"prompt_tokens":46,"total_tokens":66,"completion_tokens_details":{"reasoning_tokens":0},"prompt_tokens_details":{"audio_tokens":25,"cached_tokens":4},"seconds":4}}

data: [DONE]