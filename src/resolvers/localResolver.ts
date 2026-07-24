import type { Uri } from 'vscode';

import type { FileResolver, ResolvedFile } from './baseResolver';

export class LocalResolver implements FileResolver {
    async resolve(uri: Uri): Promise<ResolvedFile> {
        return {
            localPath: uri.fsPath,
            originalUri: uri,
            providerType: 'local',
        };
    }
}
