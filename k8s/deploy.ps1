# Streaming TTS Service Kubernetes Deployment Script (PowerShell)
# Usage: .\deploy.ps1 [deploy|delete|status|logs|health|port-forward|update|scale]

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('deploy', 'delete', 'status', 'logs', 'health', 'port-forward', 'pf', 'update', 'scale')]
    [string]$Action,
    
    [Parameter(Mandatory=$false)]
    [int]$Replicas
)

# Configuration
$Namespace = "default"
$ServiceName = "streaming-tts-service"
$K8sDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Functions
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if kubectl is available
function Test-Kubectl {
    try {
        kubectl version --client --short | Out-Null
        return $true
    }
    catch {
        Write-Error "kubectl is not installed or not in PATH"
        return $false
    }
}

# Check if cluster is accessible
function Test-Cluster {
    try {
        kubectl cluster-info | Out-Null
        return $true
    }
    catch {
        Write-Error "Cannot connect to Kubernetes cluster"
        return $false
    }
}

# Deploy function
function Deploy-Service {
    Write-Info "Starting deployment of $ServiceName..."
    
    # Check if secrets exist
    try {
        kubectl get secret streaming-tts-secrets -n $Namespace | Out-Null
    }
    catch {
        Write-Warning "Secret 'streaming-tts-secrets' not found. Please create it first:"
        Write-Host "kubectl create secret generic streaming-tts-secrets ``" -ForegroundColor Cyan
        Write-Host "  --from-literal=coze-api-token=your-coze-api-token ``" -ForegroundColor Cyan
        Write-Host "  --from-literal=coze-voice-id=your-voice-id ``" -ForegroundColor Cyan
        Write-Host "  -n $Namespace" -ForegroundColor Cyan
        
        $continue = Read-Host "Do you want to continue anyway? (y/N)"
        if ($continue -ne 'y' -and $continue -ne 'Y') {
            exit 1
        }
    }
    
    # Apply configurations
    Write-Info "Applying ConfigMap..."
    kubectl apply -f "$K8sDir\configmap.yaml" -n $Namespace
    
    Write-Info "Applying Deployment..."
    kubectl apply -f "$K8sDir\deployment.yaml" -n $Namespace
    
    Write-Info "Applying Service..."
    kubectl apply -f "$K8sDir\service.yaml" -n $Namespace
    
    Write-Info "Applying HPA..."
    kubectl apply -f "$K8sDir\hpa.yaml" -n $Namespace
    
    # Wait for deployment to be ready
    Write-Info "Waiting for deployment to be ready..."
    kubectl rollout status deployment/$ServiceName -n $Namespace --timeout=300s
    
    Write-Success "Deployment completed successfully!"
    
    # Show status
    Show-Status
}

# Delete function
function Remove-Service {
    Write-Info "Deleting $ServiceName..."
    
    kubectl delete -f "$K8sDir\hpa.yaml" -n $Namespace --ignore-not-found=true
    kubectl delete -f "$K8sDir\service.yaml" -n $Namespace --ignore-not-found=true
    kubectl delete -f "$K8sDir\deployment.yaml" -n $Namespace --ignore-not-found=true
    kubectl delete -f "$K8sDir\configmap.yaml" -n $Namespace --ignore-not-found=true
    
    Write-Success "$ServiceName deleted successfully!"
}

# Status function
function Show-Status {
    Write-Info "Current status of $ServiceName:"
    
    Write-Host "`nPods:" -ForegroundColor Blue
    kubectl get pods -l app=$ServiceName -n $Namespace -o wide
    
    Write-Host "`nServices:" -ForegroundColor Blue
    kubectl get svc -l app=$ServiceName -n $Namespace
    
    Write-Host "`nDeployment:" -ForegroundColor Blue
    kubectl get deployment $ServiceName -n $Namespace
    
    Write-Host "`nHPA:" -ForegroundColor Blue
    try {
        kubectl get hpa "$ServiceName-hpa" -n $Namespace
    }
    catch {
        Write-Host "HPA not found"
    }
    
    Write-Host "`nConfigMap:" -ForegroundColor Blue
    try {
        kubectl get configmap streaming-tts-config -n $Namespace
    }
    catch {
        Write-Host "ConfigMap not found"
    }
    
    Write-Host "`nSecrets:" -ForegroundColor Blue
    try {
        kubectl get secret streaming-tts-secrets -n $Namespace
    }
    catch {
        Write-Host "Secret not found"
    }
}

