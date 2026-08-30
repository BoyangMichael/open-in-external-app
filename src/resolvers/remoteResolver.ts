import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import type { Uri } from 'vscode';
import vscode from 'vscode';
import { localize } from 'vscode-nls-i18n';

import type { FileResolver, ResolvedFile } from './baseResolver';
import { LocalResolver } from './localResolver';
import { pathExists, readJson } from '../utils/fs';
import { logger } from '../utils/logger';

const DEFAULT_CACHE_DIR = join(tmpdir(), 'open-in-external-app-cache');

export function getRemoteProviderType(uri: Uri): string | undefined {
    const authority = uri.authority.toLowerCase();
    if (authority.startsWith('ssh-remote+')) return 'ssh';
    if (authority.startsWith('wsl+')) return 'wsl';
    if (authority.startsWith('vscode-remote')) return 'remote';
    return undefined;
}

interface CacheMeta {
    mtime: number;
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

        if (uri.scheme !== 'vscode-remote' && uri.scheme !== 'file') {
            return {
                localPath: uri.fsPath,
                originalUri: uri,
                providerType: 'unsupported',
            };
        }

        const cacheDir = vscode.workspace
            .getConfiguration()
            .get<string>('openInExternalApp.cacheDir', DEFAULT_CACHE_DIR);

        await this.ensureCacheDir(cacheDir);

        const cacheFileName = basename(uri.path) || 'remote-file';
        const safeAuthority = uri.authority.replaceAll(/[^\w.-]/g, '_');
        const cachePath = join(cacheDir, `${safeAuthority}-${cacheFileName}`);
        const metaPath = `${cachePath}.meta.json`;
        const cacheExisted = await pathExists(cachePath);

        let refreshed = false;
        let staleFallback = false;
        try {
            const remoteMtime = (await vscode.workspace.fs.stat(uri)).mtime;
            const cachedMeta = cacheExisted ? await readJson<CacheMeta>(metaPath) : undefined;

            if (!cacheExisted || cachedMeta?.mtime !== remoteMtime) {
                logger.info(`downloading remote file "${uri.toString()}" to cache`);
                const bytes = await vscode.workspace.fs.readFile(uri);
                await writeFile(cachePath, bytes);
                await writeFile(metaPath, JSON.stringify({ mtime: remoteMtime }));
                refreshed = true;
            }
        } catch (error) {
            if (cacheExisted) {
                staleFallback = true;
                logger.info(
                    `failed to refresh remote file "${uri.toString()}", using stale cache: ${error}`,
                );
                vscode.window.showWarningMessage(
                    localize('msg.warning.remoteFileStale', uri.fsPath),
                );
            } else {
                logger.info(`failed to resolve remote file "${uri.toString()}": ${error}`);
                vscode.window.showErrorMessage(
                    localize('msg.error.remoteFileUnavailable', uri.fsPath),
                );
                throw error;
            }
        }

        return {
            localPath: cachePath,
            originalUri: uri,
            providerType,
            cacheInfo: { cachePath, cached: true, refreshed, stale: staleFallback },
        };
    }
}
