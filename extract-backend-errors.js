const fs = require('fs');
const path = require('path');

const backendSrcDir = path.join(__dirname, 'packages/backend/src');
const frontendDictEn = path.join(__dirname, 'packages/frontend/src/i18n/dictionaries/en.json');
const frontendDictZh = path.join(__dirname, 'packages/frontend/src/i18n/dictionaries/zh.json');

const enDict = JSON.parse(fs.readFileSync(frontendDictEn, 'utf8'));
const zhDict = JSON.parse(fs.readFileSync(frontendDictZh, 'utf8'));

enDict.apiErrors = enDict.apiErrors || {};
zhDict.apiErrors = zhDict.apiErrors || {};

function toSnakeCase(str) {
  return str
    .replace(/\W+/g, '_')
    .replace(/_+/g, '_')
    .toUpperCase()
    .replace(/^_|_$/g, '');
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;

      // Match { error: 'Some string' }
      const regex = /error:\s*['"`](.*?)['"`]/g;
      content = content.replace(regex, (match, errorMsg) => {
        // If it's already an error code (all uppercase), skip
        if (/^[A-Z0-9_]+$/.test(errorMsg)) {
          return match;
        }

        const code = 'ERR_' + toSnakeCase(errorMsg);
        
        if (!enDict.apiErrors[code]) {
          enDict.apiErrors[code] = errorMsg; // Keep English as default
          // For Chinese, we'll just put the English for now and I'll manually translate the common ones
          zhDict.apiErrors[code] = errorMsg; 
        }

        changed = true;
        return `error: '${code}'`;
      });

      // Match success: false, error: 'Some string'
      const regex2 = /success:\s*false,\s*error:\s*['"`](.*?)['"`]/g;
      content = content.replace(regex2, (match, errorMsg) => {
        if (/^[A-Z0-9_]+$/.test(errorMsg)) return match;
        const code = 'ERR_' + toSnakeCase(errorMsg);
        if (!enDict.apiErrors[code]) {
          enDict.apiErrors[code] = errorMsg;
          zhDict.apiErrors[code] = errorMsg;
        }
        changed = true;
        return `success: false, error: '${code}'`;
      });

      if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDirectory(backendSrcDir);

fs.writeFileSync(frontendDictEn, JSON.stringify(enDict, null, 2), 'utf8');
fs.writeFileSync(frontendDictZh, JSON.stringify(zhDict, null, 2), 'utf8');
console.log('Backend errors extracted and replaced with codes.');
