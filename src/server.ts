import app from './app';
import { logger } from './utils/logger';
import config from './config';

// 启动服务器
const startServer = async (): Promise<void> => {
  try {
    // 验证必需的环境变量
    if (!config.coze.apiToken) {
      throw new Error('COZE_API_TOKEN 环境变量未设置');
    }
    
    if (!config.coze.voiceId) {
      throw new Error('COZE_VOICE_ID 环境变量未设置');
    }
    
    // 启动HTTP服务器
    const server = app.listen(config.port, () => {
      logger.info('[Server] 🚀 Streaming TTS Service 启动成功', {
        port: config.port,
        environment: config.nodeEnv,
        timestamp: new Date().toISOString(),
        config: {
          corsOrigin: config.security.corsOrigin,
          logLevel: config.logging.level,
          audioFormat: config.audio.format,
          sampleRate: config.audio.sampleRate,
          rateLimitWindow: `${config.security.rateLimitWindowMs / 1000}s`,
          rateLimitMax: config.security.rateLimitMaxRequests
        }
      });
      
      console.log(`\n🎉 Streaming TTS Service 已启动`);
      console.log(`📡 服务地址: http://localhost:${config.port}`);
      console.log(`🏥 健康检查: http://localhost:${config.port}/health`);
      console.log(`📚 API文档: http://localhost:${config.port}/api/docs`);
      console.log(`🔊 TTS API: http://localhost:${config.port}/api/tts`);
      console.log(`🌍 环境: ${config.nodeEnv}`);
      console.log(`📝 日志级别: ${config.logging.level}`);
      console.log(`\n准备接收TTS请求...\n`);
    });
    
    // 设置服务器超时
    server.timeout = 120000; // 2分钟超时
    server.keepAliveTimeout = 65000; // 65秒保持连接
    server.headersTimeout = 66000; // 66秒头部超时
    
    // 优雅关闭处理
    const gracefulShutdown = (signal: string) => {
      logger.info(`[Server] 收到${signal}信号，开始优雅关闭服务器...`);
      
      server.close((err) => {
        if (err) {
          logger.error('[Server] 服务器关闭时发生错误:', err);
          process.exit(1);
        }
        
        logger.info('[Server] 服务器已优雅关闭');
        process.exit(0);
      });
      
      // 强制关闭超时
      setTimeout(() => {
        logger.error('[Server] 强制关闭服务器（超时）');
        process.exit(1);
      }, 10000);
    };
    
    // 注册信号处理器
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // 处理未捕获的异常
    process.on('uncaughtException', (error: Error) => {
      logger.error('[Server] 未捕获的异常:', {
        message: error.message,
        stack: error.stack
      });
      
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });
    
    // 处理未处理的Promise拒绝
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      logger.error('[Server] 未处理的Promise拒绝:', {
        reason: reason?.message || reason,
        stack: reason?.stack,
        promise: promise.toString()
      });
      
      gracefulShutdown('UNHANDLED_REJECTION');
    });
    
  } catch (error) {
    logger.error('[Server] 服务器启动失败:', {
      message: error instanceof Error ? error.message : '未知错误',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    console.error('❌ 服务器启动失败:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
};

// 启动服务器
if (require.main === module) {
  startServer();
}

export default startServer;