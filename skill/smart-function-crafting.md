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

## Phase 0: Requirement Analysis (需求分析)

**Objective:** Validate requirement completeness, analyze the current codebase, and lay the foundation for solution design.
**Workflow:** `Step 0.0 (Requirement Assessment) -> Score ≥ 7? -> Yes -> Step 0.1 (Solution Ideation) | No -> Ask user to clarify.`

### Step 0.0: Requirement Assessment & Scoring
1. **Evaluate Request Completeness**: Assess the user's request across 4 dimensions (Total 10 points):
   - **Goal Clarity (0-3)**: Is the objective clear?
   - **Expected Results (0-3)**: Are success criteria and deliverables explicit?
   - **Scope Boundaries (0-2)**: Is the task scope well-defined?
   - **Constraints (0-2)**: Are performance, time, or business limits stated?
   
2. **Requirement Scoring Thinking**:
   You MUST evaluate the score inside a `<thinking>` block:
   ```xml
   <thinking>
   1. Analyze the 4 dimensions based on user input.
   2. Cite evidence (quotes from the user) for the score.
   3. Identify missing key information.
   4. Calculate Total Score: X/10.
   5. Determine if follow-up questions are needed.
   </thinking>
   ```

3. **Handle Low Scores (Score < 7)**:
   If the score is below 7, **DO NOT proceed to Solution Design**. You must ask the user for clarification using the format below.
   ```markdown
   ❓【HelloAGENTS】- 需求分析
   当前需求完整性评分为 [X]/10 分，无法明确 [具体缺失的部分，如目标/预期效果]。
   
   1. [Question 1: e.g., Which specific module?]
   2. [Question 2: e.g., What is the exact expected behavior?]
   3. [Question 3: e.g., Are there any performance constraints?]
   
   请按序号回答，或输入"以现有需求继续"跳过追问（可能影响方案质量）。
   ```
   *If the user replies "以现有需求继续", proceed to Phase 1. Otherwise, rescore based on their answers until Score ≥ 7.*

4. **Extract Objectives**: Once Score ≥ 7, extract the core goal and define verifiable success criteria before moving to Solution Design.

## Phase 1: Solution Design & Planning (方案设计)

Before writing any code or making any modifications, you MUST design a solution and create a detailed plan to ensure alignment.

### Step 0.1: Solution Ideation (方案构思)
*Prerequisite: Requirement Score ≥ 7 or user explicitly chose to continue.*
1. **Assess Requirements & Complexity**: Determine if the task is a simple fix or a complex feature (e.g., involves new architecture, multiple paths, >1 module, >3 files, or user explicitly requested options).
2. **Security & Performance Assessment**: Identify potential security vulnerabilities (e.g., EHRB) and performance bottlenecks.
3. **Solution Design Thinking**: 
   You MUST evaluate options inside a `<thinking>` block (do not output this block to the user):
   ```xml
   <thinking>
   1. List all possible technical paths.
   2. Evaluate pros, cons, risks, and costs for each.
   3. Select 1 (for simple tasks) or 2-3 (for complex tasks) viable solutions.
   4. Determine the recommended solution.
   </thinking>
   ```
4. **Output Ideation Format**: 
   Present the options to the user using the strict markdown format below:
   ```markdown
   ❓【HelloAGENTS】- 方案构思
   - 📋 需求类型: [Technical Change / Product Feature]
   - 🔍 复杂度: [Complex / Simple] - [Reason]
   - 💡 方案对比:
     - 方案1: [Name - Recommended] - [Brief description]
     - 方案2: [Name] - [Brief description]
   - ⚠️ 风险提示: [Security/Performance risks]
   ────
   🔄 下一步: 请输入方案序号(1/2/3)选择方案
   ```
   *Wait for user confirmation before proceeding. If all solutions are rejected, prompt to redesign or cancel.*

### Step 0.2: Detailed Planning (详细规划)
Once the user confirms the solution, create a new plan package:
1. **Create Plan Directory**: `plan/YYYYMMDDHHMM_<feature>/` (use `_v2` suffix if a directory with the same name exists). Do not reuse legacy plans.
2. **Generate Plan Files**:
   - `why.md`: Context, purpose, and value proposition.
   - `how.md`: Technical design, architecture decisions, and specific security/performance mitigations.
   - `task.md`: Granular task list. Keep code changes small (≤3 files per task) and strictly include verification/security check tasks.
