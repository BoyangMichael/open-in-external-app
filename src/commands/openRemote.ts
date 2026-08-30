import { parseArgs } from './open';
import openInExternalApp from '../openInExternalApp';

const command: CommandModule = {
    identifier: 'openRemote',
    async handler(...args: any[]): Promise<void> {
        return openInExternalApp(...parseArgs(args), false, 'remote');
    },
};

export default command;
