import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan = require('morgan');
import { logger } from './utils/logger';
import config from './config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';

// 导入路由
import ttsRoutes from './routes/tts';
import healthRoutes from './routes/health';

// 创建Express应用
const app: Application = express();

// 信任代理（用于获取真实IP地址）
app.set('trust proxy', 1);

// 安全中间件
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS配置
app.use(cors({
  origin: config.security.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-TTS-Session-ID'
  ],
  exposedHeaders: [
    'X-TTS-Session-ID',
    'X-TTS-Duration',
    'X-TTS-Audio-Size',
    'Content-Length',
    'Content-Type'
  ]
}));

// 压缩响应
app.use(compression() as any);

// 请求体解析中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 请求日志中间件
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => {
        logger.info(message.trim());
      }
    }
  }));
}

// 请求追踪中间件
app.use((req: Request, res: Response, next: NextFunction) => {
  // 生成请求ID
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  // 记录请求开始时间
  const startTime = Date.now();
  
  // 监听响应完成事件
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logger.info('[Request] 请求完成', {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  });
  
  next();
});

// 应用全局速率限制
app.use(rateLimiter);

// 根路径
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Streaming TTS Service API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      tts: '/api/tts',
      docs: '/api/docs'
    }
  });
});

// API路由
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/tts', ttsRoutes);

// API文档路由（简单版本）
app.get('/api/docs', (req: Request, res: Response) => {
  res.json({
    success: true,
    title: 'Streaming TTS Service API Documentation',
    version: '1.0.0',
    description: '基于Coze WebSocket API的流式文本转语音服务',
    baseUrl: `http://localhost:${config.port}`,
    endpoints: {
      'POST /api/tts/synthesize': {
        description: '语音合成（返回完整音频文件）',
        body: {
          text: 'string (required) - 要合成的文本',
          sessionId: 'string (optional) - 会话ID',
          voiceId: 'string (optional) - 语音ID',
          speed: 'number (optional) - 语速 0.5-2.0'
        },
        response: 'audio/wav file'
      },
      'POST /api/tts/synthesize-stream': {
        description: '流式语音合成（Server-Sent Events）',
        body: {
          text: 'string (required) - 要合成的文本',
          sessionId: 'string (optional) - 会话ID',
          voiceId: 'string (optional) - 语音ID',
          speed: 'number (optional) - 语速 0.5-2.0'
        },
        response: 'Server-Sent Events stream'
      },
      'POST /api/tts/stop': {
        description: '停止当前语音合成',
        response: '{ success: boolean, message: string }'
      },
      'GET /api/tts/status': {
        description: '获取TTS服务状态',
        response: '{ success: boolean, data: object }'
      },
      'PUT /api/tts/config': {
        description: '更新TTS配置',
        body: {
          voiceId: 'string (optional) - 语音ID',
          speed: 'number (optional) - 语速',
          enabled: 'boolean (optional) - 是否启用'
        },
        response: '{ success: boolean, message: string, config: object }'
      },
      'GET /health': {
        description: '基础健康检查',
        response: '{ status: string, timestamp: string, uptime: number }'
      },
      'GET /health/detailed': {
        description: '详细健康检查',
        response: 'HealthStatus object'
      }
    },
    examples: {
      synthesize: {
        url: '/api/tts/synthesize',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          text: '你好，这是一个测试文本。',
          sessionId: 'test-session-123',
          speed: 1.0
        }
      }
    }
  });
});

// 404处理
app.use(notFoundHandler);

// 全局错误处理
app.use(errorHandler);

// 优雅关闭处理
process.on('SIGTERM', () => {
  logger.info('[App] 收到SIGTERM信号，开始优雅关闭...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('[App] 收到SIGINT信号，开始优雅关闭...');
  process.exit(0);
});

export default app;