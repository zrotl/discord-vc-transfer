import fs from 'fs';
import url from 'url';
import path from 'path';

export async function readFiles(fn) {
    // Grab all the command files from the commands directory you created earlier
    const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    // Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
    for (const file of commandFiles) {
        await fn(file);
    }
}