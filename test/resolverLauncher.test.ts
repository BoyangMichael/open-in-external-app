import assert from 'node:assert';

import { Uri } from 'vscode';

import { ApplicationLauncher } from '../src/launchers/applicationLauncher';
import type { ResolvedFile } from '../src/resolvers/baseResolver';
import { LocalResolver } from '../src/resolvers/localResolver';

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
});
