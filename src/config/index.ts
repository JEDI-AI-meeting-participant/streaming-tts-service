import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config();

// 服务配置接口
interface ServiceConfig {
  port: number;
  nodeEnv: string;
  
  // Coze API 配置
  coze: {
    apiToken: string;
    wsUrl: string;
    voiceId: string;
  };
  
  // 音频配置
  audio: {
    sampleRate: number;
    channels: number;
    speed: number;
    format: string;
  };
  
  // 安全配置
  security: {
    corsOrigin: string;
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
  };
  
  // 日志配置
  logging: {
    level: string;
    file: string;
  };
  
  // 健康检查配置
  health: {
    timeout: number;
  };
  
  // WebSocket 配置
  websocket: {
    timeout: number;
    reconnectAttempts: number;
    reconnectDelay: number;
  };
  
  // 限流配置
  throttle: {
    ttl: number;
    limit: number;
  };
}

// 获取环境变量值，支持默认值
function getEnvValue(key: string, defaultValue: string): string;
function getEnvValue(key: string, defaultValue: number): number;
function getEnvValue(key: string, defaultValue: boolean): boolean;
function getEnvValue(key: string, defaultValue: any): any {
  const value = process.env[key];
  
  if (value === undefined) {
    return defaultValue;
  }
  
  // 根据默认值类型进行转换
  if (typeof defaultValue === 'number') {
    const numValue = parseInt(value, 10);
    return isNaN(numValue) ? defaultValue : numValue;
  }
  
  if (typeof defaultValue === 'boolean') {
    return value.toLowerCase() === 'true';
  }
  
  return value;
}

// 验证必需的环境变量
function validateRequiredEnvVars(): void {
  const required = [
    'COZE_API_TOKEN',
    'COZE_VOICE_ID'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`缺少必需的环境变量: ${missing.join(', ')}`);
  }
}

// 验证环境变量
validateRequiredEnvVars();

// 导出配置
export const config: ServiceConfig = {
  port: getEnvValue('PORT', 3004),
  nodeEnv: getEnvValue('NODE_ENV', 'development'),
  
  coze: {
    apiToken: process.env.COZE_API_TOKEN!,
    wsUrl: getEnvValue('COZE_WS_URL', 'wss://ws.coze.cn'),
    voiceId: process.env.COZE_VOICE_ID!
  },
  
  audio: {
    sampleRate: getEnvValue('AUDIO_SAMPLE_RATE', 24000),
    channels: getEnvValue('AUDIO_CHANNELS', 1),
    speed: getEnvValue('AUDIO_SPEED', 1.0),
    format: getEnvValue('AUDIO_FORMAT', 'pcm')
  },
  
  security: {
    corsOrigin: getEnvValue('CORS_ORIGIN', 'http://localhost:3000'),
    rateLimitWindowMs: getEnvValue('RATE_LIMIT_WINDOW_MS', 900000), // 15分钟
    rateLimitMaxRequests: getEnvValue('RATE_LIMIT_MAX_REQUESTS', 100)
  },
  
  logging: {
    level: getEnvValue('LOG_LEVEL', 'info'),
    file: getEnvValue('LOG_FILE', 'logs/streaming-tts.log')
  },
  
  health: {
    timeout: getEnvValue('HEALTH_CHECK_TIMEOUT', 5000)
  },
  
  websocket: {
    timeout: getEnvValue('WS_TIMEOUT', 30000),
    reconnectAttempts: getEnvValue('WS_RECONNECT_ATTEMPTS', 3),
    reconnectDelay: getEnvValue('WS_RECONNECT_DELAY', 1000)
  },
  
  throttle: {
    ttl: getEnvValue('THROTTLE_TTL', 60),
    limit: getEnvValue('THROTTLE_LIMIT', 10)
  }
};

export default config;