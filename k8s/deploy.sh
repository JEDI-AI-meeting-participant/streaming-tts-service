#!/bin/bash

# Streaming TTS Service Kubernetes Deployment Script
# Usage: ./deploy.sh [deploy|delete|status|logs]

set -e

# Configuration
NAMESPACE="default"
SERVICE_NAME="streaming-tts-service"
K8S_DIR="$(dirname "$0")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if kubectl is available
check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
}

# Check if cluster is accessible
check_cluster() {
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
}

# Deploy function
deploy() {
    log_info "Starting deployment of $SERVICE_NAME..."
    
    # Check if secrets exist
    if ! kubectl get secret streaming-tts-secrets -n $NAMESPACE &> /dev/null; then
        log_warning "Secret 'streaming-tts-secrets' not found. Please create it first:"
        echo "kubectl create secret generic streaming-tts-secrets \\"
        echo "  --from-literal=coze-api-token=your-coze-api-token \\"
        echo "  --from-literal=coze-voice-id=your-voice-id \\"
        echo "  -n $NAMESPACE"
        read -p "Do you want to continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    # Apply configurations
    log_info "Applying ConfigMap..."
    kubectl apply -f "$K8S_DIR/configmap.yaml" -n $NAMESPACE
    
    log_info "Applying Deployment..."
    kubectl apply -f "$K8S_DIR/deployment.yaml" -n $NAMESPACE
    
    log_info "Applying Service..."
    kubectl apply -f "$K8S_DIR/service.yaml" -n $NAMESPACE
    
    log_info "Applying HPA..."
    kubectl apply -f "$K8S_DIR/hpa.yaml" -n $NAMESPACE
    
    # Wait for deployment to be ready
    log_info "Waiting for deployment to be ready..."
    kubectl rollout status deployment/$SERVICE_NAME -n $NAMESPACE --timeout=300s
    
    log_success "Deployment completed successfully!"
    
    # Show status
    show_status
}

# Delete function
delete() {
    log_info "Deleting $SERVICE_NAME..."
    
    kubectl delete -f "$K8S_DIR/hpa.yaml" -n $NAMESPACE --ignore-not-found=true
    kubectl delete -f "$K8S_DIR/service.yaml" -n $NAMESPACE --ignore-not-found=true
    kubectl delete -f "$K8S_DIR/deployment.yaml" -n $NAMESPACE --ignore-not-found=true
    kubectl delete -f "$K8S_DIR/configmap.yaml" -n $NAMESPACE --ignore-not-found=true
    
    log_success "$SERVICE_NAME deleted successfully!"
}

# Status function
show_status() {
    log_info "Current status of $SERVICE_NAME:"
    
    echo -e "\n${BLUE}Pods:${NC}"
    kubectl get pods -l app=$SERVICE_NAME -n $NAMESPACE -o wide
    
    echo -e "\n${BLUE}Services:${NC}"
    kubectl get svc -l app=$SERVICE_NAME -n $NAMESPACE
    
    echo -e "\n${BLUE}Deployment:${NC}"
    kubectl get deployment $SERVICE_NAME -n $NAMESPACE
    
    echo -e "\n${BLUE}HPA:${NC}"
    kubectl get hpa ${SERVICE_NAME}-hpa -n $NAMESPACE 2>/dev/null || echo "HPA not found"
    
    echo -e "\n${BLUE}ConfigMap:${NC}"
    kubectl get configmap streaming-tts-config -n $NAMESPACE 2>/dev/null || echo "ConfigMap not found"
    
    echo -e "\n${BLUE}Secrets:${NC}"
    kubectl get secret streaming-tts-secrets -n $NAMESPACE 2>/dev/null || echo "Secret not found"
}

# Logs function
show_logs() {
    log_info "Showing logs for $SERVICE_NAME..."
    kubectl logs -l app=$SERVICE_NAME -n $NAMESPACE --tail=100 -f
}

# Health check function
health_check() {
    log_info "Performing health check..."
    
    # Get pod name
    POD_NAME=$(kubectl get pods -l app=$SERVICE_NAME -n $NAMESPACE -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    
    if [ -z "$POD_NAME" ]; then
        log_error "No pods found for $SERVICE_NAME"
        return 1
    fi
    
    # Check health endpoint
    if kubectl exec $POD_NAME -n $NAMESPACE -- curl -s http://localhost:3004/health > /dev/null; then
        log_success "Health check passed"
    else
        log_error "Health check failed"
        return 1
    fi
}

# Port forward function
port_forward() {
    log_info "Setting up port forwarding..."
    log_info "Service will be available at http://localhost:3004"
    log_info "Press Ctrl+C to stop port forwarding"
    kubectl port-forward svc/$SERVICE_NAME 3004:3004 -n $NAMESPACE
}

# Update function
update() {
    log_info "Updating $SERVICE_NAME..."
    
    # Apply updated configurations
    kubectl apply -f "$K8S_DIR/configmap.yaml" -n $NAMESPACE
    kubectl apply -f "$K8S_DIR/deployment.yaml" -n $NAMESPACE
    kubectl apply -f "$K8S_DIR/service.yaml" -n $NAMESPACE
    kubectl apply -f "$K8S_DIR/hpa.yaml" -n $NAMESPACE
    
    # Wait for rollout
    kubectl rollout status deployment/$SERVICE_NAME -n $NAMESPACE --timeout=300s
    
    log_success "Update completed successfully!"
}

# Scale function
scale() {
    if [ -z "$2" ]; then
        log_error "Please specify the number of replicas: ./deploy.sh scale <replicas>"
        exit 1
    fi
    
    REPLICAS=$2
    log_info "Scaling $SERVICE_NAME to $REPLICAS replicas..."
    
    kubectl scale deployment $SERVICE_NAME --replicas=$REPLICAS -n $NAMESPACE
    kubectl rollout status deployment/$SERVICE_NAME -n $NAMESPACE
    
    log_success "Scaling completed successfully!"
}

# Main script
check_kubectl
check_cluster

case "$1" in
    deploy)
        deploy
        ;;
    delete)
        delete
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    health)
        health_check
        ;;
    port-forward|pf)
        port_forward
        ;;
    update)
        update
        ;;
    scale)
        scale "$@"
        ;;
    *)
        echo "Usage: $0 {deploy|delete|status|logs|health|port-forward|update|scale}"
        echo ""
        echo "Commands:"
        echo "  deploy       - Deploy the service to Kubernetes"
        echo "  delete       - Delete the service from Kubernetes"
        echo "  status       - Show current status of the service"
        echo "  logs         - Show and follow logs"
        echo "  health       - Perform health check"
        echo "  port-forward - Set up port forwarding to local machine"
        echo "  update       - Update the service with latest configurations"
        echo "  scale <n>    - Scale the service to n replicas"
        echo ""
        echo "Examples:"
        echo "  $0 deploy"
        echo "  $0 status"
        echo "  $0 scale 5"
        echo "  $0 port-forward"
        exit 1
        ;;
esac