const fs = require('fs');

const mdPath = '/Users/user/Raj/little-souls-flow/Catalogue-177935900645276.md';
const content = fs.readFileSync(mdPath, 'utf8');
const lines = content.split('\n');

console.log('Total lines:', lines.length);

lines.forEach((line, idx) => {
  if (!line.trim()) return;
  const parts = line.split('|').map(p => p.trim());
  // Print line number and non-empty columns (excluding image base64 if it's very long)
  const shortParts = parts.map(p => p.length > 50 ? p.slice(0, 30) + '...' : p);
  console.log(`Line ${idx + 1}:`, shortParts.join(' | '));
});
