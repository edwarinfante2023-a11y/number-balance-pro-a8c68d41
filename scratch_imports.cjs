const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      processDir(full);
    } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
      let content = fs.readFileSync(full, 'utf8');
      let changed = false;
      const targets = ['lottery', 'rulesEngine', 'patternsEngine', 'opportunityEngine', 'alertsEngine'];
      for (const t of targets) {
        if (content.includes(`@/lib/${t}`) || content.includes(`../lib/${t}`) || content.includes(`./lib/${t}`) || content.includes(`../../lib/${t}`)) {
           content = content.replace(new RegExp(`@/lib/${t}`, 'g'), `@shared/${t}`);
           content = content.replace(new RegExp(`\\.\\./lib/${t}`, 'g'), `@shared/${t}`);
           content = content.replace(new RegExp(`\\.\\./\\.\\./lib/${t}`, 'g'), `@shared/${t}`);
           content = content.replace(new RegExp(`import \\{ [^\\}]+\\} from "\\.\\/${t}";?`, 'g'), (match) => match.replace(`./${t}`, `@shared/${t}`));
           changed = true;
        }
      }
      if (changed) {
        fs.writeFileSync(full, content);
        console.log('Fixed', full);
      }
    }
  }
}
processDir('./src');
