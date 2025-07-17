import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { StreamingTTSService } from '../services/StreamingTTSService';
import { logger } from '../utils/logger';
import config from '../config';

// 创建TTS服务实例
const ttsService = new StreamingTTSService({
  token: config.coze.apiToken,
  wsUrl: config.coze.wsUrl,
  voiceId: config.coze.voiceId,
  enabled: true,
  sampleRate: config.audio.sampleRate,
  channels: config.audio.channels,
  speed: config.audio.speed,
  format: config.audio.format
});

// 验证规则
export const synthesizeValidation = [
  body('text')
    .notEmpty()
    .withMessage('文本不能为空')
    .isLength({ min: 1, max: 5000 })
    .withMessage('文本长度必须在1-5000字符之间'),
  body('sessionId')
    .optional()
    .isString()
    .withMessage('sessionId必须是字符串'),
  body('voiceId')
    .optional()
    .isString()
    .withMessage('voiceId必须是字符串'),
  body('speed')
    .optional()
    .isFloat({ min: 0.5, max: 2.0 })
    .withMessage('语速必须在0.5-2.0之间')
];

// 语音合成接口
export const synthesize = async (req: Request, res: Response): Promise<void> => {
  try {
    // 验证请求参数
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: '请求参数验证失败',
        details: errors.array()
      });
      return;
    }

    const { text, sessionId, voiceId, speed } = req.body;
    
    logger.info('[TTS Controller] 收到语音合成请求', {
      textLength: text.length,
      sessionId,
      voiceId,
      speed,
      clientIP: req.ip
    });

    // 更新配置（如果提供了可选参数）
    if (voiceId || speed) {
      const currentConfig = ttsService.getConfig();
      ttsService.updateConfig({
        ...currentConfig,
        ...(voiceId && { voiceId }),
        ...(speed && { speed })
      });
    }

    // 开始语音合成
    const startTime = Date.now();
    const audioData = await ttsService.synthesizeText(text, sessionId);
    const duration = Date.now() - startTime;

    logger.info('[TTS Controller] 语音合成完成', {
      sessionId,
      audioSize: audioData.length,
      duration: `${duration}ms`,
      textLength: text.length
    });

    // 设置响应头
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', audioData.length.toString());
    res.setHeader('Content-Disposition', `attachment; filename="tts_${sessionId || Date.now()}.wav"`);
    
    // 添加自定义响应头
    res.setHeader('X-TTS-Session-ID', sessionId || 'unknown');
    res.setHeader('X-TTS-Duration', duration.toString());
    res.setHeader('X-TTS-Audio-Size', audioData.length.toString());

    // 返回音频数据
    res.status(200).send(audioData);
  } catch (error) {
    logger.error('[TTS Controller] 语音合成失败:', error);
    
    res.status(500).json({
      success: false,
      error: '语音合成失败',
      message: error instanceof Error ? error.message : '未知错误',
      sessionId: req.body?.sessionId
    });
  }
};

