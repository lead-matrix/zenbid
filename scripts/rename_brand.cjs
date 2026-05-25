const fs = require('fs');
const path = require('path');

const targetDir = path.resolve(__dirname, '..');

const excludeDirs = ['node_modules', '.git', '.gemini', 'dist', '.temp'];
const includeExts = ['.ts', '.tsx', '.json', '.md', '.html', '.css', '.js'];

function walkAndReplace(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (excludeDirs.includes(file)) continue;
      walkAndReplace(fullPath);
    } else if (stat.isFile()) {
      const ext = path.extname(file);
      if (!includeExts.includes(ext)) continue;

      try {
        let content = fs.readFileSync(fullPath, 'utf8');
        let modified = false;

        // Perform case-insensitive replacements gracefully
        if (content.includes('ZenBid')) {
          content = content.replace(/ZenBid/g, 'PeakEstimator');
          modified = true;
        }
        if (content.includes('zenbid')) {
          content = content.replace(/zenbid/g, 'peakestimator');
          modified = true;
        }
        if (content.includes('ZENBID')) {
          content = content.replace(/ZENBID/g, 'PEAKESTIMATOR');
          modified = true;
        }

        if (modified) {
          fs.writeFileSync(fullPath, content, 'utf8');
          console.log(`Updated brand name in: ${path.relative(targetDir, fullPath)}`);
        }
      } catch (err) {
        console.error(`Error reading/writing file ${fullPath}:`, err.message);
      }
    }
  }
}

console.log('Starting brand replacement (ZenBid -> PeakEstimator)...');
walkAndReplace(targetDir);
console.log('Brand replacement complete!');
