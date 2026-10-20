import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fetchLibrary} from '../shared/github.mjs';
const channel=JSON.parse(await fs.readFile('channel.json','utf8'));
const library=await fetchLibrary(channel);assert.ok(library.chapters.length>0);assert.ok(library.chapters.some(c=>c.messages.length>=7));
const response=await fetch(`https://api.github.com/repos/${channel.owner}/${channel.repo}/releases/latest`);assert.ok(response.ok);const release=await response.json();assert.ok(release.assets.some(a=>a.name.endsWith('.exe')));assert.ok(release.assets.some(a=>a.name==='latest.yml'));
console.log('LIVE VERIFIED: public chapter and Windows release available to an unauthenticated reader');
