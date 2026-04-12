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

---

## AI Agent Instructions (Self-Check)
When you receive a task that involves writing or changing code, you must:
1. Acknowledge this skill: "I am applying the `Smart Function Crafting & Annotation` skill."
2. Explicitly document your search process for reusable functions.
3. Explicitly document your manual call chain verification.
4. Manually inject the required JSDoc format without using any automated generation scripts.