const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../public/data');
const OUTPUT_FILE = path.join(DATA_DIR, 'storyMap.json');

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    return null;
  }
}

function getDirectories(srcPath) {
  return fs.existsSync(srcPath)
    ? fs.readdirSync(srcPath).filter(f => fs.statSync(path.join(srcPath, f)).isDirectory())
    : [];
}

function getFiles(srcPath) {
  return fs.existsSync(srcPath)
    ? fs.readdirSync(srcPath).filter(f => fs.statSync(path.join(srcPath, f)).isFile())
    : [];
}

function getStoryFromFolders(storyDir, storyId) {
  const chapterDirs = getDirectories(storyDir).filter(d => !d.startsWith('00_') && !d.startsWith('99_'));
  return {
    id: storyId,
    title: path.basename(storyDir),
    path: path.relative(DATA_DIR, storyDir).replace(/\\/g, '/'),
    chapters: chapterDirs.map(chapterName => {
      const chapterPath = path.join(storyDir, chapterName);
      const chapterMeta = readJsonSafe(path.join(chapterPath, 'chapter_content.json')) || {};
      const chapterTitle = chapterMeta.title || chapterName;
      const substories = [];
      const seenIds = new Set();
      getFiles(chapterPath)
        .filter(f => f.endsWith('_content.json') && f.startsWith('substory'))
        .forEach(subFile => {
          const subMeta = readJsonSafe(path.join(chapterPath, subFile)) || {};
          let baseId = subMeta.id || subFile.replace('_content.json', '');

          let uniqueId = baseId;
          if (seenIds.has(baseId)) {
            uniqueId = `${baseId}_${subFile.replace('_content.json', '')}`;
          }
          seenIds.add(uniqueId);

          const subPrefix = subFile.split('_content')[0];
          const graphFile = getFiles(chapterPath).find(f => f.startsWith(subPrefix + '_graph') && f.endsWith('.json'));
          substories.push({
            id: uniqueId,
            title: subMeta.title || subFile.replace('_content.json', ''),
            graphPath: graphFile ? path.relative(DATA_DIR, path.join(chapterPath, graphFile)).replace(/\\/g, '/') : null
          });
        });
      return {
        id: chapterMeta.id || chapterName,
        title: chapterTitle,
        path: path.relative(DATA_DIR, chapterPath).replace(/\\/g, '/'),
        substories
      };
    })
  };
}

function main() {
  let stories = [];

  const indexJsonPath = path.join(DATA_DIR, 'index.json');
  let indexStories = [];
  if (fs.existsSync(indexJsonPath)) {
    indexStories = readJsonSafe(indexJsonPath) || [];
    if (Array.isArray(indexStories)) {
      for (const s of indexStories) {
        if ((s.title || s.id) === 'USAID and Wuhan Labs') {
          const storyDir = path.join(DATA_DIR, s.path || s.id);
          if (fs.existsSync(storyDir) && getDirectories(storyDir).length > 0) {
            stories.push(getStoryFromFolders(storyDir, s.id));
          } else {
            stories.push(s);
          }
        } else {
          stories.push(s);
        }
      }
    }
  }

  const allStoryDirs = getDirectories(DATA_DIR).filter(d => !['.', '..', 'storyMap.json', 'index.json'].includes(d));
  for (const dir of allStoryDirs) {
    const alreadyExists = indexStories.some(s => s.id === dir || s.path === dir || s.title === dir);
    if (!alreadyExists) {
      const storyDir = path.join(DATA_DIR, dir);
      stories.push(getStoryFromFolders(storyDir, dir));
    }
  }

  const usaidIndex = stories.findIndex(s => (s.title || s.id) === 'USAID and Wuhan Labs');
  if (usaidIndex > -1) {
    const usaidStory = stories.splice(usaidIndex, 1)[0];
    stories.unshift(usaidStory);
  }
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(stories, null, 2), 'utf-8');
}

if (require.main === module) {
  main();
}
