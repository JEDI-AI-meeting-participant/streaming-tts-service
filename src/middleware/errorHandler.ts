import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// 错误接口定义
interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

// 创建应用错误
export class ApplicationError extends Error implements AppError {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    // 确保堆栈跟踪正确
    Error.captureStackTrace(this, this.constructor);
  }
}

// 异步错误处理包装器
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// 404 错误处理中间件
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new ApplicationError(`路由 ${req.originalUrl} 未找到`, 404);
  next(error);
};

// 全局错误处理中间件
export const errorHandler = (err: AppError, req: Request, res: Response, next: NextFunction): void => {
  let error = { ...err };
  error.message = err.message;

  // 记录错误日志
  logger.error('[Error Handler] 捕获到错误:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body,
    params: req.params,
    query: req.query
  });

  // 默认错误状态码
  let statusCode = error.statusCode || 500;
  let message = error.message || '服务器内部错误';

  // 处理特定类型的错误
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = '请求参数验证失败';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = '资源未找到';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = '无效的访问令牌';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = '访问令牌已过期';
  } else if (err.name === 'MongoError' && err.message.includes('duplicate key')) {
    statusCode = 400;
    message = '资源已存在';
  }

  // 构建错误响应
  const errorResponse: any = {
    success: false,
    error: message,
    statusCode
  };

  // 在开发环境中包含更多错误信息
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
    errorResponse.details = {
      name: err.name,
      originalMessage: err.message
    };
  }

  // 发送错误响应
  res.status(statusCode).json(errorResponse);
};

// 处理未捕获的Promise拒绝
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('[Error Handler] 未处理的Promise拒绝:', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString()
  });
  
  // 优雅关闭服务器
  process.exit(1);
});

// 处理未捕获的异常
process.on('uncaughtException', (error: Error) => {
  logger.error('[Error Handler] 未捕获的异常:', {
    message: error.message,
    stack: error.stack
  });
  
  // 优雅关闭服务器
  process.exit(1);
});

export default errorHandler;