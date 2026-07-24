import type { ResolvedFile } from '../resolvers/baseResolver';
import { open } from '../utils/open';

export class ApplicationLauncher {
    getLaunchTarget(resolvedFile: ResolvedFile): string {
        return resolvedFile.localPath;
    }

    async launch(
        resolvedFile: ResolvedFile,
        appConfig?: string | ExternalAppConfig,
    ): Promise<void> {
        await open(this.getLaunchTarget(resolvedFile), appConfig);
    }
}
