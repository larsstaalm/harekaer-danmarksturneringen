const fs = require('fs');

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));

const out = `// Auto-genereret af build.js - ret ikke i hånden.
window.HAREKAER_DATA = ${JSON.stringify(data)};
window.HAREKAER_UPDATED = ${JSON.stringify(new Date().toISOString())};
`;

fs.writeFileSync('data.js', out, 'utf8');
console.log(`data.js skrevet (${(out.length / 1024).toFixed(1)} KB)`);
