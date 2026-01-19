const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'public', 'data');

function isProblematicFormat(json) {
  return Array.isArray(json) && json.length === 2 &&
         typeof json[0] === 'object' && json[0].nodes &&
         typeof json[1] === 'object' && json[1].links;
}

function processFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    let json;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      console.error(`[ERROR] Invalid JSON in ${filePath}: ${e.message}`);
      return false;
    }
    if (isProblematicFormat(json)) {
      const fixedJson = {
        nodes: json[0].nodes,
        links: json[1].links
      };
      fs.writeFileSync(filePath, JSON.stringify(fixedJson, null, 2), 'utf8');
      return true;
    }
  } catch (err) {
    console.error(`[ERROR] Failed to process ${filePath}: ${err.message}`);
  }
  return false;
}

function walkDir(dir, callback) {
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch (err) {
    console.error(`[ERROR] Cannot read directory ${dir}: ${err.message}`);
    return;
  }
  entries.forEach(f => {
    const fullPath = path.join(dir, f);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (err) {
      console.error(`[ERROR] Cannot stat ${fullPath}: ${err.message}`);
      return;
    }
    if (stat.isDirectory()) {
      walkDir(fullPath, callback);
    } else if (f.toLowerCase().includes('graph') && f.endsWith('.json')) {
      callback(fullPath);
    }
  });
}

let fixedCount = 0;
walkDir(DATA_DIR, filePath => {
  if (processFile(filePath)) fixedCount++;
});
