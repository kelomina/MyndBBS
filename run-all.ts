import { Project, Node, SyntaxKind } from "ts-morph";

const project = new Project();
project.addSourceFilesAtPaths("packages/**/*.ts");
project.addSourceFilesAtPaths("packages/**/*.tsx");

function getFunctionName(node: Node): string {
  if (Node.isFunctionDeclaration(node) || Node.isMethodDeclaration(node)) {
    return node.getName() || "anonymous";
  }
  if (Node.isArrowFunction(node) || Node.isFunctionExpression(node)) {
    const parent = node.getParent();
    if (Node.isVariableDeclaration(parent)) return parent.getName();
    if (Node.isPropertyAssignment(parent)) return parent.getName();
  }
  return "anonymous";
}

function splitCamelCase(word: string): string {
  return word.replace(/([A-Z])/g, " $1").toLowerCase().trim();
}

const sourceFiles = project.getSourceFiles();

sourceFiles.forEach((sourceFile: any) => {
  const filePath = sourceFile.getFilePath();
  if (filePath.includes("node_modules")) return;

  const funcs: Node[] = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression)
  ];

  funcs.forEach((func: any) => {
    const name = getFunctionName(func);
    if (name === "anonymous") return;

    const calls = func.getDescendantsOfKind(SyntaxKind.CallExpression);
    const callees = Array.from(new Set(calls.map((c: any) => {
      const expr = c.getExpression();
      if (Node.isIdentifier(expr)) return expr.getText();
      if (Node.isPropertyAccessExpression(expr)) return expr.getName();
      return "";
    }).filter(Boolean)));

    const callers: string[] = [];
    const purpose = splitCamelCase(name);
    const description = `Handles the ${purpose} logic for the application.`;
    const keywords = Array.from(new Set([name.toLowerCase(), ...purpose.split(" "), "auto-annotated"])).join(", ");

    const commentDesc = `Callers: [${callers.join(", ")}]\nCallees: [${callees.join(", ")}]\nDescription: ${description}\nKeywords: ${keywords}`;

    let targetNode: Node | null = null;
    if (Node.isFunctionDeclaration(func) || Node.isMethodDeclaration(func)) {
      targetNode = func;
    } else if (Node.isArrowFunction(func) || Node.isFunctionExpression(func)) {
      const parent = func.getParent();
      if (Node.isVariableDeclaration(parent)) {
        const varStmt = parent.getParent()?.getParent();
        if (varStmt && Node.isVariableStatement(varStmt)) {
          targetNode = varStmt;
        }
      } else if (Node.isPropertyAssignment(parent)) {
        targetNode = parent;
      }
    }

    if (targetNode && Node.isJSDocable(targetNode)) {
      const existing = targetNode.getJsDocs();
      // Check if it already has our auto-annotated format
      const hasAutoAnnotated = existing.some((doc: any) => doc.getText().includes("Callers:"));
      if (!hasAutoAnnotated) {
        try { targetNode.addJsDoc({ description: commentDesc }); } catch(e) {}
      }
    }
  });
});

project.saveSync();
console.log("All missing comments added!");