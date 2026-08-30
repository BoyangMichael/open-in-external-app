/* eslint-disable no-template-curly-in-string */
import assert from 'node:assert';

import { filterAppsByLocation } from '../src/openInExternalApp';

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
