---
title: "How Peer Relays Saved My Holiday: A 10x Performance Improvement from India"
description: "When traveling to India during the holidays, Tailscale's DERP relays became a bottleneck. Peer relays provided a 10x throughput improvement for connecting to my US infrastructure."
slug: peer-relays-tailscale
date: 2025-12-25 00:00:00+0000
image: cover.png
categories:
    - Tailscale
tags:
    - tailscale
    - networking
    - peer-relays
    - derp
weight: 1
draft: false
---

During the 2025 holiday season, I traveled to India to visit family. Like any good engineer, I expected to stay connected to my homelab infrastructure back in North America - accessing my Kubernetes clusters, using exit nodes for secure browsing, and managing various services. What I didn't expect was just how painful that experience would become without [peer relays](https://tailscale.com/blog/peer-relays-beta).

## The Problem: DERP Across Oceans

Tailscale's mesh VPN typically establishes direct peer-to-peer connections between devices using NAT traversal. When direct connections fail (due to restrictive firewalls, CGNAT, or other network conditions), traffic falls back to [DERP (Designated Encrypted Relay for Packets)](https://tailscale.com/kb/1232/derp-servers) servers - Tailscale's managed relay infrastructure.

DERP servers work reliably, but they're shared infrastructure - serving all Tailscale users who need relay fallback. They're optimized for availability and broad coverage, not raw throughput for individual connections. When you're in Hyderabad, India trying to connect to infrastructure in Ottawa, Canada, your traffic might route through a DERP server in New York - competing with other users' traffic while traversing suboptimal network paths.

The real problem became apparent when I ran iperf3 tests. Without peer relays, going through DERP resulted in catastrophic packet loss and throughput averaging **2.2 Mbits/sec** with constant dropouts:

```
[ ID] Interval           Transfer     Bitrate
[  7]   0.00-1.00   sec   128 KBytes  1.04 Mbits/sec
[  7]   1.00-2.01   sec  2.00 MBytes  16.8 Mbits/sec
[  7]   2.01-3.00   sec  1.00 MBytes  8.42 Mbits/sec
[  7]   3.00-4.00   sec  2.50 MBytes  21.0 Mbits/sec
[  7]   4.00-5.00   sec  1.12 MBytes  9.41 Mbits/sec
[  7]   5.00-6.00   sec  2.38 MBytes  19.9 Mbits/sec
[  7]   6.00-7.00   sec  0.00 Bytes  0.00 bits/sec    <- packet loss
[  7]   7.00-8.00   sec   640 KBytes  5.26 Mbits/sec
[  7]   8.00-9.01   sec  0.00 Bytes  0.00 bits/sec    <- packet loss
[  7]   9.01-10.00  sec  0.00 Bytes  0.00 bits/sec    <- packet loss
[  7]  10.00-11.00  sec  0.00 Bytes  0.00 bits/sec    <- packet loss
...
- - - - - - - - - - - - - - - - - - - - - - - - -
[ ID] Interval           Transfer     Bitrate
[  7]   0.00-120.00 sec  32.0 MBytes  2.24 Mbits/sec                  sender
[  7]   0.00-120.30 sec  31.5 MBytes  2.20 Mbits/sec                  receiver
```

Over 120 seconds, I counted dozens of intervals with zero throughput. The connection was barely usable for anything beyond basic SSH.

## Why India's Networks Are Particularly Challenging

India's residential ISPs are what network engineers call "[eyeball networks](https://en.wikipedia.org/wiki/Eyeball_network)" - access providers where end users primarily consume content rather than generate it. Traffic flow is heavily asymmetric: users download far more than they upload. This asymmetry shapes how these networks peer with the rest of the internet.

Eyeball networks optimize for inbound content delivery - getting Netflix, YouTube, and web pages to subscribers efficiently. But bidirectional traffic patterns (like VPN tunnels to overseas infrastructure) aren't the priority. The BGP peering arrangements between Indian ISPs and North American networks reflect this: they're designed for pulling content from major CDNs, not for low-latency bidirectional communication with random endpoints.

When Tailscale's DERP servers in New York try to relay traffic between my laptop in Hyderabad and my servers in Ottawa, that traffic is subject to:

1. **Suboptimal BGP routing** through peering points not designed for this traffic pattern
2. **Congested international links** shared with content delivery traffic
3. **High latency variability** due to routing that prioritizes cost over performance
4. **Packet loss** at oversubscribed peering exchanges

This isn't a Tailscale problem - it's the reality of how eyeball networks interconnect with the broader internet.

## The Solution: Peer Relays

