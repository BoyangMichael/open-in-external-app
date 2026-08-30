import { extname } from 'node:path';

import type { Uri } from 'vscode';
import vscode from 'vscode';
import { localize } from 'vscode-nls-i18n';

import getExtensionConfig from './config';
import { ApplicationLauncher } from './launchers/applicationLauncher';
import { RemoteApplicationLauncher } from './launchers/remoteApplicationLauncher';
import type { ResolvedFile } from './resolvers/baseResolver';
import { getRemoteProviderType, RemoteResolver } from './resolvers/remoteResolver';
import { logger } from './utils/logger';
import { open } from './utils/open';
import { getActiveFileUri } from './utils/uri';

function getFallbackConfigItem(configuration: ExtensionConfigItem[]) {
    return configuration?.find((item) => item.extensionName === '*');
}

function getConfigItemByExtName(configuration: ExtensionConfigItem[], extensionName: string) {
    logger.info('find config by extensionName');
    const matchedConfigItem = configuration.find((item) =>
        Array.isArray(item.extensionName)
            ? item.extensionName.includes(extensionName)
            : item.extensionName === extensionName,
    );
    return matchedConfigItem ?? getFallbackConfigItem(configuration);
}

function getConfigItemById(configuration: ExtensionConfigItem[], configItemId: string) {
    logger.info('find config by configItemId');
    return (
        configuration.find((item) => item.id === configItemId) ??
        getFallbackConfigItem(configuration)
    );
}

function getSharedConfigItem(configuration: ExtensionConfigItem[]) {
    return configuration.find((item) => item.extensionName === '__ALL__');
}

/**
 * Splits an app list down to the ones matching the requested location. Apps without an
 * explicit `location` default to 'local', so existing configs (written before `location`
 * existed) keep working unchanged under the 'local' path. A bare command string is only
 * usable for 'local' - there's no way to mark it 'remote'.
 */
export function filterAppsByLocation(
    apps: ExternalAppConfig[] | string,
    location: 'local' | 'remote',
): ExternalAppConfig[] | string | undefined {
    if (typeof apps === 'string') {
        return location === 'local' ? apps : undefined;
    }
    const filtered = apps.filter((app) => (app.location ?? 'local') === location);
    return filtered.length > 0 ? filtered : undefined;
}

const resolver = new RemoteResolver();
const launcher = new ApplicationLauncher();
const remoteLauncher = new RemoteApplicationLauncher();

async function launchApp(
    filePath: string,
    appConfig: ExternalAppConfig | string,
    location: 'local' | 'remote',
) {
    if (location === 'remote') {
        // filterAppsByLocation never lets a bare string through for 'remote'
        await remoteLauncher.launch(filePath, appConfig as ExternalAppConfig);
        return;
    }
    await open(filePath, appConfig);
}

/** Returns whether any app matching `location` was found (and therefore handled). */
async function openWithConfigItem(
    filePath: string,
    matchedConfigItem: ExtensionConfigItem,
    isMultiple: boolean,
    location: 'local' | 'remote',
): Promise<boolean> {
    logger.info(`open with configItem:\n${JSON.stringify(matchedConfigItem, undefined, 4)}`);

    const candidateApps = filterAppsByLocation(matchedConfigItem.apps, location);
    if (candidateApps === undefined) {
        return false;
    }

    if (typeof candidateApps === 'string') {
        await launchApp(filePath, candidateApps, location);
        return true;
    }

    if (candidateApps.length === 1) {
        await launchApp(filePath, candidateApps[0], location);
        return true;
    }

    // check repeat in candidateApps
    let isRepeat = false;
    const traversedTitles = new Set();
    for (let i = 0, len = candidateApps.length; i < len; i++) {
        const { title } = candidateApps[i];
        if (traversedTitles.has(title)) {
            isRepeat = true;
            break;
        }
        traversedTitles.add(title);
    }
    if (isRepeat) {
        vscode.window.showErrorMessage(localize('msg.error.sameTitleMultipleApp'));
        return true;
    }

    const pickerItems = candidateApps.map((app) => app.title);
    if (isMultiple) {
        const selectedTitles = await vscode.window.showQuickPick(pickerItems, {
            canPickMany: true,
            placeHolder: localize('msg.quickPick.selectApps.placeholder'),
        });
        if (selectedTitles) {
            selectedTitles.forEach(async (title) => {
                await launchApp(
                    filePath,
                    candidateApps.find((app) => app.title === title)!,
                    location,
                );
            });
        }
    } else {
        const selectedTitle = await vscode.window.showQuickPick(pickerItems, {
            placeHolder: localize('msg.quickPick.selectApp.placeholder'),
        });

        if (selectedTitle) {
            await launchApp(
                filePath,
                candidateApps.find((app) => app.title === selectedTitle)!,
                location,
            );
        }
    }
    return true;
}

