const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '../public/data/USAID and Wuhan Labs');

function getAllGraphFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllGraphFiles(filePath));
    } else if (/substory\d*_graph.*\.json$/.test(file)) {
      results.push(filePath);
    }
  });
  return results;
}

function normalizeGraphFile(filePath) {
  let changed = false;
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (e) {
    console.error('Failed to read', filePath, e);
    return false;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error('Invalid JSON in', filePath, e);
    return false;
  }

  if (Array.isArray(data)) {
    data = { nodes: data, links: [] };
    changed = true;
  } else if (typeof data === 'object' && data !== null) {
    if ('nodes' in data && 'links' in data) {
    } else {
      const keys = Object.keys(data).filter(k => Array.isArray(data[k]));
      let nodes = [];
      let links = [];
      if (keys.length === 2 && keys.includes('nodes') && keys.includes('links')) {
        nodes = data['nodes'];
        links = data['links'];
        data = { nodes, links };
        changed = true;
      } else if (keys.length === 1) {
        if (keys[0] === 'nodes') {
          nodes = data['nodes'];
          links = [];
        } else if (keys[0] === 'links') {
          nodes = [];
          links = data['links'];
        } else {
          nodes = data[keys[0]];
          links = [];
        }
        data = { nodes, links };
        changed = true;
      } else if (keys.length > 2) {
        nodes = data['nodes'] || [];
        links = data['links'] || [];
        data = { nodes, links };
        changed = true;
      }
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }
  return changed;
}

function main() {
  const files = getAllGraphFiles(BASE_DIR);
  let count = 0;
  files.forEach(file => {
    if (normalizeGraphFile(file)) count++;
  });
}

if (require.main === module) {
  main();
}