[Peer relays](https://tailscale.com/blog/peer-relays-beta), introduced in Tailscale's December 2024 beta, offer an alternative: instead of using Tailscale's managed DERP infrastructure, you can designate your own nodes as traffic relays within your tailnet.

The key insight is that you likely already have infrastructure with better network paths than consumer ISPs. If you have a VM in AWS, GCP, or any cloud provider with solid network peering, that node can relay traffic for other devices in your tailnet.

### How Peer Relays Work

Peer relays function similarly to DERP servers but run on your own infrastructure:

1. A node with good connectivity is configured as a peer relay
2. When direct connections fail between other nodes, Tailscale can route through your peer relay instead of DERP
3. Traffic remains end-to-end encrypted via WireGuard - the relay only sees encrypted packets
4. Tailscale maintains preference hierarchy: direct connection > peer relay > DERP

The critical advantage is choosing where your relay sits in the network topology. By placing peer relays in cloud regions with strong BGP peering, you can bypass the problematic paths that plague connections from eyeball networks.

## Setting Up Peer Relays

The relay server requires a single UDP port to be accessible. For nodes behind NAT, this typically means port forwarding on your router or configuring security groups in cloud environments.

For my setup, I deployed peer relays on nodes in my Ottawa infrastructure that have direct, stable connectivity to the rest of my homelab. Since these nodes are on the same network as my Kubernetes clusters and exit nodes, traffic from India now routes through infrastructure I control rather than public DERP servers.

## The Results: 12.5x Improvement

After configuring peer relays, I ran the same iperf3 tests. The difference was dramatic:

```
[ ID] Interval           Transfer     Bitrate
[  7]   0.00-1.00   sec   128 KBytes  1.05 Mbits/sec
[  7]   1.00-2.01   sec  0.00 Bytes  0.00 bits/sec
[  7]   2.01-3.00   sec   128 KBytes  1.05 Mbits/sec
...
[  7]  14.00-15.00  sec  4.62 MBytes  38.7 Mbits/sec
[  7]  15.00-16.00  sec  5.50 MBytes  46.1 Mbits/sec
[  7]  16.00-17.00  sec  5.00 MBytes  41.9 Mbits/sec
...
[  7]  33.00-34.00  sec  5.00 MBytes  42.1 Mbits/sec
[  7]  34.00-35.00  sec  5.62 MBytes  47.1 Mbits/sec
[  7]  35.00-36.00  sec  6.38 MBytes  53.5 Mbits/sec
...
- - - - - - - - - - - - - - - - - - - - - - - - -
[ ID] Interval           Transfer     Bitrate
[  7]   0.00-120.00 sec   396 MBytes  27.7 Mbits/sec                  sender
[  7]   0.00-120.26 sec   394 MBytes  27.5 Mbits/sec                  receiver
```

**Results comparison:**

| Metric | Without Peer Relays (DERP) | With Peer Relays |
|--------|---------------------------|------------------|
| Average Throughput | 2.2 Mbits/sec | 27.5 Mbits/sec |
| Total Transfer (120s) | 32 MB | 394 MB |
| Packet Loss | Severe (frequent 0 byte intervals) | Minimal |
| Connection Stability | Highly variable | Consistent |

That's a **12.5x improvement** in throughput and dramatically more stable connections. The peer relay test showed consistent 30-50 Mbits/sec intervals with no sustained dropout periods.

## Why This Matters

Peer relays solve a fundamental architectural problem: Tailscale's managed DERP infrastructure is shared among all users and can't be optimized for every possible network path in the world. Countries with developing internet infrastructure, restrictive firewalls, or poor international peering will always struggle with DERP-relayed connections. And since DERP is shared, you're competing for bandwidth with every other Tailscale user routing through that same server.

With peer relays, you get dedicated relay capacity serving only your tailnet.

By giving users the ability to deploy their own relays, Tailscale shifts the responsibility of network topology to those who understand their specific requirements. If you know your cloud infrastructure has better connectivity than consumer ISPs in your region, you can leverage that knowledge.

### Use Cases for Peer Relays

- **International travel** - Connect through your own infrastructure rather than potentially problematic DERP paths
- **Enterprise environments** - Keep traffic within your network perimeter rather than routing through external relays
- **Restrictive networks** - Bypass firewalls that may throttle or block DERP server IP ranges
- **Performance-critical applications** - Guarantee relay performance by controlling the relay infrastructure

## Conclusion

Peer relays transformed my holiday connectivity from barely usable to genuinely productive. Instead of waiting 30+ seconds for kubectl commands to complete or giving up on transferring files to my homelab, I could work almost as efficiently as if I were back home.

If you regularly travel to regions with challenging internet infrastructure, or if you've noticed DERP-relayed connections underperforming, peer relays are worth exploring. The setup is minimal, and the performance benefits can be substantial.

The ability to control your relay infrastructure is one more step toward Tailscale's vision of giving users complete control over their network topology - not just the mesh, but the fallback paths as well.

## References

- [Peer Relays Beta Announcement](https://tailscale.com/blog/peer-relays-beta)
- [DERP Servers Documentation](https://tailscale.com/kb/1232/derp-servers)
- [Tailscale Network Architecture](https://tailscale.com/blog/how-tailscale-works)
