/* eslint-disable no-template-curly-in-string */
import assert from 'node:assert';
import os from 'node:os';
import path from 'node:path';

import { Uri } from 'vscode';

import { parseVariables } from '../src/utils/variable';

describe('#parseVariables', () => {
    it('should substitute ${userHome} and ${pathSeparator}', async () => {
        const [userHome, sep] = await parseVariables(
            ['${userHome}', '${pathSeparator}'],
            Uri.file('/tmp/example.txt'),
        );

        assert.strictEqual(userHome, os.homedir());
        assert.strictEqual(sep, path.sep);
    });

    it('should derive file-based variables from the given active file uri', async () => {
        const uri = Uri.file('/home/user/project/notes.md');
        const [file, basename, noExtension, extname, dirname] = await parseVariables(
            [
                '${file}',
                '${fileBasename}',
                '${fileBasenameNoExtension}',
                '${fileExtname}',
                '${fileDirname}',
            ],
            uri,
        );

        assert.strictEqual(file, '/home/user/project/notes.md');
        assert.strictEqual(basename, 'notes.md');
        assert.strictEqual(noExtension, 'notes');
        assert.strictEqual(extname, '.md');
        assert.strictEqual(dirname, '/home/user/project');
    });

    it('should use fsPathOverride with win32 path semantics for the WSL Remote scenario (#83)', async () => {
        const uri = Uri.file('/home/user/project/notes.md');
        const [file, basename, dirname, sep] = await parseVariables(
            ['${file}', '${fileBasename}', '${fileDirname}', '${pathSeparator}'],
            uri,
            { fsPathOverride: 'C:\\Users\\demo\\project\\notes.md', useWindowsPath: true },
        );

        assert.strictEqual(file, 'C:\\Users\\demo\\project\\notes.md');
        assert.strictEqual(basename, 'notes.md');
        assert.strictEqual(dirname, 'C:\\Users\\demo\\project');
        assert.strictEqual(sep, '\\');
    });

    it('should substitute ${env:VAR} from process.env, leaving unknown vars untouched', async () => {
        process.env.OIEA_TEST_VAR = 'hello';
        try {
            const [known, unknown] = await parseVariables(
                ['${env:OIEA_TEST_VAR}', '${env:OIEA_DOES_NOT_EXIST}'],
                Uri.file('/tmp/example.txt'),
            );

            assert.strictEqual(known, 'hello');
            assert.strictEqual(unknown, '${env:OIEA_DOES_NOT_EXIST}');
        } finally {
            delete process.env.OIEA_TEST_VAR;
        }
    });

    it('should substitute ${config:key} from vscode configuration, falling back to the literal for unknown keys', async () => {
        const [known, unknown] = await parseVariables(
            ['${config:openInExternalApp.enableLog}', '${config:openInExternalApp.doesNotExist}'],
            Uri.file('/tmp/example.txt'),
        );

        assert.strictEqual(known, 'true');
        assert.strictEqual(unknown, '${config:openInExternalApp.doesNotExist}');
    });
});
