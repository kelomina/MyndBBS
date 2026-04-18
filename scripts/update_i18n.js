const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const backendDir = '/workspace/packages/backend/src';
const enErrorsPath = '/workspace/packages/backend/src/locales/en/errors.json';
const zhErrorsPath = '/workspace/packages/backend/src/locales/zh/errors.json';

const stdout = execSync(`grep -rh "throw new Error('ERR_" ${backendDir} | awk -F"'" '{print $2}' | sort | uniq`);
const keys = stdout.toString().split('\n').filter(Boolean);

const enErrors = JSON.parse(fs.readFileSync(enErrorsPath, 'utf8'));
const zhErrors = JSON.parse(fs.readFileSync(zhErrorsPath, 'utf8'));

let added = 0;
keys.forEach(key => {
  if (!enErrors[key]) {
    enErrors[key] = key.replace(/^ERR_/, '').replace(/_/g, ' ').toLowerCase();
    enErrors[key] = enErrors[key].charAt(0).toUpperCase() + enErrors[key].slice(1);
    added++;
  }
  if (!zhErrors[key]) {
    zhErrors[key] = key;
  }
});

fs.writeFileSync(enErrorsPath, JSON.stringify(enErrors, null, 2) + '\n');
fs.writeFileSync(zhErrorsPath, JSON.stringify(zhErrors, null, 2) + '\n');
console.log(`Added ${added} missing i18n keys.`);
