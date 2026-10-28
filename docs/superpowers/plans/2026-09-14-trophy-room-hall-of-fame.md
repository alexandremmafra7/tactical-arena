# Trophy Room, Champions Gallery, and Hall of Fame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a complete trophy room, champions gallery, and hall of fame system for Tactical Arena FC / Elifoot Reforged that records tournament winners, updates club records, maintains historical leaders, persists manager career history, and provides a Stadium Night-themed web interface with offline parity.

**Architecture:** Implement pure shared domain functions for trophy recording and record updates, extend Prisma schema with trophy persistence, create a server persistence service, integrate with league/cup/continental/match/transfer completion points, update manager/club reputation, add API endpoints, ensure offline/localEngine parity, and build a React UI following Stadium Night visual language with accessibility compliance.

**Tech Stack:** TypeScript monorepo, Prisma ORM with SQLite, React frontend, Express API, Vitest testing framework

**Spec:** docs/superpowers/specs/2026-09-14-trophy-room-hall-of-fame-design.md

## Global Constraints

- Existing saves will not be backfilled. Only titles and records generated after the update will be stored.
- Sold and retired players remain in historical rankings permanently.
- Goals, assists, and appearances use persisted top-three rankings.
- Club and manager each receive persisted reputation changes.
- Dedicated Prisma models are preferred over JSON embedded in Club.
- Updates are event-driven and incremental.
- Longest unbeaten run and current unbeaten run are included now.
- Server and desktop/offline localEngine must have full feature parity.
- Player appearance totals are exact only when a stored lineup exists; CPU/background matches without a stored lineup are not estimated.
- UI composition selected: option B, the balanced dashboard where trophies, Hall of Fame, and records share the initial view.
- Keyboard-operable tabs and filters; visible focus; sufficient contrast; reduced-motion support; no body-level horizontal scrolling.

---