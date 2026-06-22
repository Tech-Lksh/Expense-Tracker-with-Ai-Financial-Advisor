const fs = require('fs');

const fileContent = fs.readFileSync('client/src/pages/Analytics.jsx', 'utf8');

let braceCount = 0;
let parenCount = 0;
let bracketCount = 0;

const lines = fileContent.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.trim().startsWith('//')) continue;
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '{') braceCount++;
    else if (char === '}') braceCount--;
    else if (char === '(') parenCount++;
    else if (char === ')') parenCount--;
    else if (char === '[') bracketCount++;
    else if (char === ']') bracketCount--;

    if (braceCount < 0) {
      console.log(`Brace underflow at line ${i+1}: char ${j+1}`);
      braceCount = 0;
    }
    if (parenCount < 0) {
      console.log(`Paren underflow at line ${i+1}: char ${j+1}`);
      parenCount = 0;
    }
  }
}

console.log(`Final Counts: Braces: ${braceCount}, Parens: ${parenCount}, Brackets: ${bracketCount}`);
