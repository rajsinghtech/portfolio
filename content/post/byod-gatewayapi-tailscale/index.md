---
title: "BYO Domain Gateway API Tailscale Operator"
date: 2025-05-21 00:00:00+0000
draft: false
tags: ["Kubernetes", "Tailscale", "GatewayAPI", "Networking", "DevOps"]
categories: ["Kubernetes", "Tailscale"]
---

While Tailscale excels at making services accessible via its managed `*.ts.net` domain names, using your own custom domain (like `hello.example.com`) for services exposed through the Tailscale Kubernetes operator requires a different approach. Tailscale itself doesn't manage DNS records or issue TLS certificates for domains it doesn't control. This guide presents a robust solution to this by integrating the Kubernetes Gateway API (specifically with Envoy Gateway) with ExternalDNS and CertManager. This combination allows you to seamlessly use your custom domains for services on your tailnet, complete with automated DNS and TLS management.

To showcase this, we will utilize [EnvoyGateway](https://gateway.envoyproxy.io/docs/) in conjunction with Tailscale Operator.
This setup allows ExternalDNS to manage records for your custom domain in an internal DNS server, which Tailscale's MagicDNS then uses to resolve these names across your tailnet.

## Prerequisites

Ensure you have the following components set up and configured:

*   **Kubernetes Cluster:** A running Kubernetes cluster.
*   **Tailscale Account:** With administrative privileges for DNS configuration.
*   **Tailscale Kubernetes Operator:** Installed in your cluster. ([Official Guide](https://tailscale.com/kb/1185/kubernetes/)).
*   **Envoy Gateway:** Installed as your Gateway API implementation. ([Documentation](https://gateway.envoyproxy.io/docs/)).
*   **ExternalDNS:** Deployed and configured to manage records in your internal DNS provider. This creates DNS entries for services like `hello.example.com`. ([GitHub Repository](https://github.com/kubernetes-sigs/external-dns)).
*   **CertManager:** Installed to automate TLS certificate issuance and renewal. ([Documentation](https://cert-manager.io/docs/)).
*   **Internal DNS Server:** Such as CoreDNS, BIND, or a cloud provider's private DNS (e.g., AWS Route 53 private hosted zones, Google Cloud DNS private zones).
    *   Must be accessible from your Tailscale nodes (e.g., via a Tailscale subnet router).
    *   ExternalDNS requires permissions to manage records in this server for your domain (`example.com`).

## Configuring Operator Hostname and API Server Proxy

When installing or upgrading the Tailscale Kubernetes operator, configuring it with OAuth credentials (client ID and client secret) is crucial. These allow the operator to authenticate with your Tailscale account, enabling it to manage resources like exposing services and updating device information in your tailnet.

Use the following Helm command, replacing placeholders with your Tailscale OAuth client ID and secret:

```bash
helm upgrade --install tailscale-operator tailscale/tailscale-operator \\
  --namespace=tailscale \\
  --create-namespace \\
  --set-string oauth.clientId=<oauth_client_id> \\
  --set-string oauth.clientSecret=<oauth_client_secret> \\
  --wait
```

## Configuring Tailscale MagicDNS for Your Custom Domain

To make `hello.example.com` (and other services on `example.com`) resolvable within your tailnet to the Envoy Gateway, configure Tailscale's MagicDNS with a split DNS setup. This directs DNS queries for `*.example.com` from Tailscale devices to your internal DNS server, which ExternalDNS keeps updated.

1.  **Identify Your Internal DNS Server:**
    You need an internal DNS server that ExternalDNS is configured to manage, holding records for `example.com`. Ensure it's accessible from Tailscale nodes (potentially via a [subnet router](https://tailscale.com/kb/1019/subnets/)). Note its IP address.

2.  **Configure Tailscale DNS for Split DNS:**
    *   Log in to your [Tailscale admin console](https://login.tailscale.com/admin/dns).
    *   Navigate to **DNS**.
    *   In "Nameservers," click "Add Nameserver" and select **Custom**.
    *   Input the IP address of your internal DNS server.
    *   Enable **Restrict to search domain** (or similar).
    *   For the search domain, enter your custom domain (e.g., `example.com`). This tells Tailscale to use your internal DNS server *only* for this domain.
    *   Save changes.

With this setup, when a Tailscale device accesses `hello.example.com`, MagicDNS forwards the DNS query to your internal DNS server. ExternalDNS, in your Kubernetes cluster, maintains the DNS record (e.g., an A or CNAME for `hello.example.com`) in this server, pointing to the Tailscale IP or hostname of your Envoy Gateway service (e.g., `common-envoy-ts.your-tailnet-name.ts.net`).

## Create Gateway

Define the Kubernetes Gateway API resources to configure an Envoy-based gateway, integrate it with Tailscale, and serve traffic for your custom domain.

### 1. Define EnvoyProxy and GatewayClass

The `EnvoyProxy` resource configures the underlying Envoy proxy instances:
*   `tailscale.com/hostname: common-envoy-ts` (in `provider.kubernetes.envoyService.annotations`): Instructs the Tailscale operator to assign this DNS name (e.g., `common-envoy-ts.your-tailnet.ts.net`) to Envoy's LoadBalancer service.
*   `loadBalancerClass: tailscale` (in `provider.kubernetes.envoyService`): Tells Kubernetes to use Tailscale for provisioning Envoy's LoadBalancer service.

The `GatewayClass` links this `EnvoyProxy` configuration to the Gateway API.

``` yaml
apiVersion: gateway.envoyproxy.io/v1alpha1
kind: EnvoyProxy
metadata:
  name: ts
  namespace: tailscale
spec:
  provider:
    type: Kubernetes
    kubernetes:
      envoyService:
        annotations:
          tailscale.com/hostname: common-envoy-ts
        type: LoadBalancer
        loadBalancerClass: tailscale
---
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: ts
spec:
  controllerName: gateway.envoyproxy.io/gatewayclass-controller
  parametersRef:
    group: gateway.envoyproxy.io
    kind: EnvoyProxy
    name: ts
    namespace: tailscale
```

### 2. Define the Gateway

The `Gateway` resource represents an instance of your gateway listening for traffic:

*   `external-dns: example` (label): Can be used by ExternalDNS to identify Gateways to process (value is customizable).
*   `cert-manager.io/cluster-issuer: example-issuer` (annotation): Tells CertManager to use this ClusterIssuer for TLS certificates.
*   `gatewayClassName: ts`: Links to the `GatewayClass` defined above.
*   `listeners`: Defines how the gateway listens:
    *   `protocol: HTTPS`, `port: 443`: Listens for HTTPS on port 443.
    *   `hostname: "hello.example.com"`: Handles requests only for this hostname.
    *   `tls.mode: Terminate`: Gateway terminates TLS.
    *   `tls.certificateRefs`: Points to the Kubernetes Secret (e.g., `hello-example-https-tls`) where CertManager stores the certificate.

``` yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: ts
  namespace: tailscale
  labels:
    external-dns: example
  annotations:
    cert-manager.io/cluster-issuer: example-issuer
spec:
  gatewayClassName: ts
  listeners:
    - name: hello-example-https
      protocol: HTTPS
      port: 443
      hostname: "hello.example.com"
      allowedRoutes:
        namespaces:
          from: All
      tls:
        mode: Terminate
        certificateRefs:
        - group: ''
          kind: Secret
          name: hello-example-https-tls
```

## Define an HTTPRoute to Direct Traffic

The `HTTPRoute` resource defines how HTTP requests are routed from the Gateway to backend services:

*   `parentRefs`: Links this `HTTPRoute` to our `Gateway` (`ts` in `tailscale` namespace).
*   `hostnames`: Specifies this route applies to requests for `hello.example.com`.
*   `rules`: Defines routing logic:
    *   `backendRefs`: Forwards traffic to the `hello-world` Kubernetes Service (port `80`).
    *   `matches`: Matches requests where the path starts with `/` (all requests for the hostname).

``` YAML
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: hello-ts
spec:
  parentRefs:
    - group: gateway.networking.k8s.io
      kind: Gateway
      name: ts
      namespace: tailscale
  hostnames:
    - "hello.example.com"
  rules:
    - backendRefs:
        - group: ""
          kind: Service
          name: hello-world
          port: 80
          weight: 1
      matches:
        - path:
            type: PathPrefix
            value: / 
```

This setup enables ExternalDNS to populate a DNS record for `hello.example.com` in your internal DNS server (used by Tailscale's split DNS). CertManager procures an HTTPS certificate, and the HTTPRoute directs traffic for `hello.example.com` to your `hello-world` service via the Envoy Gateway.

## Example: Using Pi-hole as Internal DNS with ExternalDNS

Pi-hole running in Kubernetes can serve as the internal DNS for this setup, providing ad blocking and local DNS resolution. ExternalDNS can be configured to use Pi-hole as a provider. This example assumes `helm` is installed.

### 1. Add Helm Repositories

```bash
helm repo add pihole https://mojo2600.github.io/pihole-kubernetes/
helm repo add external-dns https://kubernetes-sigs.github.io/external-dns
helm repo update
```

### 2. Create Pi-hole Admin Secret

Pi-hole and ExternalDNS need an admin password. Create a Kubernetes secret (replace `YOUR_PIHOLE_PASSWORD`):

```bash
kubectl create secret generic pihole-admin-secret --from-literal=password='YOUR_PIHOLE_PASSWORD' -n pihole-ns # Ensure pihole-ns exists or use --create-namespace
```

### 3. Install Pi-hole

Create `pihole-values.yaml`. This exposes Pi-hole's DNS (port 53) as a Tailscale LoadBalancer service with a specific Tailscale FQDN.

```yaml
# pihole-values.yaml
admin:
  existingSecret: "pihole-admin-secret" # Name of the K8s secret created above
  passwordKey: password # Key within the secret
extraEnvVars:
  FTLCONF_dns_listeningMode: 'all'
serviceDns:
  type: LoadBalancer
  loadBalancerClass: tailscale # Expose DNS service via Tailscale
  port: 53
  annotations:
    "tailscale.com/hostname": "pihole-dns" # USER: Replace with your desired Tailscale FQDN for Pi-hole DNS
serviceWeb:
  type: ClusterIP # Keep web UI internal
ingressWeb:
  enabled: false # Disable Pi-hole's ingress if managing access differently
podDnsConfig:
  enabled: false # Avoid conflicts with cluster DNS
```

Install Pi-hole:

```bash
helm install pihole pihole/pihole --version 2.31.0 \
  -n tailscale \
  -f pihole-values.yaml
```
Pi-hole's DNS service will be available at the FQDN specified (e.g., `pihole-dns.your-tailnet-name.ts.net`).

### 4. Install ExternalDNS for Pi-hole

Create `external-dns-pihole-values.yaml` to configure ExternalDNS for your Pi-hole deployment.

```yaml
# external-dns-pihole-values.yaml
fullnameOverride: external-dns-pihole
image:
  tag: v0.17.0
provider: pihole
env:
  - name: EXTERNAL_DNS_PIHOLE_PASSWORD
    valueFrom:
      secretKeyRef:
        name: pihole-admin-secret # Match secret name for Pi-hole
        key: password # Match key in secret
extraArgs:
  # USER: Adjust Pi-hole server URL if service name/namespace differs.
  # Points to Pi-hole web admin (port 80 internally).
  # Assumes Pi-hole in 'tailscale', release 'pihole' (service: 'pihole-web').
  - --pihole-server=http://pihole-web.tailscale
  - --pihole-api-version=6
  # USER: Customize label selector to match your Gateway resources.
  - --gateway-label-filter=external-dns==example # Matches label in main guide's Gateway
policy: sync # Or "upsert-only"
sources:
  - gateway-httproute # For hostnames in HTTPRoutes attached to labeled Gateways
  - service # To create DNS for annotated K8s services
  # - ingress # If using Ingress resources
# USER: Define domain(s) for ExternalDNS to manage in Pi-hole (e.g., "example.com").
domainFilters:
  - "example.com"
  # - "another.internal.domain"
# USER: Customize for TXT record identification.
txtOwnerId: "my-k8s-cluster-pihole"
txtPrefix: "k8s-edns-"
```

Install ExternalDNS:

```bash
# Check for the latest stable ExternalDNS chart version
helm install external-dns external-dns/external-dns \
  -n tailscale \
  -f external-dns-pihole-values.yaml
```

### 5. Configure Tailscale Split DNS for Pi-hole

Tell your Tailscale network to use Pi-hole for resolving your custom domain(s) (e.g., `example.com`):

1.  Go to **DNS** in your [Tailscale admin console](https://login.tailscale.com/admin/dns).
2.  Under "Nameservers," add a **Custom** nameserver.
3.  Enter Pi-hole's Tailscale IP or FQDN (e.g., `pihole-dns.your-tailnet-name.ts.net`).
4.  Enable **Restrict to search domain**.
5.  For the search domain, enter the domain(s) ExternalDNS manages via Pi-hole (e.g., `example.com`).
6.  Save changes.

Now, when your Gateway (e.g., for `hello.example.com`) is created with the label `external-dns: example`, ExternalDNS will add its DNS record to Pi-hole. Tailscale clients querying `hello.example.com` will use Pi-hole, which resolves it to your Envoy Gateway's Tailscale IP (`common-envoy-ts`).