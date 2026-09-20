---
title: Self-Hosting an AI CDN
description: Three environments as a scheduling plane — where work runs, where it is stored, and who is allowed to knock
slug: self-hosting-an-ai-cdn
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
    - cdn
    - garage
    - networking
weight: 1
draft: false
---

A couple years ago I wrote about my [homelab cluster framework](/p/cluster-framework/). How I ran Kubernetes at home. What I picked. Why. That was a lab.

The interesting problem is no longer "do I have a cluster." It is **where does this work run.** An agent opening a pull request, a model answering, a database keeping history, a camera in the house — those are not the same environment. If you put them all in one place you do not have a company. You have a server with opinions.

I ended up with three environments that together are a scheduling control plane. Not a scheduler in the kube sense. A place you can actually put work, on purpose, because the network, the origin, and the doors already know the difference.

I call the shape an **AI CDN** because a CDN was always a scheduling problem. Put the object near the person who needs it, behind the right door. The object used to be a file. Now it is an answer, a commit, or an agent that is allowed to change the company.

You do not get that without an origin that already lives in more than one environment. I could not buy that for the object store I wanted, so I [wrote garage-operator](https://github.com/rajsinghtech/garage-operator) and we still maintain it.

The runbook is [the manifests](https://github.com/keiretsu-labs/kubernetes-manifests). This post is the claim.

## A control plane made of environments

**Ottawa** is where the company writes. Source control, login, the desks the agents sit at. If you are going to change how the system works, you change it here. Other environments can keep running without it. They just cannot ship.

**Robbinsdale** is where the house runs. The work here is local on purpose: lights, cameras, media, the copy of family files that should survive a bad day in another city. You do not schedule a coding agent onto the house because the house is not a factory. You schedule the house onto the house.

**St. Petersburg** is where the model thinks. The GPUs live there. Ottawa asks questions over the private roads between environments, not over the public internet, and not over the VPN I use from a coffee shop. You schedule inference here because this is the only environment that can afford to be a brain. You do not schedule the company's git here. A GPU site that also has to be headquarters is a single bad afternoon.

![Ottawa, Robbinsdale, and St. Petersburg](sites.png)

The control plane is the map. Work has a place. The fabric is what makes "schedule it there" a real sentence instead of a hope.

## The hallway and the badge

The three environments are one private network. The house routers are meshed. Each cluster tells its local router what it owns. Ottawa talking to St. Petersburg should feel like a hallway.

Identity is a different layer. People, laptops, and the tools that talk to the API prove who they are. That is the badge. I used to use the badge as the road too. [I wrote that version](/p/tailscale-operator/). For three environments it is the slow way. People get a badge. Work gets a hallway.

Internal is not a lock. If a name is on the house network, it is on the house network. The lock is which environment you were allowed to enter.

## Why we wrote an operator

A CDN without a multi-environment origin is a website with extra YAML. Garage is that origin. **garage-operator** is how it shows up in git.

Off the shelf, the object store is a binary and a layout you edit by hand. That does not survive three environments and agents that open pull requests. The operator exists because this estate needed buckets, keys, and nodes to be files someone can review. We still maintain it because we run it — federation across environments, disks that stay on the machine they belong to, a gateway that keeps its identity when a pod moves.

One estate. A copy in each environment. Applications never talk to a disk. They talk to a gateway in the environment they were scheduled into. If that environment's disks are gone, the gateway still reads from one that is up.

That is where database history, images, volume snapshots, and agent artifacts actually live. Without it you can schedule work. You cannot keep it.

![Distributed S3](garage.svg)

## Which door the work is allowed to use

A homelab that only exists on a VPN is a clubhouse. A company has a street.

Every environment has three doors: the public internet, the house, and the tailnet. Names that only live in Ottawa stay in Ottawa. Pretending they are global when the other environments have no backend is not scheduling. It is a coin flip.

The model is the example I care about. The settings page can be on the street, behind a login. The model itself is not. Inference was scheduled into St. Petersburg. The public internet does not get a seat in that room.

Steer people with DNS. Steer packets down the hallway. The thing I have not built yet is the obvious next scheduler: which environment should *this agent* work in. The model already works that way. Brain in St. Petersburg. Front desk in Ottawa. Hallway in between.

![Three doors](three-doors.svg)

## The agent is work you schedule

An agent will run whatever it just wrote. That is the job. It does not get the building, and it does not get to pick the environment.

Every session is a small virtual machine. Its own kernel. Set the carpet on fire. When the session dies, the room dies. A few rooms are allowed to badge onto the tailnet from inside. Most are not. If every intern is a VPN node, you did not schedule them. You hired them as the network.

The other half is the handshake. This summer the popular coding agents did not need to break out. They wrote a file, and a trusted program on the laptop ran it later. Here the handshake is a merge. The agent can wreck its office. The company only changes when I accept the commit.

![Agent, office, merge](sandbox-merge.svg)

If it is not in git, it does not last. Agents read the repo because the company is files. Checks run before merge. I am not trying to fire myself. I am trying to make the floor small enough that I can still walk it at night.

Databases are work you schedule too. They are files in the repo. Their history goes to the origin, not a tarball on a laptop. A volume is not backed up because a schedule is green. It is backed up when you have restored it into a new disk and it came back.

You can rent a coding agent. You can rent a GPU. You can rent a locked room. All three got good. You cannot rent a written copy of how *you* operate, plus a way to put work in the environment it belongs in, as the right person, with an origin that already exists in three cities.

That last part is why garage-operator exists. We wrote it so this control plane had somewhere to put the bytes. We still maintain it because the bytes are still the point.

The [manifests](https://github.com/keiretsu-labs/kubernetes-manifests) are how it is wired. This post is what the lab turned into.
