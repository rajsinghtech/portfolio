---
title: Self-Hosting a Keiretsu
description: Several sites, mixed hardware, and AI work placed on purpose — three houses that share a warehouse and a network.
slug: self-hosting-a-keiretsu
date: 2026-09-18 00:00:00+0000
image: cover.png
categories:
    - Kubernetes
    - Tailscale
tags:
    - kubernetes
    - cilium
    - tailscale
    - unifi
    - ai
    - gitops
    - sandboxing
    - keiretsu
    - garage
    - networking
weight: 1
draft: false
---

A couple years ago I wrote about my [homelab cluster framework](/p/cluster-framework/). How I ran Kubernetes at home: distribution, CNI, storage, GitOps. This is the next version. Several sites as one system. Hardware that does not match. AI work you *place* — agents that write, a model that answers — instead of dumping it all on one box.

A [keiretsu](https://en.wikipedia.org/wiki/Keiretsu) is independent companies that stay separate and still operate as a group. Allies that trade with each other first and share a bank. That is the shape: more than one site, a rule about which work lands on which hardware, a private network between them, and a warehouse they share. Git is how the group agrees. If it is not in the repo, it did not happen.

Ours is three houses. Kartik’s in Ottawa, Luke’s in Robbinsdale, mine in St. Petersburg. They are homes. They also hold copies of the same infrastructure so one house going dark is not the whole group going dark. The framework is: **name the sites, name the hardware, place the work.**

The wiring lives in [the manifests](https://github.com/keiretsu-labs/kubernetes-manifests).

## Sites, hardware, placement

A site is a house we chose to run as a failure domain. The hardware in each room is different: ordinary compute, a lot of disk, GPUs, or a house that has to stay quiet. Placement is a file in git. That file says this workload runs here. No file, it does not run there.

Because the app is defined once and the site is a pointer, **we can move almost anything across the group.** Change which house the pointer names, merge, and [Flux](https://fluxcd.io/) brings it up on the other side. Same warehouse. Same network. That is how disaster recovery works here: the other houses already have the disks, the mesh, and the config. You are not rebuilding from a blog post. The exception is hardware. The model needs GPUs, so it lives at my house. Home Assistant needs Luke’s cameras, so it lives at Luke’s. Everything else can fail over.

**Ottawa (Kartik)** is where the system gets written. Git, login, dashboards, agent workspaces. Ordinary machines. If that house is down the others keep running; we just cannot ship.

**Robbinsdale (Luke)** is the home-automation site. Media, cameras, a second copy of family files.

**St. Petersburg (mine)** is the GPU site. Two machines, one model. Work at Kartik’s calls it over the site-to-site network. Git does not live here. I do not want the writer and the GPUs to die together.

Agents and the model are two placements. The agent runs at the writer site, in a throwaway VM, and opens a pull request. The model runs on the GPUs. They are not the same job.

![Three sites](sites.png)

## How the three sites talk

Each house has a [UniFi](https://www.ui.com/) gateway. The three gateways are meshed, so the LANs reach each other without the public internet. That is the underlay.

Each house runs Kubernetes. [Cilium](https://cilium.io/) is the [CNI](https://kubernetes.io/docs/concepts/extend-kubernetes/compute-storage-net/network-plugins/) — it gives pods IPs. It speaks [BGP](https://www.cloudflare.com/learning/security/glossary/what-is-bgp/) to the local UniFi box so the router learns those addresses. I wrote the [one-cluster version](/p/cilium-unifi/) years ago. Do it at all three houses and the mesh already knows how to forward.

[ClusterMesh](https://docs.cilium.io/en/stable/network/clustermesh/intro/) is how a Service at Kartik’s can send traffic to a backend at mine. A pod uses a DNS name. The packet goes to the other house like it was the next rack. Garage copies, CI, metrics, and logs all use that path.

People use [Tailscale](https://tailscale.com/). Laptops, phones, [`kubectl`](https://kubernetes.io/docs/reference/kubectl/). I used to send *workload* traffic over Tailscale too ([writeup](/p/tailscale-operator/)). The UniFi mesh is what the clusters use now. Tailscale is still how I log in from outside the house.

The model lives at my house. An app at Kartik’s calls it over ClusterMesh, same as any other Service. If I am not on that LAN, I use Tailscale to reach the API. The public internet can see a settings page behind login. It cannot send a prompt.

A [ClusterIP](https://kubernetes.io/docs/concepts/services-networking/service/#publishing-services-service-types) is on the LAN because BGP put it there. A Tailscale [subnet router](https://tailscale.com/kb/1019/subnets) can put the same ranges on the tailnet. Internal is not a lock. A [Gateway](https://gateway-api.sigs.k8s.io/) or a policy is.

## Watching the other sites

Each site runs [Prometheus](https://prometheus.io/). It scrapes locally, labels the series with the site, and remote-writes into [Mimir](https://grafana.com/oss/mimir/) at Kartik’s. Blocks land in Garage. Logs take the same path into [VictoriaLogs](https://docs.victoriametrics.com/victorialogs/). [Grafana](https://grafana.com/oss/grafana/) is only at the writer site.

If Kartik’s is down I lose history. Local Prometheus still shows the last few hours. That is enough to see an outage, not enough to graph last month. I do not run a Mimir in every house. Garage already keeps three copies of the blocks.

![Telemetry east-west](telemetry.svg)

## The warehouse

[Garage](https://garagehq.deuxfleurs.fr/) is S3 for several buildings. An app talks S3 to a gateway in *that* house. Disks are local. Copies go to the other two until there are three. The disks do not have to match. Ours do not.

Upstream Garage is a binary and a layout file. Fine for one box. A bad fit for Flux and for agents that open pull requests. I wanted a bucket to be a merge. So I wrote [garage-operator](https://github.com/rajsinghtech/garage-operator) (`GarageCluster`, `GarageBucket`, `GarageKey`) and I still maintain it. After that, Garage is ordinary: same git, same Flux, same mesh as everything else. No extra network for objects.

[Rook-Ceph](https://rook.io/) is still block storage at Kartik’s and Luke’s. Garage did not replace it. Ceph is volumes and databases. Garage is objects — WAL, images, Mimir blocks, snapshots — the copies we keep so one house having a bad day is not data loss.

![How Garage sits in the three houses](garage.svg)

## Who is allowed to ask

Every site has three doors: public internet, the house LAN, Tailscale. Names that only exist at Kartik’s stay pinned there. I have shipped “global” names that 404 because the other house had no backend.

The model API is not on the public internet. The settings UI can be, behind login.

![Three doors](three-doors.svg)

## Agents

An agent session starts at Kartik’s, in a [Kata](https://katacontainers.io/) VM. Own kernel. Thrown away when the session ends. Most sessions cannot join Tailscale. The agent clones the repo and opens a pull request. Checks render all three sites. I merge. Flux applies. The VM can catch fire. It does not `kubectl apply` production.

[Pillar](https://www.pillar.security/blog/the-week-of-sandbox-escapes) showed last July that Cursor, Codex, and Gemini CLI did not need to break out of their sandboxes. They wrote a hook or talked to Docker, and the host ran it. I do not want that host to be my laptop, and I do not want Flux to apply whatever landed on disk. Review, then merge.

![Agent, office, merge](sandbox-merge.svg)

Postgres is a file in git. WAL goes to Garage. A volume backup is real when I have restored it onto a new disk and the thing came back.

I rent coding agents and APIs when I need them. I also run this, because I wanted placement, doors, and the warehouse to be ours. garage-operator is the piece I could not rent in a shape I would merge.

The [manifests](https://github.com/keiretsu-labs/kubernetes-manifests) are the wiring.
