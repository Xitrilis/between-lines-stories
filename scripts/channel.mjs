import fs from 'node:fs/promises';
import {checkChannel} from '../shared/github.mjs';
const [owner,repo='between-lines-stories']=process.argv.slice(2);const channel=checkChannel({owner,repo,branch:'main'});
await fs.writeFile('channel.json',JSON.stringify(channel,null,2)+'\n');
const pkg=JSON.parse(await fs.readFile('package.json','utf8'));pkg.repository={type:'git',url:`https://github.com/${owner}/${repo}.git`};pkg.build.publish={provider:'github',owner,repo,releaseType:'release'};await fs.writeFile('package.json',JSON.stringify(pkg,null,2)+'\n');
console.log(`Channel configured: ${owner}/${repo}`);
