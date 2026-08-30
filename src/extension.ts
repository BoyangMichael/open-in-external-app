import vscode from 'vscode';
import { init } from 'vscode-nls-i18n';

import commands from './commands';
import { maybePruneRemoteCache } from './resolvers/remoteResolver';
import { logger } from './utils/logger';

export function activate(context: vscode.ExtensionContext): void {
    init(context.extensionPath);

    logger.info(`language: ${vscode.env.language}`);
    const { remoteName } = vscode.env;
    if (remoteName) {
        logger.info(`active extension in ${remoteName} remote environment`);
    }

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
