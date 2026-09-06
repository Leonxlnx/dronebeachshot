import fs from 'node:fs';
import path from 'node:path';
const files=fs.readdirSync('src',{recursive:true}).filter(p=>/\.(ts|css)$/.test(p));let errors=[];for(const p of files){const text=fs.readFileSync(path.join('src',p),'utf8');if(/\b(TODO|FIXME)\b/.test(text))errors.push(p+' contains unfinished markers');if(/https?:\/\//.test(text))errors.push(p+' has runtime hotlink');if(/Math\.random\(/.test(text))errors.push(p+' has nondeterministic randomness')}
if(errors.length){console.error(errors.join('\n'));process.exit(1)}console.log('SOURCE_CHECK_PASS: '+files.length+' files; no hotlinks or unseeded randomness');
