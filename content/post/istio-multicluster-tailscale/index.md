---
title: Multi-Cluster Istio Service Mesh with Tailscale
description: Deploy a production-ready multi-cluster Istio service mesh using Tailscale for secure east-west gateway connectivity
slug: istio-multicluster-tailscale
date: 2025-01-09 00:00:00+0000
image: cover.png
categories:
    - Kubernetes
    - Tailscale
    - Service Mesh
tags:
    - kubernetes
    - tailscale
    - istio
    - service-mesh
    - multicluster
weight: 4
draft: false
---

Running a multi-cluster Istio service mesh traditionally requires complex networking setup—exposing east-west gateways to the internet or configuring VPN infrastructure. In this guide, I'll show you how to use **Tailscale** to simplify this architecture dramatically while improving security.

By the end, you'll have cross-cluster service discovery, automatic failover, and encrypted service-to-service communication without exposing anything to the public internet.

## Why Tailscale for Istio Multi-Cluster?

Traditional multi-cluster Istio deployments face several challenges:

1. **East-west gateways exposed publicly** - Security risk and additional attack surface
2. **Complex VPN setup** - IPSec tunnels, certificate management, firewall rules
3. **NAT traversal issues** - Corporate networks and cloud providers complicate direct connectivity
4. **Certificate management** - Each cluster needs proper TLS configuration

Tailscale solves all of these by providing:

- **Private mesh network** - Gateways never exposed to the internet
- **Zero-config NAT traversal** - WireGuard-based connections work through any network
- **MagicDNS** - Automatic DNS resolution between clusters
- **Built-in authentication** - Leverage existing Tailscale identity

## Architecture Overview

We're deploying a **multi-primary** Istio topology where each cluster runs its own control plane and discovers services from all clusters in the mesh.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Tailscale Mesh Network                       │
│                                                                     │
│  ┌─────────────────────────┐       ┌─────────────────────────┐     │
│  │       Cluster 1         │       │       Cluster 2         │     │
│  │                         │       │                         │     │
│  │  ┌─────────────────┐    │       │    ┌─────────────────┐  │     │
│  │  │     istiod      │◄───┼───────┼───►│     istiod      │  │     │
│  │  └─────────────────┘    │       │    └─────────────────┘  │     │
│  │          │              │       │            │            │     │
│  │  ┌───────▼───────────┐  │       │  ┌─────────▼─────────┐  │     │
│  │  │ East-West Gateway │◄─┼───────┼─►│ East-West Gateway │  │     │
│  │  │  (Tailscale LB)   │  │       │  │  (Tailscale LB)   │  │     │
│  │  └───────────────────┘  │       │  └───────────────────┘  │     │
│  │                         │       │                         │     │
│  │  ┌─────────────────┐    │       │    ┌─────────────────┐  │     │
│  │  │   k8s-operator  │◄───┼───────┼───►│   k8s-operator  │  │     │
│  │  │ (API Proxy)     │    │       │    │ (API Proxy)     │  │     │
│  │  └─────────────────┘    │       │    └─────────────────┘  │     │
│  └─────────────────────────┘       └─────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
```

Key components:
- **Tailscale Kubernetes Operator** - Provides API server proxy and LoadBalancer class
- **East-West Gateways** - Handle cross-cluster traffic via Tailscale network
- **Istiod** - Control plane discovers services in remote clusters through API proxy

## Prerequisites

- Two or more Kubernetes clusters
- Tailscale account with Admin access
- Helm 3.0+
- OpenSSL for certificate generation
- kubectl configured for each cluster

## Step 1: Install Tailscale Kubernetes Operator

Install the operator in each cluster with the API server proxy enabled. This creates a secure tunnel for Istio control planes to communicate with remote Kubernetes API servers.

**Cluster 1:**
```bash
helm upgrade --install tailscale-operator tailscale/tailscale-operator \
  --namespace=tailscale \
  --create-namespace \
  --set-string oauth.clientId=<YOUR_OAUTH_CLIENT_ID> \
  --set-string oauth.clientSecret=<YOUR_OAUTH_CLIENT_SECRET> \
  --set operatorConfig.hostname=cluster1-k8s-operator \
  --set apiServerProxyConfig.mode=true \
  --wait
