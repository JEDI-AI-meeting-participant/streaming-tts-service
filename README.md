# Streaming TTS Service

Streaming text-to-speech microservice based on Coze WebSocket API.

## Features

- **Streaming Speech Synthesis**: Real-time speech synthesis based on Coze WebSocket API
- **High Performance**: Support for concurrent requests and streaming audio transmission
- **Container Friendly**: Support for Docker deployment and Kubernetes orchestration

## Quick Start

### Install Dependencies

```bash
npm install
```

### Environment Configuration

Copy environment variable template and configure:

```bash
cp .env.example .env
```

Edit the `.env` file to configure required environment variables:

```env
# Coze API 配置（必需）
COZE_API_TOKEN=your_coze_api_token
COZE_VOICE_ID=your_voice_id

# 服务配置
PORT=3004
NODE_ENV=development

# 其他配置项请参考 .env.example
```

### Start Service

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

## API 接口

### 基础信息

- **Base URL**: `http://localhost:3004`
- **Content-Type**: `application/json`

### Endpoint List

#### 1. Speech Synthesis

**POST** `/api/tts/synthesize`

Convert text to speech file.

**请求体**:
```json
{
  "text": "你好，这是一个测试文本。",
  "sessionId": "optional-session-id",
  "voiceId": "optional-voice-id",
  "speed": 1.0
}
```

**Response**: Audio file (`audio/wav`)

#### 2. Streaming Speech Synthesis

**POST** `/api/tts/synthesize-stream`

Streaming speech synthesis using Server-Sent Events.

**Request Body**: Same as above

**Response**: Server-Sent Events stream

```
data: {"type":"connected","sessionId":"test-123"}

data: {"type":"audioChunk","sessionId":"test-123","data":"base64-audio-data"}

data: {"type":"complete","sessionId":"test-123","totalSize":12345}
```

#### 3. Stop Synthesis

**POST** `/api/tts/stop`

Stop current ongoing speech synthesis.

#### 4. Service Status

**GET** `/api/tts/status`

Get current status of TTS service.

#### 5. Update Configuration

**PUT** `/api/tts/config`

Dynamically update TTS service configuration.

**请求体**:
```json
{
  "voiceId": "new-voice-id",
  "speed": 1.2,
  "enabled": true
}
```

## Usage Examples

### cURL Examples

```bash
# Speech synthesis
curl -X POST http://localhost:3004/api/tts/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello World"}' \
  --output output.wav

# Get service status
curl http://localhost:3004/api/tts/status
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `COZE_API_TOKEN` | ✅ | - | Coze API access token |
| `COZE_VOICE_ID` | ✅ | - | Coze voice ID |
| `PORT` | ❌ | 3004 | Service port |
| `NODE_ENV` | ❌ | development | Runtime environment |
| `COZE_WS_URL` | ❌ | wss://ws.coze.cn | Coze WebSocket URL |
| `AUDIO_SAMPLE_RATE` | ❌ | 24000 | Audio sample rate |
| `AUDIO_CHANNELS` | ❌ | 1 | Audio channels |
| `AUDIO_SPEED` | ❌ | 1.0 | Default speech speed |
| `AUDIO_FORMAT` | ❌ | pcm | Audio format |
| `CORS_ORIGIN` | ❌ | http://localhost:3000 | CORS allowed origin |
| `LOG_LEVEL` | ❌ | info | Log level |

## Development Guide

### Project Structure

```
src/
├── config/           # 配置管理
├── controllers/      # 控制器
├── middleware/       # 中间件
├── routes/          # 路由定义
├── services/        # 业务服务
├── utils/           # 工具函数
├── app.ts           # 应用程序
└── server.ts        # 服务器启动
```

## Deployment

### Docker Deployment

```bash
# Build image
docker build -t streaming-tts-service .

# Run container
docker run -p 3004:3004 \
  -e COZE_API_TOKEN=your_token \
  -e COZE_VOICE_ID=your_voice_id \
  streaming-tts-service
```

### Kubernetes Deployment

Refer to configuration files in the `k8s/` directory.
