const fs = require('fs');
const path = require('path');

const frontendSrcDir = path.join(__dirname, 'packages/frontend/src');

function processFrontend(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processFrontend(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;

      // replace data.error with (dict.apiErrors?.[data.error] || data.error)
      // We only want to replace it where it's used as an error message to display
      // e.g. setError(data.error || ...)
      // e.g. throw new Error(data.error || ...)
      // We'll use a regex that looks for `data.error` inside function calls or logic.
      
      const newContent = content.replace(/data\.error/g, "(dict.apiErrors?.[data.error] || data.error)");
      
      // But wait! If we do it globally, it might replace it multiple times or in places where it's not needed (like `if (data.error)`).
      // A better regex: `setError(data.error` -> `setError(dict.apiErrors?.[data.error] || data.error`
      // `throw new Error(data.error` -> `throw new Error(dict.apiErrors?.[data.error] || data.error`
      // `setErrorMsg(data.error` -> `setErrorMsg(dict.apiErrors?.[data.error] || data.error`
      
      let safeContent = content;
      safeContent = safeContent.replace(/setError\(\s*data\.error/g, "setError(dict.apiErrors?.[data.error] || data.error");
      safeContent = safeContent.replace(/setErrorMsg\(\s*data\.error/g, "setErrorMsg(dict.apiErrors?.[data.error] || data.error");
      safeContent = safeContent.replace(/throw new Error\(\s*data\.error/g, "throw new Error(dict.apiErrors?.[data.error] || data.error");
      safeContent = safeContent.replace(/toast\.error\(\s*data\.error/g, "toast.error(dict.apiErrors?.[data.error] || data.error");
      safeContent = safeContent.replace(/verifyData\.error/g, "(dict.apiErrors?.[verifyData.error] || verifyData.error)");
      safeContent = safeContent.replace(/optionsData\.error/g, "(dict.apiErrors?.[optionsData.error] || optionsData.error)");

      if (safeContent !== content) {
        fs.writeFileSync(fullPath, safeContent, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processFrontend(frontendSrcDir);