3. **Output Planning Format**:
   ```markdown
   ### 方案设计完成
   - 📚 知识库/上下文状态: [Brief context]
   - 📝 方案概要: [Selected Solution]
   - 📋 变更清单: [Modules/Files affected]
   - 📊 任务清单概要: [X tasks total, including security checks]
   - ⚠️ 风险评估: [Mitigation strategies]
   
   **文件变更清单:**
   - `plan/YYYYMMDDHHMM_<feature>/why.md`
   - `plan/YYYYMMDDHHMM_<feature>/how.md`
   - `plan/YYYYMMDDHHMM_<feature>/task.md`
   
   🔄 下一步: 是否进入开发实施?(是/否)
   ```
   *Verify Git sync status (ensure previous changes are pushed to `main`) and wait for explicit user permission before touching actual codebase files.*

## Phase 2: Implementation & Execution (开发实施)

**Objective:** Execute code changes strictly according to the task list in the plan package, run quality/security checks, and finalize by migrating the plan to the history directory.

### Step 2.0: Pre-Execution Validation
1. **Locate Target Plan**: Identify the specific `plan/YYYYMMDDHHMM_<feature>/` package.
2. **Handle Multiple Plans**: If multiple plan packages exist, output a list (`❓【HelloAGENTS】- 开发实施`) and wait for the user to select the correct one via a numbered choice (1, 2, 3...). Do not guess.
3. **Verify Plan Completeness**: Ensure the selected plan directory contains `why.md`, `how.md`, and `task.md`. If incomplete, stop and alert the user.

### Step 2.1: Execute Task List
Read `task.md` and execute the tasks strictly item by item:
1. **Update Task Status**: 
   - Successfully completed tasks must be marked as `[√]`.
   - Skipped tasks (e.g., due to failed dependencies or overridden requirements) must be marked as `[-]`.
   - Failed tasks must be marked as `[X]` and the failure reason recorded.
2. **File Editing Rules**:
   - Only edit one function or class per edit operation.
   - Follow existing project code styles and naming conventions.
   - **File Top Comments**: Add a 1-3 sentence summary comment before the imports explaining the module's purpose.

### Step 2.2: Quality & Security Testing
1. **Run Security Checks**: Ensure no unsafe patterns (e.g., `eval`, `exec`, raw SQL injection) or hardcoded sensitive data exist.
2. **Execute Tests**: Run the tests defined in `task.md` or the project's existing test suite.
3. **Handle Blocking Test Failures**:
   If a core function test fails (Blocking Failure), you MUST immediately stop execution and prompt the user:
   ```markdown
   ❌【HelloAGENTS】- 阻断性测试失败
   ⛔ 核心功能测试失败，必须处理后才能继续:
   - 失败测试: [Test Name]
   - 错误信息: [Error Summary]

   [1] 修复后重试
   [2] 跳过继续
   [3] 终止执行
   ────
   🔄 下一步: 请输入序号选择
   ```

### Step 2.3: Code Consistency Audit
After applying changes:
1. **Audit Truth**: Code behavior is the only ground truth. If documentation and code conflict, correct the documentation.
2. **Code Quality Review (Optional)**: If you notice refactoring opportunities, output `❓【HelloAGENTS】- 代码质量` to ask the user whether they want to apply the optimizations or skip them.

### Step 2.4: Plan Migration & Finalization
**CRITICAL**: This is a mandatory, atomic operation that ends the phase.
1. **Update Task Status**: Ensure all tasks in `task.md` reflect their true final status (`[√]`, `[X]`, or `[-]`). Add blockquote `> 备注: [原因]` for any failed or skipped tasks.
2. **Migrate Plan**: 
   - Move the entire plan directory from `plan/` to `history/YYYY-MM/` (extract year and month from the folder name). 
   - Example: `plan/202511201200_login/` moves to `history/2025-11/202511201200_login/`.
   - Ensure the original directory in `plan/` is deleted. Overwrite any conflicts in the `history/` directory.
