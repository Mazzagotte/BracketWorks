import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/(?:([A-Za-z]):)/, '$1:');
const sourceRoots = ['app', 'components', 'styles'];
const sourceExtensions = new Set(['.css', '.js', '.jsx', '.md', '.ts', '.tsx']);
const mojibake = /(?:Ã.|Â.|â€|â‚|âƒ|ï¿½|\uFFFD)/u;
const failures = [];

async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await scan(path);
    } else if (sourceExtensions.has(extname(entry.name))) {
      const lines = (await readFile(path, 'utf8')).split(/\r?\n/u);
      lines.forEach((line, index) => {
        if (mojibake.test(line)) failures.push(`${relative(root, path)}:${index + 1}`);
      });
    }
  }
}

await Promise.all(sourceRoots.map((directory) => scan(join(root, directory))));
if (failures.length) {
  console.error(`Mojibake detected:\n${failures.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Encoding check passed.');
}
