/* eslint-disable no-template-curly-in-string */
import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ConfigurationTarget, Uri, workspace } from 'vscode';

import openInExternalApp, { filterAppsByLocation } from '../src/openInExternalApp';

function fakeRemoteUri(localPath: string): Uri {
    return Uri.file(localPath).with({ authority: 'ssh-remote+test-host' });
}

describe('#filterAppsByLocation', () => {
    it('should treat apps without an explicit location as local (backward compatible)', () => {
        const apps = [{ title: 'a', openCommand: 'a' }];

        assert.deepStrictEqual(filterAppsByLocation(apps, 'local'), apps);
        assert.strictEqual(filterAppsByLocation(apps, 'remote'), undefined);
    });

    it('should split a mixed local/remote app list by the requested location', () => {
        const localApp = { title: 'local', openCommand: 'a', location: 'local' as const };
        const remoteApp = {
            title: 'remote',
            shellCommand: 'a ${file}',
            location: 'remote' as const,
        };

        assert.deepStrictEqual(filterAppsByLocation([localApp, remoteApp], 'local'), [localApp]);
        assert.deepStrictEqual(filterAppsByLocation([localApp, remoteApp], 'remote'), [remoteApp]);
    });

    it('should only allow a bare command string for the local location', () => {
        assert.strictEqual(filterAppsByLocation('code', 'local'), 'code');
        assert.strictEqual(filterAppsByLocation('code', 'remote'), undefined);
    });

    it('should return undefined when no app matches the requested location', () => {
        const apps = [{ title: 'a', openCommand: 'a', location: 'local' as const }];
        assert.strictEqual(filterAppsByLocation(apps, 'remote'), undefined);
    });
});

describe('#openInExternalApp remote dispatch', () => {
    let workDir: string;

    beforeEach(async () => {
        workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'oiea-open-remote-'));
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

    it('should not download/cache the remote file when opening with a remote app', async () => {
        // regression test: resolver.resolve() used to run unconditionally, downloading the
        // whole file to a local cache before ever checking whether a remote app was even
        // configured - wasted work at best, and a silent multi-second hang on a large file
        // with zero progress feedback at worst (reported after real Remote-SSH testing).
        const sourcePath = path.join(workDir, 'source.remotetest');
        await fs.writeFile(sourcePath, 'hello');

        await openInExternalApp(fakeRemoteUri(sourcePath), undefined, false, 'remote');

        const cacheDirExists = await fs.access(path.join(workDir, 'cache')).then(
            () => true,
            () => false,
        );
        assert.strictEqual(cacheDirExists, false);
    });
});
