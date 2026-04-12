# Smart Function Crafting & Annotation Skill

## Overview
This skill defines the mandatory workflow for AI agents when modifying existing functions or creating new ones in this codebase. The primary goals are to maximize code reuse, ensure the stability of the entire call chain, and strictly enforce a standardized, manually-generated JSDoc annotation format for future AI discoverability.

## 🚫 CRITICAL CONSTRAINT: NO SCRIPTS ALLOWED
**UNDER NO CIRCUMSTANCES** are you allowed to write, execute, or rely on automated scripts (e.g., AST parsers, `ts-morph`, Python, Bash, or Node.js scripts) to analyze call chains or generate these annotations. 
- You MUST analyze the codebase manually using search tools (`SearchCodebase`, `Grep`, `Glob`).
- You MUST read the code and trace the logic function-by-function.
- You MUST write the JSDoc comments manually using file editing tools (`SearchReplace`, `Write`).
- You may complete large tasks in phases, but the process must remain entirely manual.

---

## Workflow Steps

### Step 0: Pre-Modification & User Alignment (Mandatory User Interaction)
Before writing any code or making any modifications, you MUST interact with the user using the `AskUserQuestion` tool to ensure alignment:
1. **Evaluate Request Completeness**: Assess the user's request. If it lacks detail or is too vague to safely implement, use `AskUserQuestion` to provide multiple-choice options to clarify their specific vision. Do not guess.
2. **Security & Performance Assessment**: Prioritize analyzing the potential security vulnerabilities and performance bottlenecks the new feature might introduce. Use `AskUserQuestion` to present these risks to the user, explicitly ask for their consent to proceed, and brainstorm possible alternative, safer, or more performant solutions.
3. **Explicit Permission**: Before applying any file changes, explicitly outline your plan and ask the user for their permission to proceed with the modifications.
4. **Git Sync Check**: Before starting a new round of modifications, verify the `git` status. If there are unpushed commits on the `main` branch, you MUST ask the user (using `AskUserQuestion`) for explicit permission to push to `main` before proceeding with new changes.

### Step 1: Search and Reuse First
Before writing any new logic or creating a new function:
1. Identify the core keywords of the functionality you intend to build (e.g., `user`, `authentication`, `password`, `validate`).
2. Use codebase search tools to find existing functions that match these keywords.
3. **Analyze for Reuse**: Read the implementation of any matching functions. If an existing function can safely handle your requirement (perhaps with a minor, backward-compatible modification), **reuse it**.
4. **Create as Last Resort**: Only create a new function if absolutely no reusable function exists.

### Step 2: Call Chain Verification
After modifying an existing function or creating a new one:
1. **Trace Callers**: Find all places in the codebase where this function is called.
2. **Trace Callees**: Identify all other functions that your function calls internally.
3. **Verify Stability**: Manually check the entire call chain. Ensure that data types, expected behaviors, and return values align perfectly across all related functions. 
4. Fix any breakages or type mismatches introduced in the call chain immediately.

### Step 3: Strict JSDoc Annotation
Every new or modified function (including nested functions, anonymous callbacks, and closures) MUST have a standardized JSDoc comment immediately preceding its definition.

#### Required Format:
```typescript
/**
 * Callers: [List of functions/components that call this function. If none, leave empty brackets: []]
 * Callees: [List of internal functions/methods this function calls. If none, leave empty brackets: []]
 * Description: A clear, concise explanation of what this function does.
 * Keywords: A comma-separated list of relevant search keywords to help future AI agents find this function (e.g., module name, action, data type).
 */
```

#### Example:
```typescript
/**
 * Callers: [registerUser, updateProfile]
 * Callees: [test]
 * Description: Validates if a given password meets the strict password regex requirements (min 8 chars, uppercase, lowercase, number, special char).
 * Keywords: validation, auth, password, security, regex
 */
export const isValidPassword = (password: string): boolean => {
  return STRICT_PASSWORD_REGEX.test(password);
};
```

### Step 4: Pre-Delivery Verification & Rework (Self-Correction)
Before finalizing the task and delivering the code to the user, you MUST perform a strict self-audit:
1. **Git Diff Review**: Review your own modifications (e.g., using `git diff` or checking changed files).
2. **Compliance Check**: Verify that *every single* newly created or modified function (including nested/anonymous ones) contains the exact required JSDoc format (`Callers`, `Callees`, `Description`, `Keywords`).
3. **Mandatory Rework**: If you find any missing annotations, incorrect formats, or skipped call chain checks, you MUST rework and fix them immediately before yielding back to the user.
4. **Honest Escalation**: If you find it genuinely impossible to manually trace the call chain or annotate the functions (e.g., due to extreme codebase complexity, context length limits, or deeply obfuscated dynamic calls), you MUST stop. You are required to honestly, explicitly, and professionally inform the user of the specific technical limitations preventing completion. Do not hallucinate or guess the call chain.

---

## AI Agent Instructions (Self-Check)
When you receive a task that involves writing or changing code, you must:
1. Acknowledge this skill: "I am applying the `Smart Function Crafting & Annotation` skill."
2. Execute **Step 0**: Use `AskUserQuestion` to evaluate completeness, discuss security/performance implications, check Git sync status, and obtain explicit permission BEFORE touching code.
3. Explicitly document your search process for reusable functions (`Step 1`).
4. Explicitly document your manual call chain verification (`Step 2`).
5. Manually inject the required JSDoc format without using any automated generation scripts (`Step 3`).
6. Perform the **Pre-Delivery Verification** (`Step 4`). If you fail the compliance check, silently rework the code. If it's impossible to complete, report the failure honestly and explicitly to the user.