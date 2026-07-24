import assert from 'node:assert';

import { Uri } from 'vscode';

import { ApplicationLauncher } from '../src/launchers/applicationLauncher';
import type { ResolvedFile } from '../src/resolvers/baseResolver';
import { LocalResolver } from '../src/resolvers/localResolver';
import { getRemoteProviderType, RemoteResolver } from '../src/resolvers/remoteResolver';

describe('#resolverLauncher', () => {
    it('should resolve a local file uri to a local path', async () => {
        const resolver = new LocalResolver();
        const resolved = await resolver.resolve(Uri.file('/tmp/example.txt'));

        assert.strictEqual(resolved.localPath, '/tmp/example.txt');
        assert.strictEqual(resolved.providerType, 'local');
    });

    it('should expose the resolved local path to the launcher', () => {
        const launcher = new ApplicationLauncher();
        const resolved = {
            localPath: '/tmp/example.txt',
            originalUri: Uri.file('/tmp/example.txt'),
            providerType: 'local',
        } as ResolvedFile;

        assert.strictEqual(launcher.getLaunchTarget(resolved), '/tmp/example.txt');
    });

    it('should detect remote ssh uris', () => {
        const uri = Uri.parse('vscode-remote://ssh-remote+example/home/user/demo.txt');

        assert.strictEqual(getRemoteProviderType(uri), 'ssh');
    });

    it('should keep a stable cache path for the same remote uri', async () => {
        const resolver = new RemoteResolver();
        const uri = Uri.parse('vscode-remote://ssh-remote+example/home/user/demo.txt');

        const first = await resolver.resolve(uri);
        const second = await resolver.resolve(uri);
        const firstCachePath = (first.cacheInfo as { cachePath?: string } | undefined)?.cachePath;
        const secondCachePath = (second.cacheInfo as { cachePath?: string } | undefined)?.cachePath;

        assert.strictEqual(first.localPath, second.localPath);
        assert.strictEqual(firstCachePath, secondCachePath);
    });
});