# Logs function
function Show-Logs {
    Write-Info "Showing logs for $ServiceName..."
    kubectl logs -l app=$ServiceName -n $Namespace --tail=100 -f
}

# Health check function
function Test-Health {
    Write-Info "Performing health check..."
    
    # Get pod name
    try {
        $podName = kubectl get pods -l app=$ServiceName -n $Namespace -o jsonpath='{.items[0].metadata.name}'
        
        if ([string]::IsNullOrEmpty($podName)) {
            Write-Error "No pods found for $ServiceName"
            return $false
        }
        
        # Check health endpoint
        kubectl exec $podName -n $Namespace -- curl -s http://localhost:3004/health | Out-Null
        Write-Success "Health check passed"
        return $true
    }
    catch {
        Write-Error "Health check failed"
        return $false
    }
}

# Port forward function
function Start-PortForward {
    Write-Info "Setting up port forwarding..."
    Write-Info "Service will be available at http://localhost:3004"
    Write-Info "Press Ctrl+C to stop port forwarding"
    kubectl port-forward svc/$ServiceName 3004:3004 -n $Namespace
}

# Update function
function Update-Service {
    Write-Info "Updating $ServiceName..."
    
    # Apply updated configurations
    kubectl apply -f "$K8sDir\configmap.yaml" -n $Namespace
    kubectl apply -f "$K8sDir\deployment.yaml" -n $Namespace
    kubectl apply -f "$K8sDir\service.yaml" -n $Namespace
    kubectl apply -f "$K8sDir\hpa.yaml" -n $Namespace
    
    # Wait for rollout
    kubectl rollout status deployment/$ServiceName -n $Namespace --timeout=300s
    
    Write-Success "Update completed successfully!"
}

# Scale function
function Set-Scale {
    param([int]$ReplicaCount)
    
    if ($ReplicaCount -le 0) {
        Write-Error "Please specify a valid number of replicas"
        return
    }
    
    Write-Info "Scaling $ServiceName to $ReplicaCount replicas..."
    
    kubectl scale deployment $ServiceName --replicas=$ReplicaCount -n $Namespace
    kubectl rollout status deployment/$ServiceName -n $Namespace
    
    Write-Success "Scaling completed successfully!"
}

# Main script
if (-not (Test-Kubectl)) {
    exit 1
}

if (-not (Test-Cluster)) {
    exit 1
}

switch ($Action) {
    'deploy' {
        Deploy-Service
    }
    'delete' {
        Remove-Service
    }
    'status' {
        Show-Status
    }
    'logs' {
        Show-Logs
    }
    'health' {
        Test-Health
    }
    { $_ -in 'port-forward', 'pf' } {
        Start-PortForward
    }
    'update' {
        Update-Service
    }
    'scale' {
        if ($Replicas -eq 0) {
            Write-Error "Please specify the number of replicas: .\deploy.ps1 scale -Replicas <number>"
            exit 1
        }
        Set-Scale -ReplicaCount $Replicas
    }
    default {
        Write-Host "Usage: .\deploy.ps1 -Action <action> [-Replicas <number>]" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Actions:" -ForegroundColor Cyan
        Write-Host "  deploy       - Deploy the service to Kubernetes"
        Write-Host "  delete       - Delete the service from Kubernetes"
        Write-Host "  status       - Show current status of the service"
        Write-Host "  logs         - Show and follow logs"
        Write-Host "  health       - Perform health check"
        Write-Host "  port-forward - Set up port forwarding to local machine"
        Write-Host "  update       - Update the service with latest configurations"
        Write-Host "  scale        - Scale the service to n replicas"
        Write-Host ""
        Write-Host "Examples:" -ForegroundColor Green
        Write-Host "  .\deploy.ps1 -Action deploy"
        Write-Host "  .\deploy.ps1 -Action status"
        Write-Host "  .\deploy.ps1 -Action scale -Replicas 5"
        Write-Host "  .\deploy.ps1 -Action port-forward"
    }
}