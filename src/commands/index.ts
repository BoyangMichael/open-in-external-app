import open from './open';
import openMultiple from './openMultiple';
import openRemote from './openRemote';

const commands: CommandModule[] = [open, openMultiple, openRemote];
commands.forEach((command) => {
    command.identifier = `openInExternalApp.${command.identifier}`;
});

export default commands;
