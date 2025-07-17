import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import config from '../config';

const router = Router();

// 健康检查接口
interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    coze: {
      status: 'connected' | 'disconnected' | 'unknown';
      lastCheck: string;
    };
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
  };
  config: {
    port: number;
    logLevel: string;
    corsOrigin: string;
  };
}

// 检查Coze服务连接状态
const checkCozeService = async (): Promise<{ status: 'connected' | 'disconnected' | 'unknown'; lastCheck: string }> => {
  try {
    // 这里可以添加实际的Coze服务连接检查逻辑
    // 目前返回基本状态
    return {
      status: 'unknown',
      lastCheck: new Date().toISOString()
    };
  } catch (error) {
    logger.error('[Health Check] Coze服务检查失败:', error);
    return {
      status: 'disconnected',
      lastCheck: new Date().toISOString()
    };
  }
};

// 获取内存使用情况
const getMemoryUsage = () => {
  const memUsage = process.memoryUsage();
  const totalMemory = memUsage.heapTotal;
  const usedMemory = memUsage.heapUsed;
  const percentage = Math.round((usedMemory / totalMemory) * 100);
  
  return {
    used: Math.round(usedMemory / 1024 / 1024), // MB
    total: Math.round(totalMemory / 1024 / 1024), // MB
    percentage
  };
};

// 获取CPU使用情况（简化版）
const getCpuUsage = (): number => {
  const cpuUsage = process.cpuUsage();
  const totalUsage = cpuUsage.user + cpuUsage.system;
  // 简化的CPU使用率计算
  return Math.round((totalUsage / 1000000) % 100);
};

/**
 * @route GET /health
 * @desc 基础健康检查
 * @access Public
 * @returns {
 *   status: string,
 *   timestamp: string,
 *   uptime: number
 * }
 */
router.get('/', (req: Request, res: Response) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    service: 'streaming-tts-service'
  };
  
  res.status(200).json(healthStatus);
});

/**
 * @route GET /health/detailed
 * @desc 详细健康检查
 * @access Public
 * @returns HealthStatus
 */
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    // 检查各个服务状态
    const cozeStatus = await checkCozeService();
    const memoryUsage = getMemoryUsage();
    const cpuUsage = getCpuUsage();
    
    // 判断整体健康状态
    const isHealthy = 
      memoryUsage.percentage < 90 && // 内存使用率小于90%
      cpuUsage < 80; // CPU使用率小于80%
    
    const healthStatus: HealthStatus = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
      environment: config.nodeEnv,
      services: {
        coze: cozeStatus,
        memory: memoryUsage,
        cpu: {
          usage: cpuUsage
        }
      },
      config: {
        port: config.port,
        logLevel: config.logging.level,
        corsOrigin: config.security.corsOrigin
      }
    };
    
    const responseTime = Date.now() - startTime;
    
    // 记录健康检查日志
    logger.info('[Health Check] 详细健康检查完成', {
      status: healthStatus.status,
      responseTime: `${responseTime}ms`,
      memoryUsage: memoryUsage.percentage,
      cpuUsage,
      uptime: healthStatus.uptime
    });
    
    // 根据健康状态返回相应的HTTP状态码
    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json(healthStatus);
    
  } catch (error) {
    logger.error('[Health Check] 详细健康检查失败:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: '健康检查失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * @route GET /health/readiness
 * @desc 就绪检查（用于Kubernetes等容器编排）
 * @access Public
 * @returns {
 *   ready: boolean,
 *   timestamp: string,
 *   checks: object
 * }
 */
router.get('/readiness', async (req: Request, res: Response) => {
  try {
    const checks = {
      coze: false,
      memory: false,
      config: false
    };
    
    // 检查Coze服务
    const cozeStatus = await checkCozeService();
    checks.coze = cozeStatus.status !== 'disconnected';
    
    // 检查内存使用
    const memoryUsage = getMemoryUsage();
    checks.memory = memoryUsage.percentage < 95;
    
    // 检查配置
    checks.config = !!(config.coze.apiToken && config.coze.voiceId);
    
    const isReady = Object.values(checks).every(check => check === true);
    
    const readinessStatus = {
      ready: isReady,
      timestamp: new Date().toISOString(),
      checks
    };
    
    const statusCode = isReady ? 200 : 503;
    res.status(statusCode).json(readinessStatus);
    
  } catch (error) {
    logger.error('[Health Check] 就绪检查失败:', error);
    
    res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
      error: '就绪检查失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
});

/**
 * @route GET /health/liveness
 * @desc 存活检查（用于Kubernetes等容器编排）
 * @access Public
 * @returns {
 *   alive: boolean,
 *   timestamp: string,
 *   uptime: number
 * }
 */
router.get('/liveness', (req: Request, res: Response) => {
  // 简单的存活检查，只要进程在运行就认为是存活的
  const livenessStatus = {
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    pid: process.pid
  };
  
  res.status(200).json(livenessStatus);
});

export default router;