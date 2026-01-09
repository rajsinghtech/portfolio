---
title: "How Peer Relays Saved My Holiday: A 12.5x Performance Improvement from India"
description: "Visiting family in India meant dreading the inevitable sluggish connections to my homelab. This holiday, peer relays changed that - no more frozen terminals or slow transfers."
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

During the 2025 holiday season, I traveled to India to visit family. Like any good engineer, I expected to stay connected to my homelab infrastructure back in hat  America - accessing my Kubernetes clusters, using exit nodes for secure browsing, and managing various services. What I didn't expect was just how painful that experience would become when international networks had me relying on Tailscale's default relay infrastructure.

## The Problem: DERP Across Oceans

Tailscale typically establishes direct peer-to-peer connections between devices using NAT traversal. When direct connections fail (due to restrictive firewalls, CGNAT, or other network conditions), traffic falls back to [DERP (Designated Encrypted Relay for Packets)](https://tailscale.com/kb/1232/derp-servers) servers - Tailscale's managed relay infrastructure that also assists with NAT traversal and connection establishment.

DERP servers work reliably, but they're shared infrastructure - serving all Tailscale users who need relay assistance. They're optimized for availability and broad coverage, not raw throughput for individual connections. When you're in Delhi, India and trying to connect to infrastructure in Chicago, your traffic routes through a DERP server—sharing capacity with other users and subject to throughput limits that ensure fair access for everyone.

The real problem became apparent when I ran iperf3 tests. Sending all my traffic through DERP, across an ocean, resulted in severely throttled throughput averaging 2.2 Mbits/sec:

```
[ ID] Interval           Transfer     Bitrate
[  7]   0.00-1.00   sec   128 KBytes  1.04 Mbits/sec
[  7]   1.00-2.01   sec  2.00 MBytes  16.8 Mbits/sec
[  7]   2.01-3.00   sec  1.00 MBytes  8.42 Mbits/sec
[  7]   3.00-4.00   sec  2.50 MBytes  21.0 Mbits/sec
[  7]   4.00-5.00   sec  1.12 MBytes  9.41 Mbits/sec
[  7]   5.00-6.00   sec  2.38 MBytes  19.9 Mbits/sec
[  7]   6.00-7.00   sec  0.00 Bytes  0.00 bits/sec
[  7]   7.00-8.00   sec   640 KBytes  5.26 Mbits/sec
[  7]   8.00-9.01   sec  0.00 Bytes  0.00 bits/sec
[  7]   9.01-10.00  sec  0.00 Bytes  0.00 bits/sec
[  7]  10.00-11.00  sec  0.00 Bytes  0.00 bits/sec
...
- - - - - - - - - - - - - - - - - - - - - - - - -
[ ID] Interval           Transfer     Bitrate
[  7]   0.00-120.00 sec  32.0 MBytes  2.24 Mbits/sec                  sender
[  7]   0.00-120.30 sec  31.5 MBytes  2.20 Mbits/sec                  receiver
```
*iperf3 TCP throughput test from Delhi to Chicago over DERP. The wildly variable sender bitrate reflects DERP's QoS shaping the connection. The receiver total (31.5 MB over 120 seconds) tells the real story: ~2.2 Mbits/sec sustained.*

The connection was barely usable for anything beyond basic SSH - despite my ISP connection testing at 30-40 Mbps to international destinations under normal conditions.

## Why Direct Connections Failed

India's residential networks are notoriously difficult for peer-to-peer connectivity. Carrier-grade NAT (CGNAT), strict firewalls, and asymmetric routing meant Tailscale couldn't establish direct connections between my laptop in Delhi and my infrastructure in Chicago. Every connection attempt fell back to DERP relay.

That's exactly what DERP is designed for—it's the reliable fallback when direct connections aren't possible. But DERP is shared infrastructure, serving all Tailscale users globally. It's optimized for availability and broad coverage, with throughput limits that ensure fair access for everyone. For occasional relay traffic, this works great. For sustained high-bandwidth connections across oceans, you start hitting those limits.

The core issue wasn't the network path—it was that DERP's shared capacity couldn't deliver the throughput I needed for productive work.

## The Solution: Peer Relays

[Peer relays](https://tailscale.com/blog/peer-relays-beta), introduced in October 2025, offer an alternative: instead of using Tailscale's managed DERP infrastructure, you can designate your own nodes as high-throughput traffic relays within your tailnet.

The key difference is capacity. DERP servers are shared across all Tailscale users and apply throughput limits to ensure fair access. Peer relays are dedicated to your tailnet—no competing for bandwidth, no QoS throttling. You get the full capacity of whatever node you designate as a relay.

### How Peer Relays Work

Peer relays function similarly to DERP servers but run on your own infrastructure:

1. A node with good connectivity is configured as a peer relay
2. When direct connections fail between other nodes, Tailscale routes through your peer relay instead of DERP
3. Traffic remains end-to-end encrypted via WireGuard—the relay only sees encrypted packets
4. Tailscale maintains preference hierarchy: direct connection > peer relay > DERP

The critical advantage is dedicated relay capacity. For bandwidth-intensive use cases like file transfers, media streaming, or in my case, managing remote infrastructure, peer relays remove the throughput ceiling that shared DERP infrastructure imposes.

## Setting Up Peer Relays

The relay server requires a single UDP port to be accessible. For nodes behind NAT, this typically means port forwarding on your router or configuring security groups in cloud environments.

For my setup, I deployed peer relays on one of my homelabs in Chicago: a residential fiber connection that serves as the hub for my distributed infrastructure. This network hosts my Kubernetes clusters, exit nodes, and various services. Since the peer relay runs on the same network as the services I'm trying to reach, traffic from India now routes through infrastructure I control rather than public DERP servers.

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
*Same test with peer relays enabled. The first few seconds show TCP slow start ramping up (normal behavior), then throughput stabilizes at 30-50 Mbits/sec—nearly saturating the available bandwidth.*

**Results comparison:**

| Metric | Without Peer Relays (DERP) | With Peer Relays |
|--------|---------------------------|------------------|
| Average Throughput | 2.2 Mbits/sec | 27.5 Mbits/sec |
| Total Transfer (120s) | 32 MB | 394 MB |
| Throughput Variability | High (QoS shaping) | Low |
| Connection Stability | Throttled | Consistent |

That's a **12.5x improvement** in throughput, plus dramatically more stable connections. The peer relay test showed consistent 30-50 Mbits/sec intervals with no sustained dropout periods.

## Why This Matters

DERP does its job well—it provides reliable relay connectivity for millions of Tailscale users. But "reliable" and "high-throughput" are different goals. Peer relays give you dedicated capacity when you need sustained bandwidth that shared infrastructure can't provide.

### Other Use Cases

- **Large file transfers** - Move data between devices without DERP throughput limits
- **Media streaming** - Stream video or audio between tailnet devices smoothly
- **Enterprise environments** - Keep relay traffic within your network perimeter
- **Performance-critical applications** - Guarantee relay performance by controlling the relay infrastructure

## Conclusion

Peer relays transformed my holiday connectivity from barely usable to genuinely productive. Instead of waiting 30-plus seconds for kubectl commands to complete or giving up on transferring files to my homelab, I could work almost as efficiently as if I were back home.

If you've noticed DERP-relayed connections underperforming for bandwidth-intensive tasks, peer relays are worth exploring. The setup is minimal—designate a node, open a UDP port—and you get dedicated relay capacity that isn't subject to shared infrastructure limits.

DERP remains the reliable fallback for the majority of relay scenarios. But when you need high throughput, peer relays fill that gap.

## References

- [Peer Relays Documentation](https://tailscale.com/kb/1517/peer-relays)
- [Peer Relays Beta Announcement](https://tailscale.com/blog/peer-relays-beta)
- [DERP Servers Documentation](https://tailscale.com/kb/1232/derp-servers)
