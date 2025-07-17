import startServer from './server';

// 启动服务器
startServer().catch((error) => {
  console.error('服务器启动失败:', error);
  process.exit(1);
});