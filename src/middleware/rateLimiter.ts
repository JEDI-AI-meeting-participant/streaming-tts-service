import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import config from '../config';
import { logger } from '../utils/logger';

// 创建速率限制器
export const rateLimiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs, // 时间窗口（毫秒）
  max: config.security.rateLimitMaxRequests, // 最大请求数
  message: {
    success: false,
    error: '请求过于频繁，请稍后再试',
    retryAfter: Math.ceil(config.security.rateLimitWindowMs / 1000) // 秒
  },
  standardHeaders: true, // 返回速率限制信息在 `RateLimit-*` 头中
  legacyHeaders: false, // 禁用 `X-RateLimit-*` 头
  
  // 自定义键生成器（基于IP地址）
  keyGenerator: (req: Request): string => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  
  // 请求被限制时的处理函数
  handler: (req: Request, res: Response) => {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    
    logger.warn('[Rate Limiter] 请求被限制', {
      clientIP,
      url: req.url,
      method: req.method,
      userAgent: req.get('User-Agent')
    });
    
    res.status(429).json({
      success: false,
      error: '请求过于频繁，请稍后再试',
      retryAfter: Math.ceil(config.security.rateLimitWindowMs / 1000),
      limit: config.security.rateLimitMaxRequests,
      windowMs: config.security.rateLimitWindowMs
    });
  },
  
  // 跳过某些请求的函数
  skip: (req: Request): boolean => {
    // 跳过健康检查请求
    if (req.path === '/health' || req.path === '/api/health') {
      return true;
    }
    
    // 跳过状态检查请求（但仍然记录）
    if (req.path === '/api/tts/status' && req.method === 'GET') {
      return true;
    }
    
    return false;
  }
});

// TTS特定的速率限制器（更严格的限制）
export const ttsRateLimiter = rateLimit({
  windowMs: config.throttle.ttl * 1000, // 转换为毫秒
  max: config.throttle.limit,
  message: {
    success: false,
    error: 'TTS请求过于频繁，请稍后再试',
    retryAfter: config.throttle.ttl
  },
  standardHeaders: true,
  legacyHeaders: false,
  
  keyGenerator: (req: Request): string => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  
  handler: (req: Request, res: Response) => {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    
    logger.warn('[TTS Rate Limiter] TTS请求被限制', {
      clientIP,
      url: req.url,
      method: req.method,
      textLength: req.body?.text?.length || 0
    });
    
    res.status(429).json({
      success: false,
      error: 'TTS请求过于频繁，请稍后再试',
      retryAfter: config.throttle.ttl,
      limit: config.throttle.limit,
      windowMs: config.throttle.ttl * 1000
    });
  }
});

export default rateLimiter;