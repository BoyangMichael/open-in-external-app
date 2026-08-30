declare module 'wsl-path';

interface CommandModule {
    identifier: string;
    handler: (...args: any[]) => any;
}

interface PlatformVariables {
    windows?: NodeJS.ProcessEnv;
    linux?: NodeJS.ProcessEnv;
    osx?: NodeJS.ProcessEnv;
}

interface ExternalAppConfig {
    title: string;
    openCommand?: string;
    args?: string[];
    isElectronApp?: boolean;
    shellCommand?: string;
    shellEnv?: NodeJS.ProcessEnv | PlatformVariables;
    /**
     * Whether to convert WSL path to Windows path when running in WSL remote mode.
     * Only applies when vscode.env.remoteName === 'wsl'.
     * @default true - Convert to Windows path (e.g., /home/user/file -> C:\Users\user\file)
     * @example false - Keep WSL native path for WSL applications like evince
     */
    wslConvertWindowsPath?: boolean;
    /**
     * Where this app runs. 'local' (default) launches it on the machine running VS Code,
     * the same as before this field existed. 'remote' launches it on the remote (SSH/WSL/
     * container) host via a VS Code integrated terminal instead - only offered when the
     * resolved file actually lives on a remote host. Remote apps only support shellCommand
     * (openCommand/isElectronApp are inherently local-machine mechanisms).
     * @default 'local'
     */
    location?: 'local' | 'remote';
}

interface ExtensionConfigItem {
    id: string;
    extensionName: string | string[];
    apps: ExternalAppConfig[] | string;
}
