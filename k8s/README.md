# Streaming TTS Service - Kubernetes 部署

本目录包含了 Streaming TTS Service 的完整 Kubernetes 部署配置文件和脚本。

## 📁 文件结构

```
k8s/
├── configmap.yaml      # 配置映射
├── deployment.yaml     # 部署配置
├── service.yaml        # 服务配置
├── hpa.yaml           # 水平自动扩缩容
├── deploy.sh          # Linux/macOS 部署脚本
├── deploy.ps1         # Windows PowerShell 部署脚本
└── README.md          # 本文件
```

## 🚀 快速部署

### 前置条件

1. **Kubernetes 集群**: 确保有可访问的 Kubernetes 集群
2. **kubectl**: 已安装并配置好 kubectl
3. **权限**: 具有在目标命名空间创建资源的权限

### 创建 Secret

在部署之前，需要创建包含敏感信息的 Secret：

```bash
kubectl create secret generic streaming-tts-secrets \
  --from-literal=coze-api-token=your-actual-coze-api-token \
  --from-literal=coze-voice-id=your-actual-voice-id \
  -n default
```

### 使用部署脚本

#### Linux/macOS

```bash
# 给脚本执行权限
chmod +x deploy.sh

# 部署服务
./deploy.sh deploy

# 查看状态
./deploy.sh status

# 查看日志
./deploy.sh logs

# 端口转发（用于本地访问）
./deploy.sh port-forward
```

#### Windows PowerShell

```powershell
# 部署服务
.\deploy.ps1 -Action deploy

# 查看状态
.\deploy.ps1 -Action status

# 查看日志
.\deploy.ps1 -Action logs

# 端口转发（用于本地访问）
.\deploy.ps1 -Action port-forward
```

### 手动部署

如果不使用脚本，可以手动执行以下命令：

```bash
# 1. 应用配置映射
kubectl apply -f configmap.yaml

# 2. 应用部署
kubectl apply -f deployment.yaml

# 3. 应用服务
kubectl apply -f service.yaml

# 4. 应用自动扩缩容
kubectl apply -f hpa.yaml

# 5. 检查部署状态
kubectl rollout status deployment/streaming-tts-service
```

## 📊 监控和管理

### 查看资源状态

```bash
# 查看 Pod 状态
kubectl get pods -l app=streaming-tts-service

# 查看服务状态
kubectl get svc -l app=streaming-tts-service

# 查看部署状态
kubectl get deployment streaming-tts-service

# 查看 HPA 状态
kubectl get hpa streaming-tts-service-hpa
```

### 查看日志

```bash
# 查看所有 Pod 日志
kubectl logs -l app=streaming-tts-service

# 实时跟踪日志
kubectl logs -l app=streaming-tts-service -f

# 查看特定 Pod 日志
kubectl logs <pod-name>
```

### 健康检查

```bash
# 检查健康状态
kubectl get pods -l app=streaming-tts-service -o wide

# 手动健康检查
kubectl exec <pod-name> -- curl http://localhost:3004/health
```

## 🔧 配置说明

### ConfigMap (configmap.yaml)

包含所有非敏感的环境变量：
- 服务端口和环境
- WebSocket 配置
- 音频处理参数
- 日志级别
- 性能调优参数

### Deployment (deployment.yaml)

定义了：
- **副本数**: 默认 2 个
- **资源限制**: CPU 200m-500m, 内存 256Mi-512Mi
- **健康检查**: 存活和就绪探针
- **环境变量**: 从 ConfigMap 和 Secret 加载

### Service (service.yaml)

提供三种服务类型：
- **ClusterIP**: 集群内部访问
- **NodePort**: 通过节点端口访问 (30004)
- **LoadBalancer**: 通过负载均衡器访问

### HPA (hpa.yaml)

自动扩缩容配置：
- **最小副本**: 2
- **最大副本**: 10
- **CPU 阈值**: 70%
- **内存阈值**: 80%

## 🔄 扩缩容管理

### 手动扩缩容