```

**Cluster 2:**
```bash
helm upgrade --install tailscale-operator tailscale/tailscale-operator \
  --namespace=tailscale \
  --create-namespace \
  --set-string oauth.clientId=<YOUR_OAUTH_CLIENT_ID> \
  --set-string oauth.clientSecret=<YOUR_OAUTH_CLIENT_SECRET> \
  --set operatorConfig.hostname=cluster2-k8s-operator \
  --set apiServerProxyConfig.mode=true \
  --wait
```

The unique hostnames (`cluster1-k8s-operator`, `cluster2-k8s-operator`) identify each cluster in your tailnet.

## Step 2: Configure Access Control Policies

Add these grants to your tailnet policy file to enable secure communication between clusters:

```json
{
  "tagOwners": {
    "tag:k8s-operator": ["autogroup:admin"],
    "tag:istio-eastwestgateway": ["autogroup:admin"]
  },
  "grants": [
    {
      "src": ["autogroup:admin", "tag:k8s-operator"],
      "dst": ["tag:k8s-operator"],
      "app": {
        "tailscale.com/cap/kubernetes": [
          {
            "impersonate": {
              "groups": ["system:masters"]
            }
          }
        ]
      }
    },
    {
      "src": ["tag:istio-eastwestgateway"],
      "dst": ["tag:istio-eastwestgateway"],
      "ip": ["*"]
    }
  ]
}
```

This configuration:
- **First grant** - Enables API server access for Istio control planes with cluster-admin privileges
- **Second grant** - Allows east-west gateways to communicate with each other

## Step 3: Set Up DNS Resolution

Istio control planes need to resolve Tailscale hostnames (e.g., `cluster1-k8s-operator.tailnet.ts.net`). Create a DNS configuration in each cluster:

```yaml
apiVersion: tailscale.com/v1alpha1
kind: DNSConfig
metadata:
  name: ts-dns
spec:
  nameserver:
    image:
      repo: tailscale/k8s-nameserver
      tag: unstable
```

Apply to both clusters:
```bash
kubectl apply -f dns-config.yaml --context=cluster1
kubectl apply -f dns-config.yaml --context=cluster2
```

Get the nameserver IP and configure CoreDNS to forward `.ts.net` queries:

```bash
kubectl get dnsconfig ts-dns -o jsonpath='{.status.nameserverStatus.ip}'
```

Update CoreDNS configmap in each cluster:
```yaml
your-tailnet.ts.net:53 {
    errors
    cache 30
    forward . <TAILSCALE_NAMESERVER_IP>
}
```

## Step 4: Create Egress Services

In each cluster, create services pointing to remote API servers:

**In Cluster 1** (pointing to Cluster 2):
```yaml
apiVersion: v1
kind: Service
metadata:
  name: cluster2-k8s-operator
  namespace: tailscale
  annotations:
    tailscale.com/tailnet-fqdn: cluster2-k8s-operator.your-tailnet.ts.net
spec:
  externalName: placeholder
  type: ExternalName
  ports:
  - name: https
    port: 443
    protocol: TCP
```

Create the corresponding service in Cluster 2 pointing to Cluster 1.

## Step 5: Install Istio with Multi-Cluster Configuration

### Generate Shared Root CA

First, create a shared certificate authority for mTLS across clusters:

```bash
mkdir -p certs && cd certs
curl -L https://raw.githubusercontent.com/istio/istio/release-1.24/tools/certs/Makefile.selfsigned.mk -o Makefile.selfsigned.mk

# Generate root CA
make -f Makefile.selfsigned.mk root-ca

