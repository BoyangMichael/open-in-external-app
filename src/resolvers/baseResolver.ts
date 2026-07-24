import type { Uri } from 'vscode';

export interface ResolvedFile {
    localPath: string;
    originalUri: Uri;
    providerType: string;
    cacheInfo?: unknown;
    cleanupHint?: unknown;
}

export interface FileResolver {
    resolve(uri: Uri): Promise<ResolvedFile>;
}
