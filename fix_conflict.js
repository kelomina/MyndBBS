const fs = require('fs');

function fix(file) {
    let content = fs.readFileSync(file, 'utf8');
    
    // We want to keep everything from HEAD (the huge block of new keys)
    // and also append the "forbidden" block from the cherry-picked commit.
    
    // Let's just parse the two halves manually or do string replacement
    content = content.replace(/<<<<<<< HEAD\n([\s\S]*?)=======\n\s*"initError"[^\n]*\n\s*},\n\s*"forbidden": \{([\s\S]*?)>>>>>>> [^\n]*\n/g, 
        "$1\n  },\n  \"forbidden\": {$2");
        
    fs.writeFileSync(file, content);
}

fix('packages/frontend/src/i18n/dictionaries/en.json');
fix('packages/frontend/src/i18n/dictionaries/zh.json');
console.log('Conflicts resolved');
