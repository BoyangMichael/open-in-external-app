/* eslint-disable no-template-curly-in-string */
import assert from 'node:assert';

import {
    buildRemoteCommand,
    extractFlatShellEnv,
} from '../src/launchers/remoteApplicationLauncher';

describe('#buildRemoteCommand', () => {
    it('should substitute ${file}-derived variables against the remote path', async () => {
        const command = await buildRemoteCommand('/home/user/project/molecule.xyz', {
            title: 'Avogadro2',
            shellCommand: 'avogadro2 ${file} --basename=${fileBasename}',
        });

        assert.strictEqual(
            command,
            'avogadro2 /home/user/project/molecule.xyz --basename=molecule.xyz',
        );
    });

    it('should return undefined when the app has no shellCommand', async () => {
        const command = await buildRemoteCommand('/home/user/project/molecule.xyz', {
            title: 'No shell command',
            openCommand: 'avogadro2',
        });

        assert.strictEqual(command, undefined);
    });
});

describe('#extractFlatShellEnv', () => {
    it('should return a flat shellEnv object as-is', () => {
        const env = extractFlatShellEnv({ TOKEN: 'abc' });
        assert.deepStrictEqual(env, { TOKEN: 'abc' });
    });

    it('should return undefined for undefined input', () => {
        assert.strictEqual(extractFlatShellEnv(), undefined);
    });

    it('should return undefined (and not apply) for per-platform shellEnv, since the remote OS is unknown', () => {
        const env = extractFlatShellEnv({ windows: { TOKEN: 'abc' } });
        assert.strictEqual(env, undefined);
    });
});