```bash
# 扩容到 5 个副本
kubectl scale deployment streaming-tts-service --replicas=5

# 使用脚本扩缩容
./deploy.sh scale 5
# 或 Windows
.\deploy.ps1 -Action scale -Replicas 5
```

### 自动扩缩容

HPA 会根据 CPU 和内存使用率自动调整副本数：

```bash
# 查看 HPA 状态
kubectl get hpa streaming-tts-service-hpa

# 查看 HPA 详细信息
kubectl describe hpa streaming-tts-service-hpa
```

## 🔄 更新和回滚

### 更新部署

```bash
# 更新镜像
kubectl set image deployment/streaming-tts-service \
  streaming-tts-service=streaming-tts-service:new-version

# 使用脚本更新
./deploy.sh update
```

### 回滚部署

```bash
# 查看部署历史
kubectl rollout history deployment/streaming-tts-service

# 回滚到上一版本
kubectl rollout undo deployment/streaming-tts-service

# 回滚到指定版本
kubectl rollout undo deployment/streaming-tts-service --to-revision=2
```

## 🌐 访问服务

### 集群内访问

```bash
# 通过 ClusterIP 服务访问
http://streaming-tts-service:3004
```

### 外部访问

#### 通过 NodePort

```bash
# 获取节点 IP 和端口
kubectl get nodes -o wide
kubectl get svc streaming-tts-service-nodeport

# 访问服务
http://<node-ip>:30004
```

#### 通过 LoadBalancer

```bash
# 获取外部 IP
kubectl get svc streaming-tts-service-lb

# 访问服务
http://<external-ip>
```

#### 通过端口转发

```bash
# 设置端口转发
kubectl port-forward svc/streaming-tts-service 3004:3004

# 访问服务
http://localhost:3004
```

## 🗑️ 清理资源

### 删除服务

```bash
# 使用脚本删除
./deploy.sh delete
# 或 Windows
.\deploy.ps1 -Action delete

# 手动删除
kubectl delete -f .
```

### 删除 Secret

```bash
kubectl delete secret streaming-tts-secrets
```

## 🔍 故障排除

### 常见问题

1. **Pod 启动失败**
   ```bash
   kubectl describe pod <pod-name>
   kubectl logs <pod-name>
   ```

2. **健康检查失败**
   ```bash
   kubectl exec <pod-name> -- curl http://localhost:3004/health
   ```

3. **Secret 不存在**
   ```bash
   kubectl get secret streaming-tts-secrets
   ```

4. **资源不足**
   ```bash
   kubectl top nodes
   kubectl top pods
   ```

### 调试命令

```bash
# 进入 Pod 调试
kubectl exec -it <pod-name> -- /bin/sh

# 查看事件
kubectl get events --sort-by=.metadata.creationTimestamp

# 查看资源使用
kubectl top pods -l app=streaming-tts-service
```

## 📈 性能优化

### 资源调优

根据实际负载调整资源配置：

```yaml
resources:
  requests:
    memory: "512Mi"  # 增加内存请求
    cpu: "300m"      # 增加 CPU 请求
  limits:
    memory: "1Gi"    # 增加内存限制
    cpu: "1000m"     # 增加 CPU 限制
```

### HPA 调优

调整自动扩缩容参数：

```yaml
spec:
  minReplicas: 3      # 增加最小副本数
  maxReplicas: 20     # 增加最大副本数
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 60  # 降低 CPU 阈值
```

## 🔒 安全最佳实践

1. **使用非 root 用户**: Dockerfile 中已配置
2. **资源限制**: 防止资源耗尽
3. **网络策略**: 限制网络访问
4. **Secret 管理**: 使用 Kubernetes Secret
5. **镜像安全**: 定期更新基础镜像

## 📚 相关文档

- [Kubernetes 官方文档](https://kubernetes.io/docs/)
- [kubectl 命令参考](https://kubernetes.io/docs/reference/kubectl/)
- [HPA 文档](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [服务发现文档](https://kubernetes.io/docs/concepts/services-networking/service/)