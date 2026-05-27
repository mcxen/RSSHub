import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { SouthPlusForwardConfig } from './shared';
import { buildSouthPlusForumUrl, southPlusDefaultForumId } from './shared';

const getSouthPlusStorageDirectory = () => (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support', 'RSSHub') : path.join(os.homedir(), '.rsshub'));

const getSouthPlusConfigPath = () => path.join(getSouthPlusStorageDirectory(), 'south-plus-forward.json');

const getDefaultSouthPlusConfig = (): SouthPlusForwardConfig => ({
    cookie: '',
    forumUrl: buildSouthPlusForumUrl(southPlusDefaultForumId),
    updatedAt: new Date(0).toISOString(),
});

const readSouthPlusConfig = async (): Promise<SouthPlusForwardConfig> => {
    try {
        const raw = await readFile(getSouthPlusConfigPath(), 'utf-8');
        const parsed = JSON.parse(raw) as Partial<SouthPlusForwardConfig>;

        return {
            cookie: parsed.cookie?.trim() ?? '',
            forumUrl: parsed.forumUrl?.trim() || buildSouthPlusForumUrl(southPlusDefaultForumId),
            updatedAt: parsed.updatedAt ?? new Date(0).toISOString(),
        };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return getDefaultSouthPlusConfig();
        }

        throw error;
    }
};

const saveSouthPlusConfig = async (config: SouthPlusForwardConfig) => {
    await mkdir(getSouthPlusStorageDirectory(), { recursive: true });
    await writeFile(getSouthPlusConfigPath(), JSON.stringify(config, null, 2), 'utf-8');
    return config;
};

export { getSouthPlusConfigPath, readSouthPlusConfig, saveSouthPlusConfig };
