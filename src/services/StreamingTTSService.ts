// 流式TTS服务 - 基于Coze WebSocket API实现边合成边推流
import { EventEmitter } from 'events';
import WebSocket from 'ws';
import axios from 'axios';
import { logger } from '../utils/logger';

// 流式TTS配置接口
interface StreamingTTSConfig {
  token: string;
  wsUrl: string;
  voiceId: string;
  enabled: boolean;
  sampleRate: number;
  channels: number;
  speed: number;
  format: string;
}

// 默认配置
const DEFAULT_CONFIG: StreamingTTSConfig = {
  token: '',
  wsUrl: 'wss://ws.coze.cn',
  voiceId: '',
  enabled: true,
  sampleRate: 24000,
  channels: 1,
  speed: 1.0,
  format: 'pcm'
};

export class StreamingTTSService extends EventEmitter {
  private config: StreamingTTSConfig;
  private isProcessing: boolean = false;
  private wsClient: WebSocket | null = null;
  private audioChunks: Buffer[] = [];
  private currentSessionId: string | null = null;

  constructor(config?: Partial<StreamingTTSConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    logger.info('[StreamingTTSService] 服务初始化完成', {
      wsUrl: this.config.wsUrl,
      voiceId: this.config.voiceId || '(默认)',
      sampleRate: this.config.sampleRate,
      channels: this.config.channels,
      speed: this.config.speed
    });
  }

  // 初始化WebSocket客户端
  private initializeWebSocketClient(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.config.token) {
        reject(new Error('缺少Coze API令牌'));
        return;
      }

      if (!this.config.voiceId) {
        reject(new Error('缺少音色ID'));
        return;
      }

      logger.info('[StreamingTTSService] 初始化WebSocket客户端');

