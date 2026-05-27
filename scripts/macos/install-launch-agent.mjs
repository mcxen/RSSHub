import { chmod, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { buildSouthPlusLaunchAgentPlist, getSouthPlusLaunchAgentPaths } from '../../lib/local-forward/south-plus/launchd.ts';

const repoPath = process.cwd();
const { launchAgentsDir, logsDir, plistPath } = getSouthPlusLaunchAgentPaths();

await mkdir(launchAgentsDir, { recursive: true });
await mkdir(logsDir, { recursive: true });
await chmod(path.join(repoPath, 'scripts', 'macos', 'start-rsshub.sh'), 0o755);
await writeFile(plistPath, buildSouthPlusLaunchAgentPlist(repoPath), 'utf-8');

process.stdout.write(`LaunchAgent plist written to ${plistPath}\n`);
