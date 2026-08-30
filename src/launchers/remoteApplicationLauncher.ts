import vscode, { Uri } from 'vscode';
import { localize } from 'vscode-nls-i18n';

import { logger } from '../utils/logger';
import { getShellEnv, mergeEnvironments } from '../utils/platform';
import { parseVariables, type ParseVariablesOptions } from '../utils/variable';

/**
 * Builds the shell command to run for a remote app, substituting variables (${file},
 * ${fileBasename}, etc.) against the file's path on the remote host. Returns undefined
 * when the app has no shellCommand - remote apps only support shellCommand, since
 * openCommand/isElectronApp are inherently local-machine mechanisms (they call the
 * `open` npm package / vscode.env.openExternal, both of which act on the local machine).
 */
export async function buildRemoteCommand(
    remotePath: string,
    appConfig: ExternalAppConfig,
): Promise<string | undefined> {
    if (!appConfig.shellCommand) {
        return undefined;
    }

    const parseOptions: ParseVariablesOptions = {
        fsPathOverride: remotePath,
        useWindowsPath: false,
    };
    const [command] = await parseVariables(
        [appConfig.shellCommand],
        Uri.file(remotePath),
        parseOptions,
    );
    return command;
}

/**
 * Remote-specific shellEnv only supports a flat env map, not the per-platform
 * {windows, osx, linux} variant - `utils/platform.ts`'s isWindows/isMacintosh/isLinux
 * reflect the *local* machine's OS, which has no reliable relationship to the remote
 * host's OS, so selecting by local platform would be wrong here.
 */
export function extractFlatShellEnv(
    shellEnv?: NodeJS.ProcessEnv | PlatformVariables,
): NodeJS.ProcessEnv | undefined {
    if (!shellEnv) {
        return undefined;
    }
    if ('windows' in shellEnv || 'osx' in shellEnv || 'linux' in shellEnv) {
        logger.info(
            "per-platform shellEnv is not supported for remote apps (the remote host's OS is not known); ignoring",
        );
        return undefined;
    }
    return shellEnv as NodeJS.ProcessEnv;
}

export class RemoteApplicationLauncher {
    async launch(remotePath: string, appConfig: ExternalAppConfig): Promise<void> {
        const command = await buildRemoteCommand(remotePath, appConfig);
        if (!command) {
            logger.info(`remote app "${appConfig.title}" has no shellCommand, cannot launch`);
            vscode.window.showErrorMessage(
                localize('msg.error.remoteAppNeedsShellCommand', appConfig.title),
            );
            return;
        }

        let env: NodeJS.ProcessEnv | undefined;
        const flatEnv = extractFlatShellEnv(appConfig.shellEnv);
        if (flatEnv) {
            env = getShellEnv();
            await mergeEnvironments(env, flatEnv, Uri.file(remotePath), {
                fsPathOverride: remotePath,
                useWindowsPath: false,
            });
        }

        logger.info(`launching remote app "${appConfig.title}" via terminal: ${command}`);
        const terminal = vscode.window.createTerminal({ name: `Remote: ${appConfig.title}`, env });
        terminal.show();
        terminal.sendText(command);
    }
}
