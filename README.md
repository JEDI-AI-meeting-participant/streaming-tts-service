# Streaming TTS Service

基于 Coze WebSocket API 的流式文本转语音微服务。

## 功能特性

- **流式语音合成**: 基于 Coze WebSocket API 实现实时语音合成
- **高性能**: 支持并发请求和流式音频传输
- **容器友好**: 支持 Docker 部署和 Kubernetes 编排

## 快速开始

### 安装依赖

```bash
npm install
```

### 环境配置

复制环境变量模板并配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置必需的环境变量：

```env
# Coze API 配置（必需）
COZE_API_TOKEN=your_coze_api_token
COZE_VOICE_ID=your_voice_id

# 服务配置
PORT=3004
NODE_ENV=development

# 其他配置项请参考 .env.example
```

### 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

## API 接口

### 基础信息

- **Base URL**: `http://localhost:3004`
- **Content-Type**: `application/json`

### 端点列表

#### 1. 语音合成

**POST** `/api/tts/synthesize`

将文本转换为语音文件。

**请求体**:
```json
{
  "text": "你好，这是一个测试文本。",
  "sessionId": "optional-session-id",
  "voiceId": "optional-voice-id",
  "speed": 1.0
}
```

**响应**: 音频文件 (`audio/wav`)

#### 2. 流式语音合成

**POST** `/api/tts/synthesize-stream`

使用 Server-Sent Events 进行流式语音合成。

**请求体**: 同上

**响应**: Server-Sent Events 流

```
data: {"type":"connected","sessionId":"test-123"}

data: {"type":"audioChunk","sessionId":"test-123","data":"base64-audio-data"}

data: {"type":"complete","sessionId":"test-123","totalSize":12345}
```

#### 3. 停止合成

**POST** `/api/tts/stop`

停止当前正在进行的语音合成。

#### 4. 服务状态

**GET** `/api/tts/status`

获取 TTS 服务的当前状态。

#### 5. 更新配置

**PUT** `/api/tts/config`

动态更新 TTS 服务配置。

**请求体**:
```json
{
  "voiceId": "new-voice-id",
  "speed": 1.2,
  "enabled": true
}
```

## 使用示例

### cURL 示例

```bash
# 语音合成
curl -X POST http://localhost:3004/api/tts/synthesize \
  -H "Content-Type: application/json" \
  -d '{"text":"你好世界"}' \
  --output output.wav

# 获取服务状态
curl http://localhost:3004/api/tts/status
```

## 配置说明

### 环境变量

| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| `COZE_API_TOKEN` | ✅ | - | Coze API 访问令牌 |
| `COZE_VOICE_ID` | ✅ | - | Coze 语音 ID |
| `PORT` | ❌ | 3004 | 服务端口 |
| `NODE_ENV` | ❌ | development | 运行环境 |
| `COZE_WS_URL` | ❌ | wss://ws.coze.cn | Coze WebSocket URL |
| `AUDIO_SAMPLE_RATE` | ❌ | 24000 | 音频采样率 |
| `AUDIO_CHANNELS` | ❌ | 1 | 音频声道数 |
| `AUDIO_SPEED` | ❌ | 1.0 | 默认语速 |
| `AUDIO_FORMAT` | ❌ | pcm | 音频格式 |
| `CORS_ORIGIN` | ❌ | http://localhost:3000 | CORS 允许的源 |
| `LOG_LEVEL` | ❌ | info | 日志级别 |

## 开发指南

### 项目结构

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

## 部署

### Docker 部署

```bash
# 构建镜像
docker build -t streaming-tts-service .

# 运行容器
docker run -p 3004:3004 \
  -e COZE_API_TOKEN=your_token \
  -e COZE_VOICE_ID=your_voice_id \
  streaming-tts-service
```

### Kubernetes 部署

参考 `k8s/` 目录下的配置文件。
