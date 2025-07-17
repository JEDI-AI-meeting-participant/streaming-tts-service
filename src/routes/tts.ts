import { Router } from 'express';
import {
  synthesize,
  synthesizeStream,
  stopSynthesis,
  getStatus,
  updateConfig,
  synthesizeValidation
} from '../controllers/ttsController';
import { rateLimiter } from '../middleware/rateLimiter';
import { errorHandler } from '../middleware/errorHandler';

const router = Router();

// 应用速率限制中间件到所有路由
router.use(rateLimiter);

/**
 * @route POST /api/tts/synthesize
 * @desc 语音合成（返回完整音频文件）
 * @access Public
 * @body {
 *   text: string,           // 要合成的文本（必需）
 *   sessionId?: string,     // 会话ID（可选）
 *   voiceId?: string,       // 语音ID（可选）
 *   speed?: number          // 语速 0.5-2.0（可选）
 * }
 * @returns 音频文件 (audio/wav)
 */
router.post('/synthesize', synthesizeValidation, synthesize);

/**
 * @route POST /api/tts/synthesize-stream
 * @desc 流式语音合成（Server-Sent Events）
 * @access Public
 * @body {
 *   text: string,           // 要合成的文本（必需）
 *   sessionId?: string,     // 会话ID（可选）
 *   voiceId?: string,       // 语音ID（可选）
 *   speed?: number          // 语速 0.5-2.0（可选）
 * }
 * @returns Server-Sent Events stream
 */
router.post('/synthesize-stream', synthesizeValidation, synthesizeStream);

/**
 * @route POST /api/tts/stop
 * @desc 停止当前语音合成
 * @access Public
 * @returns {
 *   success: boolean,
 *   message: string
 * }
 */
router.post('/stop', stopSynthesis);

/**
 * @route GET /api/tts/status
 * @desc 获取TTS服务状态
 * @access Public
 * @returns {
 *   success: boolean,
 *   data: {
 *     isProcessing: boolean,
 *     isSupported: boolean,
 *     config: {
 *       enabled: boolean,
 *       sampleRate: number,
 *       channels: number,
 *       speed: number,
 *       format: string
 *     }
 *   }
 * }
 */
router.get('/status', getStatus);

/**
 * @route PUT /api/tts/config
 * @desc 更新TTS配置
 * @access Public
 * @body {
 *   voiceId?: string,       // 语音ID（可选）
 *   speed?: number,         // 语速（可选）
 *   enabled?: boolean       // 是否启用（可选）
 * }
 * @returns {
 *   success: boolean,
 *   message: string,
 *   config: object
 * }
 */
router.put('/config', updateConfig);

// 应用错误处理中间件
router.use(errorHandler);

export default router;