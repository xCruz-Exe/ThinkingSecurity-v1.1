// Usage: node add-hash.js path/to/scam-image1.png path/to/scam-image2.jpg ...
// Adds one or more reference images to scam-hashes.json so the bot
// recognizes them (and close variants) in the future.

const fs = require('fs');
const path = require('path');
const { sha256, pHash } = require('./hashUtil');

const DB_PATH = path.join(__dirname, 'scam-hashes.json');

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.log('Usage: node add-hash.js <image1> <image2> ...');
    process.exit(1);
  }

  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

  for (const file of files) {
    if (!fs.existsSync(file)) {
      console.log(`Skipping (not found): ${file}`);
      continue;
    }
    const buffer = fs.readFileSync(file);
    const sha = sha256(buffer);
    const ph = await pHash(buffer);

    if (!db.sha256.includes(sha)) db.sha256.push(sha);
    if (!db.phash.includes(ph)) db.phash.push(ph);

    console.log(`Added: ${file}`);
    console.log(`  sha256: ${sha}`);
    console.log(`  phash : ${ph}`);
  }

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  console.log(`\nSaved ${db.sha256.length} exact hashes and ${db.phash.length} perceptual hashes to scam-hashes.json`);
}

main();
