import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Uri } from 'vscode';
import vscode from 'vscode';

import type { FileResolver, ResolvedFile } from './baseResolver';
import { LocalResolver } from './localResolver';
import { pathExists } from '../utils/fs';

const DEFAULT_CACHE_DIR = join(tmpdir(), 'open-in-external-app-cache');

export function getRemoteProviderType(uri: Uri): string | undefined {
    const authority = uri.authority.toLowerCase();
    if (authority.startsWith('ssh-remote+')) return 'ssh';
    if (authority.startsWith('wsl+')) return 'wsl';
    if (authority.startsWith('vscode-remote')) return 'remote';
    return undefined;
}

export class RemoteResolver implements FileResolver {
    private readonly localResolver = new LocalResolver();

    private async ensureCacheDir(cacheDir: string): Promise<void> {
        if (!(await pathExists(cacheDir))) {
            await mkdir(cacheDir, { recursive: true });
        }
    }

    async resolve(uri: Uri): Promise<ResolvedFile> {
        const providerType = getRemoteProviderType(uri);
        if (!providerType) {
            return this.localResolver.resolve(uri);
        }

        const cacheDir = vscode.workspace
            .getConfiguration()
            .get<string>('openInExternalApp.cacheDir', DEFAULT_CACHE_DIR);

        await this.ensureCacheDir(cacheDir);

        const cacheFileName = `${uri.authority.replaceAll(/[^\w.-]/g, '_')}${uri.path.replaceAll(
            /[^\w.-]/g,
            '_',
        )}`;
        const cachePath = join(cacheDir, cacheFileName);

        if (!(await pathExists(cachePath))) {
            const bytes = await vscode.workspace.fs.readFile(uri);
            await writeFile(cachePath, bytes);
        }

        return {
            localPath: cachePath,
            originalUri: uri,
            providerType,
            cacheInfo: { cachePath },
        };
    }
}