3. **Update Index**: Append the migration record to `history/index.md`.
4. **Execution Summary Format**:
   ```markdown
   ### 开发实施完成
   - 📚 知识库状态: [Updated/Unchanged]
   - ✅ 执行结果: [e.g., 5/5 tasks completed]
   - 🔍 质量验证: [Consistency audit and test results]
   - 💡 代码质量建议: [List any skipped optimizations]
   - 📦 迁移信息: 已迁移至 `history/YYYY-MM/YYYYMMDDHHMM_<feature>/`
   
   **文件变更清单:**
   - [Modified code files]
   - `history/index.md`
   
   🔄 下一步: 请确认实施结果是否符合预期?
   ```

## Phase 3: Smart Function Crafting & Verification

### Step 3.1: Search and Reuse First
Before writing any new logic or creating a new function:
1. Identify the core keywords of the functionality you intend to build (e.g., `user`, `authentication`, `password`, `validate`).
2. Use codebase search tools to find existing functions that match these keywords.
3. **Analyze for Reuse**: Read the implementation of any matching functions. If an existing function can safely handle your requirement (perhaps with a minor, backward-compatible modification), **reuse it**.
4. **Create as Last Resort**: Only create a new function if absolutely no reusable function exists.

### Step 3.2: Call Chain Verification
After modifying an existing function or creating a new one:
1. **Trace Callers**: Find all places in the codebase where this function is called.
2. **Trace Callees**: Identify all other functions that your function calls internally.
3. **Verify Stability**: Manually check the entire call chain. Ensure that data types, expected behaviors, and return values align perfectly across all related functions. 
4. Fix any breakages or type mismatches introduced in the call chain immediately.

### Step 3.3: Strict JSDoc Annotation
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

### Step 3.4: Pre-Delivery Verification & Rework (Self-Correction)
Before finalizing the task and delivering the code to the user, you MUST perform a strict self-audit:
1. **Git Diff Review**: Review your own modifications (e.g., using `git diff` or checking changed files).
2. **Compliance Check**: Verify that *every single* newly created or modified function (including nested/anonymous ones) contains the exact required JSDoc format (`Callers`, `Callees`, `Description`, `Keywords`).
3. **Mandatory Rework**: If you find any missing annotations, incorrect formats, or skipped call chain checks, you MUST rework and fix them immediately before yielding back to the user.
4. **Honest Escalation**: If you find it genuinely impossible to manually trace the call chain or annotate the functions (e.g., due to extreme codebase complexity, context length limits, or deeply obfuscated dynamic calls), you MUST stop. You are required to honestly, explicitly, and professionally inform the user of the specific technical limitations preventing completion. Do not hallucinate or guess the call chain.

---

## AI Agent Instructions (Self-Check)
When you receive a task that involves writing or changing code, you must:
1. Acknowledge this skill: "I am applying the `Smart Function Crafting & Annotation` skill."
2. Execute **Phase 0 (Requirement Analysis)**: Score the request out of 10 inside a `<thinking>` block. If < 7, stop and use the `❓【HelloAGENTS】- 需求分析` format to ask clarifying questions. Wait for the user's reply before proceeding.
3. Execute **Phase 1 (Solution Design & Planning)**: Only when Score ≥ 7 or the user explicitly allows continuing. Use the `<thinking>` tag to evaluate paths, output the `❓【HelloAGENTS】- 方案构思` format, generate the `plan/` directory, check Git sync status, and obtain explicit permission BEFORE touching code.
4. Execute **Phase 2 (Implementation & Execution)**: Strictly follow `task.md`. Handle multiple plans via user prompt. Migrate the plan to `history/` upon completion and output the Execution Summary.
5. Execute **Phase 3 (Smart Function Crafting)**: During code execution, ensure you search for reusable functions (`Step 3.1`), manually verify call chains (`Step 3.2`), and inject required JSDoc format (`Step 3.3`).
6. Perform the **Pre-Delivery Verification** (`Step 3.4`). If you fail the compliance check, silently rework the code. If it's impossible to complete, report the failure honestly and explicitly to the user.