---
title: Self-Hosting an AI CDN
description: A company that happens to run at home — three sites, an origin we built, and agents that do not get the keys
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

A couple years ago I wrote about my [homelab cluster framework](/p/cluster-framework/). That post was a lab: how I ran Kubernetes at home, what I picked, why.

This is the same machines. It is not the same job. Git is the only copy of the company that lasts. A merge is how the company changes. Agents write a lot of those diffs. I still decide what ships. I call the shape an **AI CDN** because the work looks like a CDN. Put the right thing at the right edge, behind the right door. Twenty years ago the thing was a file. Now it is an answer from a model, a commit, or an agent session that is allowed to open a pull request.

You do not get a CDN without an origin that already lives in more than one city. I could not buy that for the object store I wanted, so I [wrote garage-operator](https://github.com/rajsinghtech/garage-operator) and we still maintain it. That is the unglamorous reason this works.

The runbook is [the manifests](https://github.com/keiretsu-labs/kubernetes-manifests). This post is the claim.

## Departments, not replicas

**Ottawa** is headquarters. Source control, login, dashboards, the place agents sit down to work. If Ottawa is dark the other two sites keep doing their jobs. You just cannot log in, ship, or see.

**Robbinsdale** is the house. Lights, cameras, media, a second copy of the family files.

**St. Petersburg** is the brain. The GPUs live there. Ottawa asks them questions over the private roads between the buildings, not over the public internet, and not over the VPN I use from a coffee shop.

![Ottawa, Robbinsdale, and St. Petersburg](sites.png)

They fail separately on purpose. That is the bill for self-hosting a company.

## Roads and badges

The sites are one private network. The house routers are meshed. The clusters plug into that and tell the local router what they own. Traffic between Ottawa and St. Petersburg should feel like a hallway, not a phone call across the internet.

Identity is a different layer. Laptops, phones, and `kubectl` prove who they are on the tailnet. That is the badge. I used to use the badge as the road too. [I wrote that version](/p/tailscale-operator/). For three sites it is the slow way. People get a badge. Machines get a hallway.

Internal is not a lock. If a name is on the house network, it is on the house network. The lock is who is at the door.

## An origin in three cities

A CDN without a multi-city origin is a website with extra YAML. Garage is that origin. **garage-operator** is how it gets into git.

Off the shelf, the object store is a binary and a layout you edit by hand. That does not survive three sites and agents that open pull requests. The operator exists because this estate needed buckets, keys, and nodes to be files someone can review. We still maintain it because we run it.

One estate. A copy in each city. One city down is fine. Two is an outage of the object store. Applications never talk to a disk. They talk to a gateway in the building they are in. If that building's disks are gone, the gateway still reads from a city that is up.

That is where database history, images, volume snapshots, and agent artifacts actually live. Without it, you can ship YAML and the GPUs can sit there, but nothing *exists* in more than one place.

![Distributed S3](garage.svg)

## A street, a house, a badge

A homelab that only exists on a VPN is a clubhouse. A company has a street.

Three doors, on purpose, on every site: the public internet, the house LAN, and the tailnet. Names that only live in Ottawa stay in Ottawa. Pretending they are global when the other cities have no backend is not resilience.

The model is the example I care about. The settings page can be on the street, behind a login. The model itself is not. A prompt should have to get the door wrong *and* the path wrong before it lands on the internet.

Steer people with DNS. Steer packets on the private network. I have not yet treated "which city should this agent work in" as the same kind of decision. The model already works that way: brain in St. Petersburg, front desk in Ottawa, hallway in between.

![Three doors](three-doors.svg)

## Agents get an office

An agent will run whatever it just wrote. That is the job. It does not get the building.

Every session is a small virtual machine. Its own kernel. Set the carpet on fire. When the session dies, the room dies. A few rooms are allowed to badge onto the tailnet from inside. Most are not. If every intern is a VPN node, you did not sandbox anything.

The other half is the handshake. This summer the popular coding agents did not need to break out. They wrote a file, and a trusted program on the laptop ran it later. Here the handshake is a merge. The agent can wreck its office. The company only changes when I accept the commit.

![Agent, office, merge](sandbox-merge.svg)

Around that: if it is not in git, it does not last. Agents read the repo because the company is files. Checks run before merge. I am not trying to fire myself. I am trying to make the floor small enough that I can still walk it at night.

Databases are the same idea. They are files in the repo. Their history goes to the origin in three cities, not a tarball on a laptop. A volume is not backed up because a schedule is green. It is backed up when you have restored it into a new disk and it came back.

## What you actually own

**Ottawa down:** the company goes blind. The other sites keep running.

**St. Petersburg down:** the local brain dies. The factory can still ship. It gets dumber, or it borrows a rented model.

**Robbinsdale down:** the house and one copy of the files. Headquarters still answers the phone.

I picked those numbers. Renting the factory, the sandbox, or the GPUs means someone else did.

You can rent a coding agent. You can rent a GPU. You can rent a locked room. All three got good. You cannot rent a written copy of how *you* operate, plus a network that turns a change in that copy into a running thing at the right door, as the right person, with an origin that already exists in three cities.

That last part is why garage-operator exists. We wrote it for this. We still maintain it because this is still the thing it has to do.

The [manifests](https://github.com/keiretsu-labs/kubernetes-manifests) are how it is wired. This post is what the lab turned into.
