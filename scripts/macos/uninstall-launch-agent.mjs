import { rm } from 'node:fs/promises';

import { getSouthPlusLaunchAgentPaths } from '../../lib/local-forward/south-plus/launchd.ts';

const { plistPath } = getSouthPlusLaunchAgentPaths();

await rm(plistPath, { force: true });

process.stdout.write(`LaunchAgent plist removed from ${plistPath}\n`);
