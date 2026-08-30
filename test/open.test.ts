/* eslint-disable no-template-curly-in-string */
import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { open } from '../src/utils/open';

/**
 * Covers the shellCommand execution path of open() with a real (deterministic,
 * side-effect-free) shell command instead of mocking child_process.exec - this
 * project has no mocking library, and the actual point of this path (variable
 * substitution + env merging feeding into a real exec call) is best verified end
 * to end. The openCommand/isElectronApp/default paths spawn real OS-level "open
 * with default app" behavior and are deliberately not covered here - there's no
 * safe, deterministic way to assert that in CI. Only run on POSIX: cmd.exe quoting
 * differs enough from sh that a single portable command string isn't worth chasing
 * for this coverage.
 */
describe('#open shellCommand execution', () => {
    before(function () {
        if (process.platform === 'win32') this.skip();
    });

    let dir: string;

    beforeEach(async () => {
        dir = await fs.mkdtemp(path.join(os.tmpdir(), 'oiea-open-test-'));
    });

    afterEach(async () => {
        await fs.rm(dir, { recursive: true, force: true });
    });

    it('should substitute ${file} into the shell command and execute it', async () => {
        const targetFile = path.join(dir, 'target.txt');
        const outFile = path.join(dir, 'out.txt');
        await fs.writeFile(targetFile, 'hello');

        await open(targetFile, {
            title: 'test',
            shellCommand: `echo "opened:\${file}" > "${outFile}"`,
        });

        const content = await fs.readFile(outFile, 'utf8');
        assert.strictEqual(content.trim(), `opened:${targetFile}`);
    });

    it('should merge shellEnv into the exec environment', async () => {
        const targetFile = path.join(dir, 'target.txt');
        const outFile = path.join(dir, 'out.txt');
        await fs.writeFile(targetFile, 'hello');

        await open(targetFile, {
            title: 'test',
            shellCommand: `echo "$OIEA_TEST_ENV" > "${outFile}"`,
            shellEnv: { OIEA_TEST_ENV: 'injected-value' },
        });

        const content = await fs.readFile(outFile, 'utf8');
        assert.strictEqual(content.trim(), 'injected-value');
    });

    it('should substitute variables inside shellEnv values too', async () => {
        const targetFile = path.join(dir, 'target.txt');
        const outFile = path.join(dir, 'out.txt');
        await fs.writeFile(targetFile, 'hello');

        await open(targetFile, {
            title: 'test',
            shellCommand: `echo "$OIEA_TEST_ENV" > "${outFile}"`,
            shellEnv: { OIEA_TEST_ENV: '${fileBasename}' },
        });

        const content = await fs.readFile(outFile, 'utf8');
        assert.strictEqual(content.trim(), 'target.txt');
    });
});
