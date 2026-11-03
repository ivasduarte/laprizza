# Introduce Redis for Caching

* Status: proposed
* Deciders: Development Team
* Date: 2026-11-02

Technical Story: Add a caching layer to reduce MongoDB I/O for frequently accessed, rarely changing data.

## Context and Problem Statement

The authorization middleware frequently queries the database to validate user roles on every protected request. This creates unnecessary bottlenecks and high database load for data that rarely changes.

## Decision Drivers

* Latency reduction, database load mitigation, and scalability.

## Considered Options

* Node.js In-Memory Cache
* Memcached
* Redis

## Decision Outcome

Chosen option: "Redis", because high-frequency read data (like user profiles and roles) will be cached globally with a Time-To-Live (TTL), eliminating the impact on MongoDB via a Cache-Aside pattern.

### Positive Consequences

* Dramatic reduction in API latency for protected routes and significant relief of I/O pressure on the primary database.

### Negative Consequences

* Introduces infrastructure overhead and the engineering complexity of cache invalidation when user profiles are updated.

## Pros and Cons of the Options

### Node.js In-Memory Cache

Storing objects directly in the Node.js process heap.

* Good, because it is extremely fast and requires zero external infrastructure.
* Bad, because cached data is not shared across multiple Node.js instances in a scaled environment, leading to inconsistencies.

### Memcached

A high-performance, distributed memory object caching system.

* Good, because it is simple and highly optimized for basic key-value caching.
* Bad, because it lacks advanced data structures and persistence options compared to modern alternatives.

### Redis

An advanced, open-source, in-memory data structure store.

* Good, because it acts as a robust distributed cache that can handle complex data types, TTL expirations, and future scalability needs.
* Bad, because it adds a new external infrastructure dependency to the stack.