// 流式语音合成接口（Server-Sent Events）
export const synthesizeStream = async (req: Request, res: Response): Promise<void> => {
  try {
    // 验证请求参数
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: '请求参数验证失败',
        details: errors.array()
      });
      return;
    }

    const { text, sessionId, voiceId, speed } = req.body;
    
    logger.info('[TTS Controller] 收到流式语音合成请求', {
      textLength: text.length,
      sessionId,
      clientIP: req.ip
    });

    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // 发送连接确认
    res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);

    // 更新配置（如果提供了可选参数）
    if (voiceId || speed) {
      const currentConfig = ttsService.getConfig();
      ttsService.updateConfig({
        ...currentConfig,
        ...(voiceId && { voiceId }),
        ...(speed && { speed })
      });
    }

    // 监听音频块事件
    const onAudioChunk = (data: any) => {
      const chunk = {
        type: 'audioChunk',
        sessionId: data.sessionId,
        size: data.size,
        data: data.data.toString('base64')
      };
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    };

    // 监听完成事件
    const onComplete = (data: any) => {
      const complete = {
        type: 'complete',
        sessionId: data.sessionId,
        totalSize: data.audioData.length
      };
      res.write(`data: ${JSON.stringify(complete)}\n\n`);
      res.end();
      
      // 清理事件监听器
      ttsService.off('audioChunk', onAudioChunk);
      ttsService.off('complete', onComplete);
      ttsService.off('error', onError);
    };

    // 监听错误事件
    const onError = (error: any) => {
      const errorData = {
        type: 'error',
        sessionId,
        error: error.message || '语音合成失败'
      };
      res.write(`data: ${JSON.stringify(errorData)}\n\n`);
      res.end();
      
      // 清理事件监听器
      ttsService.off('audioChunk', onAudioChunk);
      ttsService.off('complete', onComplete);
      ttsService.off('error', onError);
    };

    // 注册事件监听器
    ttsService.on('audioChunk', onAudioChunk);
    ttsService.on('complete', onComplete);
    ttsService.on('error', onError);

    // 处理客户端断开连接
    req.on('close', () => {
      logger.info('[TTS Controller] 客户端断开连接，停止语音合成', { sessionId });
      ttsService.stopSynthesis();
      
      // 清理事件监听器
      ttsService.off('audioChunk', onAudioChunk);
      ttsService.off('complete', onComplete);
      ttsService.off('error', onError);
    });

    // 开始语音合成
    await ttsService.synthesizeText(text, sessionId);
  } catch (error) {
    logger.error('[TTS Controller] 流式语音合成失败:', error);
    
    const errorData = {
      type: 'error',
      sessionId: req.body?.sessionId,
      error: error instanceof Error ? error.message : '未知错误'
    };
    res.write(`data: ${JSON.stringify(errorData)}\n\n`);
    res.end();
  }
};

// 停止语音合成
export const stopSynthesis = async (req: Request, res: Response): Promise<void> => {
  try {
    await ttsService.stopSynthesis();
    
    logger.info('[TTS Controller] 语音合成已停止', {
      clientIP: req.ip
    });
    
    res.json({
      success: true,
      message: '语音合成已停止'
    });
  } catch (error) {
    logger.error('[TTS Controller] 停止语音合成失败:', error);
    
    res.status(500).json({
      success: false,
      error: '停止语音合成失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
};

// 获取服务状态
export const getStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = {
      success: true,
      data: {
        isProcessing: ttsService.getIsProcessing(),
        isSupported: ttsService.isSupported(),
        config: {
          enabled: ttsService.getConfig().enabled,
          sampleRate: ttsService.getConfig().sampleRate,
          channels: ttsService.getConfig().channels,
          speed: ttsService.getConfig().speed,
          format: ttsService.getConfig().format
        }
      }
    };
    
    res.json(status);
  } catch (error) {
    logger.error('[TTS Controller] 获取服务状态失败:', error);
    
    res.status(500).json({
      success: false,
      error: '获取服务状态失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
};

// 更新配置
export const updateConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { voiceId, speed, enabled } = req.body;
    
    const currentConfig = ttsService.getConfig();
    const newConfig = {
      ...currentConfig,
      ...(voiceId && { voiceId }),
      ...(speed && { speed }),
      ...(enabled !== undefined && { enabled })
    };
    
    ttsService.updateConfig(newConfig);
    
    logger.info('[TTS Controller] 配置已更新', {
      newConfig,
      clientIP: req.ip
    });
    
    res.json({
      success: true,
      message: '配置已更新',
      config: ttsService.getConfig()
    });
  } catch (error) {
    logger.error('[TTS Controller] 更新配置失败:', error);
    
    res.status(500).json({
      success: false,
      error: '更新配置失败',
      message: error instanceof Error ? error.message : '未知错误'
    });
  }
};