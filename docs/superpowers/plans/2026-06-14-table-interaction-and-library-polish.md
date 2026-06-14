# Table Interaction and Library Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the approved table interaction and Library polish design without removing existing behavior.

**Architecture:** Extend existing vanilla-JavaScript renderers with semantic classes and explicit action metadata, then add a final cohesive CSS layer for desktop and mobile. Use existing API delete endpoints and list refresh functions for panel deletion.

**Tech Stack:** Vanilla JavaScript, CSS, Jinja, Python unittest, Docker.

---

### Task 1: Interaction contracts
- Add failing source-contract tests for logo fallback, airline identity cells, aircraft tag chips, row detail hints, explicit delete controls, and premium Library styles.

### Task 2: Renderer behavior
- Replace transparent-logo initials with neutral failure placeholders.
- Render airline identity in Library and aircraft tags as chips.
- Add destination tooltips, row detail hint, explicit list actions, and entity-panel delete.

### Task 3: Visual polish
- Style entity pills, row hints, danger actions, Library identity cells, desktop hover states, and mobile action labels/cards.

### Task 4: Verification and deployment
- Run focused and complete tests, rebuild production Docker, verify health/static assets, commit, and push.
