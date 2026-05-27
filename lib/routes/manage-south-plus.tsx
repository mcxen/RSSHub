import type { Handler } from 'hono';

import { summarizeSouthPlusConfig } from '@/local-forward/south-plus/shared';
import { getSouthPlusConfigPath, readSouthPlusConfig } from '@/local-forward/south-plus/store';
import SouthPlusManagerPage from '@/views/south-plus-manager';

const handler: Handler = async (ctx) => {
    ctx.header('Cache-Control', 'no-cache');

    const config = await readSouthPlusConfig();
    const origin = new URL(ctx.req.url).origin;

    return ctx.html(
        <SouthPlusManagerPage config={summarizeSouthPlusConfig(config)} configPath={getSouthPlusConfigPath()} currentOrigin={origin} plistPath={`${origin}/manage/south-plus/launch-agent.plist`} repoPath={process.cwd()} />
    );
};

export default handler;
