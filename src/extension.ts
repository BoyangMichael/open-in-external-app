import { join } from 'node:path';

import vscode from 'vscode';
import { init } from 'vscode-nls-i18n';

import commands from './commands';
import { maybePruneRemoteCache, setDefaultCacheDir } from './resolvers/remoteResolver';
import { logger } from './utils/logger';

export function activate(context: vscode.ExtensionContext): void {
    init(context.extensionPath);

    logger.info(`language: ${vscode.env.language}`);
    const { remoteName } = vscode.env;
    if (remoteName) {
        logger.info(`active extension in ${remoteName} remote environment`);
    }

    // Prefer the extension's own dedicated storage directory over the OS temp
    // folder: it's guaranteed exclusive to this extension (no risk of touching
    // another app's files) and isn't subject to unpredictable OS-level cleanup,
    // which would otherwise defeat the point of caching. Users can still override
    // via openInExternalApp.cacheDir.
    setDefaultCacheDir(join(context.globalStorageUri.fsPath, 'remote-file-cache'));

    maybePruneRemoteCache().catch((error) => logger.info(`cache pruning failed: ${error}`));

    commands.forEach((command) => {
        context.subscriptions.push(
            vscode.commands.registerCommand(command.identifier!, command.handler),
        );
    });
}

export function deactivate(): void {
    logger.dispose();
}
