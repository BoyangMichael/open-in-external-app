import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ConfigurationTarget, Uri, workspace } from 'vscode';

import { ApplicationLauncher } from '../src/launchers/applicationLauncher';
import type { ResolvedFile } from '../src/resolvers/baseResolver';
import { LocalResolver } from '../src/resolvers/localResolver';
import {
    getRemoteProviderType,
    pruneStaleCache,
    RemoteResolver,
} from '../src/resolvers/remoteResolver';

/**
 * Builds a URI that RemoteResolver treats as a remote ("ssh") file (via a forged
 * ssh-remote+ authority) while keeping scheme 'file', so workspace.fs operations hit
 * the real local filesystem instead of requiring an actual remote connection.
 */
function fakeRemoteUri(localPath: string): Uri {
    return Uri.file(localPath).with({ authority: 'ssh-remote+test-host' });
}

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

    it('should detect wsl uris', () => {
        const uri = Uri.parse('vscode-remote://wsl+ubuntu/home/user/demo.txt');

        assert.strictEqual(getRemoteProviderType(uri), 'wsl');
    });

    it('should detect dev container and attached container uris', () => {
        const devContainer = Uri.parse('vscode-remote://dev-container+deadbeef/workspace/demo.txt');
        const attachedContainer = Uri.parse(
            'vscode-remote://attached-container+deadbeef/workspace/demo.txt',
        );

        assert.strictEqual(getRemoteProviderType(devContainer), 'container');
        assert.strictEqual(getRemoteProviderType(attachedContainer), 'container');
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

    it('should keep unsupported uri schemes as unsupported', async () => {
        const resolver = new RemoteResolver();
        const uri = Uri.parse('untitled:example.txt');

        const resolved = await resolver.resolve(uri);

        assert.strictEqual(resolved.providerType, 'unsupported');
    });

    describe('cache staleness', () => {
        let workDir: string;

        beforeEach(async () => {
            workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oiea-remote-resolver-'));
            // isolate each test's cache dir so cache entries (keyed only on authority + basename,
            // not full path) can't leak between tests or across repeated test runs
            await workspace
                .getConfiguration()
                .update(
                    'openInExternalApp.cacheDir',
                    path.join(workDir, 'cache'),
                    ConfigurationTarget.Global,
                );
        });

        afterEach(async () => {
            await workspace
                .getConfiguration()
                .update('openInExternalApp.cacheDir', undefined, ConfigurationTarget.Global);
            await fs.rm(workDir, { recursive: true, force: true });
        });

        it('should not redownload when the remote file is unchanged', async () => {
            const sourcePath = path.join(workDir, 'source.txt');
            await fs.writeFile(sourcePath, 'v1');
            const uri = fakeRemoteUri(sourcePath);

            const resolver = new RemoteResolver();
            const first = await resolver.resolve(uri);
            assert.strictEqual((first.cacheInfo as any).refreshed, true);

            const second = await resolver.resolve(uri);
            assert.strictEqual(second.localPath, first.localPath);
            assert.strictEqual((second.cacheInfo as any).refreshed, false);
            assert.strictEqual((second.cacheInfo as any).stale, false);
        });

        it('should redownload when the remote file changes', async () => {
            const sourcePath = path.join(workDir, 'source.txt');
            await fs.writeFile(sourcePath, 'v1');
            const uri = fakeRemoteUri(sourcePath);

            const resolver = new RemoteResolver();
            await resolver.resolve(uri);

            // bump mtime forward so the resolver observes a change regardless of fs timestamp resolution
            const future = new Date(Date.now() + 5000);
            await fs.writeFile(sourcePath, 'v2');
            await fs.utimes(sourcePath, future, future);

            const second = await resolver.resolve(uri);
            assert.strictEqual((second.cacheInfo as any).refreshed, true);
            const content = await fs.readFile(second.localPath, 'utf8');
            assert.strictEqual(content, 'v2');
        });

        it('should fall back to a stale cached copy when the remote file becomes unavailable', async () => {
            const sourcePath = path.join(workDir, 'source.txt');
            await fs.writeFile(sourcePath, 'v1');
            const uri = fakeRemoteUri(sourcePath);

            const resolver = new RemoteResolver();
            const first = await resolver.resolve(uri);

            // simulate the remote becoming unreachable while a cached copy still exists
            await fs.rm(sourcePath);

            const second = await resolver.resolve(uri);
            assert.strictEqual(second.localPath, first.localPath);
            assert.strictEqual((second.cacheInfo as any).stale, true);
            const content = await fs.readFile(second.localPath, 'utf8');
            assert.strictEqual(content, 'v1');
        });
    });

    describe('pruneStaleCache', () => {
        let cacheDir: string;

        beforeEach(async () => {
            cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oiea-cache-prune-'));
        });

        afterEach(async () => {
            await fs.rm(cacheDir, { recursive: true, force: true });
        });

        it('should remove entries older than maxAgeMs along with their sidecar metadata', async () => {
            const stale = path.join(cacheDir, 'stale-file.txt');
            const staleMeta = `${stale}.meta.json`;
            const fresh = path.join(cacheDir, 'fresh-file.txt');

            await fs.writeFile(stale, 'old');
            await fs.writeFile(staleMeta, JSON.stringify({ mtime: 1 }));
            await fs.writeFile(fresh, 'new');

            const old = new Date(Date.now() - 10000);
            await fs.utimes(stale, old, old);

            await pruneStaleCache(cacheDir, 5000);

            assert.strictEqual(
                await fs.access(stale).then(
                    () => true,
                    () => false,
                ),
                false,
            );
            assert.strictEqual(
                await fs.access(staleMeta).then(
                    () => true,
                    () => false,
                ),
                false,
            );
            assert.strictEqual(
                await fs.access(fresh).then(
                    () => true,
                    () => false,
                ),
                true,
            );
        });

        it('should do nothing when maxAgeMs is 0 (pruning disabled)', async () => {
            const filePath = path.join(cacheDir, 'file.txt');
            await fs.writeFile(filePath, 'content');
            const old = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365);
            await fs.utimes(filePath, old, old);

            await pruneStaleCache(cacheDir, 0);

            assert.strictEqual(
                await fs.access(filePath).then(
                    () => true,
                    () => false,
                ),
                true,
            );
        });
    });
});