      try {
        const wsUrl = `${this.config.wsUrl}/tts?token=${this.config.token}&voice_id=${this.config.voiceId}`;
        this.wsClient = new WebSocket(wsUrl);
        
        this.wsClient.on('open', () => {
          logger.info('[StreamingTTSService] WebSocket连接已建立');
          resolve();
        });
        
        this.wsClient.on('message', (data: Buffer) => {
          this.handleWebSocketMessage(data);
        });
        
        this.wsClient.on('error', (error) => {
          logger.error('[StreamingTTSService] WebSocket错误:', error);
          this.emit('error', error);
          reject(error);
        });
        
        this.wsClient.on('close', () => {
          logger.info('[StreamingTTSService] WebSocket连接已关闭');
          this.isProcessing = false;
          this.wsClient = null;
        });
        
      } catch (error) {
        logger.error('[StreamingTTSService] WebSocket客户端初始化失败:', error);
        reject(error);
      }
    });
  }

  // 处理WebSocket消息
  private handleWebSocketMessage(data: Buffer): void {
    try {
      // 尝试解析为JSON消息
      const message = data.toString();
      if (message.startsWith('{')) {
        const msg = JSON.parse(message);
        const eventType = msg.event_type;
        
        if (eventType === 'speech.audio.update' || eventType === 'speech.audio.chunk') {
          // 提取音频数据
          const b64 = msg.data?.delta
                   ?? msg.data?.output_audio?.data
                   ?? msg.data?.data
                   ?? '';
          if (b64) {
            this.handleAudioData(b64, msg.data?.pcm_config);
          }
        } else if (eventType === 'speech.completed') {
          logger.info('[StreamingTTSService] 语音合成完成');
          this.handleSynthesisComplete();
        }
      } else {
        // 直接是音频数据
        this.handleAudioData(data);
      }
    } catch (error) {
      logger.error('[StreamingTTSService] 处理WebSocket消息失败:', error);
    }
  }

  // 处理音频数据
  private handleAudioData(data: any, pcmConfig?: any): void {
    try {
      let audioBuffer: Buffer;
      
      // 处理不同格式的音频数据
      if (typeof data === 'string') {
        // Base64格式 - 解码为Buffer
        audioBuffer = Buffer.from(data, 'base64');
      } else if (data instanceof ArrayBuffer) {
        // ArrayBuffer格式
        audioBuffer = Buffer.from(data);
      } else if (Buffer.isBuffer(data)) {
        // 已经是Buffer
        audioBuffer = data;
      } else {
        logger.error('[StreamingTTSService] 不支持的音频数据格式:', typeof data);
        return;
      }

      // 验证数据有效性
      if (audioBuffer.length === 0) {
        logger.warn('[StreamingTTSService] 接收到空的音频数据');
        return;
      }

      // 添加到音频块列表
      this.audioChunks.push(audioBuffer);
      
      logger.debug('[StreamingTTSService] 接收音频数据块:', {
        size: audioBuffer.length,
        totalChunks: this.audioChunks.length,
        totalSize: this.audioChunks.reduce((sum, chunk) => sum + chunk.length, 0)
      });

      // 发送音频数据事件
      this.emit('audioChunk', {
        data: audioBuffer,
        size: audioBuffer.length,
        sessionId: this.currentSessionId
      });
    } catch (error) {
      logger.error('[StreamingTTSService] 处理音频数据失败:', error);
    }
  }

  // 处理合成完成
  private handleSynthesisComplete(): void {
    this.isProcessing = false;
    
    // 合并所有音频块
    const totalAudio = Buffer.concat(this.audioChunks);
    
    logger.info('[StreamingTTSService] 语音合成完成', {
      totalSize: totalAudio.length,
      chunks: this.audioChunks.length,
      sessionId: this.currentSessionId
    });
    
    this.emit('complete', {
      audioData: totalAudio,
      sessionId: this.currentSessionId
    });
    
    // 清理
    this.audioChunks = [];
    this.currentSessionId = null;
  }

  // 合成文本为语音
  async synthesizeText(text: string, sessionId?: string): Promise<Buffer> {
    if (!this.config.enabled) {
      throw new Error('TTS服务已禁用');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('文本为空');
    }

    if (this.isProcessing) {
      throw new Error('正在处理中，请稍后再试');
    }

    return new Promise((resolve, reject) => {
      try {
        this.isProcessing = true;
        this.audioChunks = [];
        this.currentSessionId = sessionId || `session_${Date.now()}`;
        
        logger.info('[StreamingTTSService] 开始流式语音合成:', {
          text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          sessionId: this.currentSessionId
        });

        // 监听完成事件
        const onComplete = (data: any) => {
          this.off('complete', onComplete);
          this.off('error', onError);
          resolve(data.audioData);
        };

        const onError = (error: any) => {
          this.off('complete', onComplete);
          this.off('error', onError);
          this.isProcessing = false;
          reject(error);
        };

        this.on('complete', onComplete);
        this.on('error', onError);

        // 初始化WebSocket客户端并开始合成
        this.initializeWebSocketClient()
          .then(() => {
            // 发送合成请求
            const request = {
              text: text,
              voice_id: this.config.voiceId,
              sample_rate: this.config.sampleRate,
              channels: this.config.channels,
              speed: this.config.speed,
              format: this.config.format
            };
            
            if (this.wsClient && this.wsClient.readyState === WebSocket.OPEN) {
              this.wsClient.send(JSON.stringify(request));
            } else {
              throw new Error('WebSocket连接未就绪');
            }
          })
          .catch(reject);

        this.emit('start', { text, sessionId: this.currentSessionId });
      } catch (error) {
        this.isProcessing = false;
        reject(error);
      }
    });
  }

  // 停止当前合成
  async stopSynthesis(): Promise<void> {
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }
    
    this.isProcessing = false;
    this.audioChunks = [];
    this.currentSessionId = null;
    
    logger.info('[StreamingTTSService] 语音合成已停止');
  }

  // 更新配置
  updateConfig(newConfig: Partial<StreamingTTSConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('[StreamingTTSService] 配置已更新:', this.config);
  }

  // 获取配置
  getConfig(): StreamingTTSConfig {
    return { ...this.config };
  }

  // 获取处理状态
  getIsProcessing(): boolean {
    return this.isProcessing;
  }

  // 设置是否启用
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    logger.info(`[StreamingTTSService] TTS服务${enabled ? '已启用' : '已禁用'}`);
  }

  // 检查是否支持
  isSupported(): boolean {
    return typeof WebSocket !== 'undefined';
  }

  // 清理资源
  async cleanup(): Promise<void> {
    await this.stopSynthesis();
    this.removeAllListeners();
    logger.info('[StreamingTTSService] 资源清理完成');
  }
}