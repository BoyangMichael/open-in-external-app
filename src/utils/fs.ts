import { constants as FS_CONSTANTS } from 'node:fs';
import fs from 'node:fs/promises';

export function pathExists(path: string) {
    return fs
        .access(path, FS_CONSTANTS.F_OK)
        .then(() => true)
        .catch(() => false);
}

export async function readJson<T>(path: string): Promise<T | undefined> {
    try {
        return JSON.parse(await fs.readFile(path, 'utf8')) as T;
    } catch {
        return undefined;
    }
}
