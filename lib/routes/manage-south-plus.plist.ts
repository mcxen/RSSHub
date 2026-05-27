import type { Handler } from 'hono';

import { buildSouthPlusLaunchAgentPlist } from '@/local-forward/south-plus/launchd';

const handler: Handler = (ctx) => {
    ctx.header('Content-Type', 'application/xml; charset=utf-8');
    ctx.header('Content-Disposition', 'attachment; filename="cc.rsshub.south-plus.plist"');
    ctx.header('Cache-Control', 'no-cache');

    return ctx.body(buildSouthPlusLaunchAgentPlist(process.cwd()));
};

export default handler;