# Generate intermediate certs for each cluster
make -f Makefile.selfsigned.mk cluster1-cacerts
make -f Makefile.selfsigned.mk cluster2-cacerts
```

Create the `cacerts` secret in each cluster:

```bash
kubectl create namespace istio-system --context=cluster1
kubectl create secret generic cacerts -n istio-system --context=cluster1 \
  --from-file=cluster1/ca-cert.pem \
  --from-file=cluster1/ca-key.pem \
  --from-file=cluster1/root-cert.pem \
  --from-file=cluster1/cert-chain.pem
```

Repeat for cluster2 with its certificates.

### Install Istio

```bash
helm repo add istio https://istio-release.storage.googleapis.com/charts
helm repo update

# Install base CRDs
helm install istio-base istio/base --namespace istio-system --kube-context=cluster1
helm install istio-base istio/base --namespace istio-system --kube-context=cluster2

# Install istiod in cluster1
helm install istiod istio/istiod \
  --namespace istio-system \
  --kube-context=cluster1 \
  --set global.meshID=mesh1 \
  --set global.multiCluster.clusterName=cluster1 \
  --set global.network=cluster1 \
  --wait

# Install istiod in cluster2
helm install istiod istio/istiod \
  --namespace istio-system \
  --kube-context=cluster2 \
  --set global.meshID=mesh1 \
  --set global.multiCluster.clusterName=cluster2 \
  --set global.network=cluster2 \
  --wait
```

## Step 6: Create Remote Secrets

Enable Istio control planes to discover services in remote clusters:

**In Cluster 1** (for accessing Cluster 2):
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: istio-remote-secret-cluster2
  namespace: istio-system
  annotations:
    networking.istio.io/cluster: cluster2
  labels:
    istio/multiCluster: "true"
type: Opaque
stringData:
  cluster2: |
    apiVersion: v1
    clusters:
    - cluster:
        server: https://cluster2-k8s-operator.your-tailnet.ts.net
      name: cluster2
    contexts:
    - context:
        cluster: cluster2
        user: tailscale-auth
      name: cluster2
    current-context: cluster2
    kind: Config
    users:
    - name: tailscale-auth
      user:
        token: unused
```

The `token: unused` placeholder works because Tailscale's application capabilities handle authentication automatically.

## Step 7: Deploy East-West Gateways with Tailscale LoadBalancer

This is where the magic happens. Instead of exposing gateways publicly, we use Tailscale LoadBalancer:

```bash
helm install istio-eastwestgateway istio/gateway \
  --namespace istio-system \
  --kube-context=cluster1 \
  --set name=istio-eastwestgateway \
  --set labels.app=istio-eastwestgateway \
  --set labels.istio=eastwestgateway \
  --set labels.topology.istio.io/network=cluster1 \
  --set networkGateway=cluster1 \
  --set service.type=LoadBalancer \
  --set service.loadBalancerClass=tailscale \
  --set service.annotations."tailscale\.com/hostname"=cluster1-istio-eastwestgateway \
  --set service.annotations."tailscale\.com/tags"=tag:istio-eastwestgateway \
  --set service.ports[0].name=status-port \
  --set service.ports[0].port=15021 \
  --set service.ports[0].targetPort=15021 \
  --set service.ports[1].name=tls \
  --set service.ports[1].port=15443 \
  --set service.ports[1].targetPort=15443 \
  --set service.ports[2].name=tls-istiod \
  --set service.ports[2].port=15012 \
  --set service.ports[2].targetPort=15012 \
  --set service.ports[3].name=tls-webhook \
  --set service.ports[3].port=15017 \
  --set service.ports[3].targetPort=15017 \
  --wait
```

Repeat for cluster2 with updated hostname and network values.

Create the Gateway resource to expose services:

```yaml
apiVersion: networking.istio.io/v1
kind: Gateway
metadata:
  name: cross-network-gateway
  namespace: istio-system
spec:
  selector:
    istio: eastwestgateway
  servers:
  - port:
      number: 15443
      name: tls
      protocol: TLS
    tls:
      mode: AUTO_PASSTHROUGH
    hosts:
    - "*.local"
```

