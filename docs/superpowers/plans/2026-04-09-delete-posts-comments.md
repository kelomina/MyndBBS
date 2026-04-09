# Delete Posts and Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement soft deletion for posts and comments with role-based permissions and handle deleted bookmarked items UI.

**Architecture:** Use Prisma to add `deletedAt` for Comments and change `status` to `DELETED` for Posts. Modify CASL permissions to enforce role rules.

**Tech Stack:** React, Next.js, Prisma, CASL.

---

### Task 1: Update Schema and CASL
- [x] **Step 1: Modify Prisma Schema**
- [x] **Step 2: Run Prisma db push**
- [x] **Step 3: Update CASL permissions**

### Task 2: Backend Routes
- [x] **Step 1: Add DELETE routes for Posts and Comments**
- [x] **Step 2: Update Bookmarks query**

### Task 3: Frontend UI
- [x] **Step 1: Add Delete buttons to PostActions and CommentItem**
- [x] **Step 2: Apply Web Interface Guidelines to deleted items in ProfileTabs**