export default async function openInExternalApp(
    uri: Uri | undefined,
    configItemId?: string,
    isMultiple = false,
    location: 'local' | 'remote' = 'local',
): Promise<void> {
    // if run command with command plate, uri is undefined, fallback to activeTextEditor
    uri ??= vscode.window.activeTextEditor?.document.uri ?? (await getActiveFileUri());
    if (!uri) return;

    let filePath: string;
    let launchPath: string;
    let resolvedFile: ResolvedFile | undefined;

    if (location === 'remote') {
        const providerType = getRemoteProviderType(uri);
        if (!providerType || uri.scheme !== 'vscode-remote') {
            vscode.window.showInformationMessage(localize('msg.info.notARemoteFile'));
            return;
        }
        // A remote app runs against the file's real path on the remote host - skip
        // downloading/caching it locally, which is unnecessary work here (and would
        // silently hang with no progress feedback on a large file).
        filePath = uri.path;
        launchPath = uri.path;
    } else {
        resolvedFile = await resolver.resolve(uri);
        filePath = resolvedFile.localPath;
        launchPath = filePath;
    }

    // when there is configuration map to it's extension, use [open](https://github.com/sindresorhus/open)
    // except for configured appConfig.isElectronApp option
    let matchedConfigItem: ExtensionConfigItem | undefined;
    const configuration = getExtensionConfig();
    if (configItemId === undefined) {
        const ext = extname(filePath);
        const extensionName = ext === '' || ext === '.' ? null : ext.slice(1);
        logger.info(`parsed extension name: ${extensionName}`);
        if (extensionName) {
            matchedConfigItem = getConfigItemByExtName(configuration, extensionName);
        } else {
            // For files without extension, try to get fallback config (extensionName: "*")
            matchedConfigItem = getFallbackConfigItem(configuration);
        }
    } else {
        matchedConfigItem = getConfigItemById(configuration, configItemId);
    }

    const sharedConfigItem = getSharedConfigItem(configuration);

    let handled = false;
    if (matchedConfigItem) {
        logger.info('found matched config');
        handled = await openWithConfigItem(launchPath, matchedConfigItem, isMultiple, location);
    } else if (!sharedConfigItem && location === 'local') {
        // Only use system default when there's no matched config and no shared config.
        // There's no sensible "system default" for a remote app. resolvedFile is always
        // set here: this branch only runs when location === 'local'.
        logger.info('no matched config and no shared config');
        await launcher.launch(resolvedFile!);
        handled = true;
    } else {
        logger.info('no matched config, but found shared config');
    }

    if (sharedConfigItem) {
        logger.info('found shared config');
        const sharedHandled = await openWithConfigItem(
            launchPath,
            sharedConfigItem,
            false,
            location,
        );
        handled = handled || sharedHandled;
    }

    if (location === 'remote' && !handled) {
        vscode.window.showInformationMessage(localize('msg.info.noRemoteAppConfigured'));
    }
}