## Step 8: Configure Mesh Networks

Update Istio to know about the network topology:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: istio
  namespace: istio-system
data:
  mesh: |-
    meshNetworks:
      cluster1:
        endpoints:
        - fromRegistry: cluster1
        gateways:
        - address: cluster1-istio-eastwestgateway.your-tailnet.ts.net
          port: 15443
      cluster2:
        endpoints:
        - fromRegistry: cluster2
        gateways:
        - address: cluster2-istio-eastwestgateway.your-tailnet.ts.net
          port: 15443
```

Apply and restart istiod:
```bash
kubectl apply -f mesh-networks.yaml --context=cluster1
kubectl apply -f mesh-networks.yaml --context=cluster2
kubectl rollout restart deployment/istiod -n istio-system --context=cluster1
kubectl rollout restart deployment/istiod -n istio-system --context=cluster2
```

## Verifying the Setup

Check that east-west gateways have Tailscale IPs (100.x.x.x range):

```bash
kubectl get svc istio-eastwestgateway -n istio-system --context=cluster1
```

Deploy a test application in both clusters:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: echo
spec:
  replicas: 1
  selector:
    matchLabels:
      app: echo
  template:
    metadata:
      labels:
        app: echo
    spec:
      containers:
      - name: echo
        image: hashicorp/http-echo
        args: ["-text=cluster1"]  # Use "cluster2" for the other cluster
        ports:
        - containerPort: 5678
---
apiVersion: v1
kind: Service
metadata:
  name: echo
spec:
  ports:
  - port: 80
    targetPort: 5678
  selector:
    app: echo
```

Test cross-cluster load balancing:

```bash
kubectl label namespace default istio-injection=enabled --context=cluster1
kubectl run client --image=curlimages/curl --command -- sleep 3600 --context=cluster1

# After pod is ready
for i in {1..10}; do
  kubectl exec client --context=cluster1 -- curl -s echo.default.svc.cluster.local
done
```

You should see responses from both `cluster1` and `cluster2`, confirming traffic is being routed across clusters through the Tailscale-secured east-west gateways.

## Advanced Configuration: Locality-Based Routing

For production deployments, configure locality-based routing to prefer local endpoints:

```yaml
apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: echo-locality
spec:
  host: echo.default.svc.cluster.local
  trafficPolicy:
    loadBalancer:
      localityLbSetting:
        enabled: true
        distribute:
        - from: region1/zone1/*
          to:
            "region1/zone1/*": 80
            "region2/zone2/*": 20
    outlierDetection:
      consecutiveErrors: 5
      interval: 30s
      baseEjectionTime: 30s
```

This routes 80% of traffic to local endpoints with automatic failover to remote clusters when endpoints become unhealthy.

## Benefits of This Approach

1. **Enhanced Security** - East-west gateways never exposed to the internet
2. **Simplified Networking** - No firewall rules, public load balancers, or VPN configuration
3. **High Availability** - Automatic failover between clusters
4. **Geographic Distribution** - Locality-based routing optimizes latency
5. **Zero-Config NAT Traversal** - Tailscale handles connectivity through any network

## Troubleshooting

### Gateway not getting Tailscale IP
Check that the Tailscale operator is running and ACLs allow the `tag:istio-eastwestgateway` tag.

### Istio can't discover remote services
Verify DNS resolution works:
```bash
kubectl run test --image=curlimages/curl --rm -it -- nslookup cluster2-k8s-operator.your-tailnet.ts.net
```

### mTLS certificate errors
Ensure all clusters use the same root CA:
```bash
kubectl get secret cacerts -n istio-system -o jsonpath='{.data.root-cert\.pem}' | base64 -d
```

## References

- [Tailscale Kubernetes Operator Documentation](https://tailscale.com/kb/1236/kubernetes-operator)
- [Istio Multi-Cluster Documentation](https://istio.io/latest/docs/setup/install/multicluster/)
- [Istio Traffic Management](https://istio.io/latest/docs/tasks/traffic-management/)
