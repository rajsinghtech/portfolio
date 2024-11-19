---
title: Advertise Routes from Kubernetes Running Cilium to a Unifi Router over BGP
description: 
slug: cilium-unifi
date: 2024-11-19 00:00:00+0000
image: unifi-cilium.png
categories:
    - Kubernetes
tags:
    - cilium
    - unifi
    - bgp
    - frr
weight: 1      
---

In this post, I will walk you through the process of advertising routes from a Kubernetes cluster running Cilium to a Unifi router using BGP. This setup allows for dynamic routing between your Kubernetes cluster and your Unifi network, ensuring seamless connectivity and efficient routing. Blending Layer 3/4 Loadbalancing Protocols with Kubernetes.

## Prerequisites
Before we begin, ensure you have the following:
- A Kubernetes cluster with Cilium installed. see
- A Unifi router.
- FRR installed on your Unifi router. 

## Configuration Files
### Cilium BGP Configuration
First, we need to configure Cilium to advertise routes using BGP. In this case we have defined The unifi routers as a BGP peer at `10.0.0.1` using an ASN of `64513`. We have also configure Cilium to advertise all Pod, Service, and Loadbalancer IP's. Create a file named bgp.yaml with the following customer resource definitions:
``` yaml
---
apiVersion: cilium.io/v2alpha1
kind: CiliumBGPClusterConfig
metadata:
  name: unifi
spec:
  nodeSelector:
    matchLabels:
      kubernetes.io/os: linux
  bgpInstances:
    - name: "unifi"
      localASN: 64512
      peers:
        - name: "udm-1"
          peerASN: 64513
          peerAddress: 10.0.0.1
          peerConfigRef:
            name: "cilium-peer"
---
apiVersion: cilium.io/v2alpha1
kind: CiliumBGPPeerConfig
metadata:
  name: cilium-peer
spec:
  timers:
    holdTimeSeconds: 9
    keepAliveTimeSeconds: 3
  ebgpMultihop: 4
  gracefulRestart:
    enabled: true
    restartTimeSeconds: 15
  families:
    - afi: ipv4
      safi: unicast
      advertisements:
        matchLabels:
          advertise: "bgp"
---
apiVersion: cilium.io/v2alpha1
kind: CiliumBGPAdvertisement
metadata:
  name: bgp-advertisements
  labels:
    advertise: bgp
spec:
  advertisements:
    - advertisementType: "Service"
      service:
        addresses:
          - ClusterIP
          - ExternalIP
          - LoadBalancerIP    
      selector:
        matchExpressions:
        - {key: somekey, operator: NotIn, values: ['never-used-value']}
    - advertisementType: "PodCIDR"
      selector:
        matchExpressions:
        - {key: somekey, operator: NotIn, values: ['never-used-value']}
```

### FRR Configuration
Next, configure FRR on your Unifi router to establish a BGP session with Cilium. Notice the IP's in the Peer-Group they should match the nodes IP's you want to advertise from at the ASN of `64512`. Create a file named `frr.conf` with the following content:
``` bash
! -*- bgp -*-
!
hostname $UDMP_HOSTNAME
password zebra
frr defaults traditional
log file stdout
!
router bgp 64513
 bgp ebgp-requires-policy
 bgp router-id 10.0.0.1
 maximum-paths 4
 !
 neighbor cilium peer-group
 neighbor cilium remote-as 64512
 neighbor cilium activate
 neighbor cilium soft-reconfiguration inbound
 neighbor 192.168.50.40 peer-group cilium
 neighbor 192.168.50.112 peer-group cilium
 neighbor 192.168.50.56 peer-group cilium
 neighbor 192.168.50.104 peer-group cilium
 address-family ipv4 unicast
  redistribute connected
  neighbor cilium activate
  neighbor cilium route-map ALLOW-ALL in
  neighbor cilium route-map ALLOW-ALL out
  neighbor cilium next-hop-self
 exit-address-family
 !
route-map ALLOW-ALL permit 10
!
line vty
!
```

## Applying the Configuration
Apply the Cilium BGP Configuration: 
1. Apply the bgp.yaml configuration to your Kubernetes cluster using the following command:
```kubectl apply -f bgp.yaml```
2. Configure FRR on Unifi Router: Upload the `frr.conf` file to your Unifi router and restart the FRR service to apply the changes.

## Verifying the Setup
To verify that the routes are being advertised correctly, you can use the following commands:

On the Unifi router, check the BGP neighbors and advertised routes:
```bash
vtysh -c "show ip bgp summary"
vtysh -c "show ip bgp"
```
On the Kubernetes cluster, check the Cilium BGP status:
``` bash
cilium bgp peers
```
