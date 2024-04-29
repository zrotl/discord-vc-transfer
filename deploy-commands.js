// import fs from 'fs';
// import url from 'url';
// import path from 'path';
import { REST, Routes } from 'discord.js';
import { readFiles } from './readfile.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { LISTENER } = require('./config.json');

const commands = [];

await readFiles(async filePath => {
	const { default: command } = await import('./commands/'+filePath);
	commands.push(command.data.toJSON());
});

// // Grab all the command files from the commands directory you created earlier
// const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
// const commandsPath = path.join(__dirname, 'commands');
// const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// // Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
// for (const file of commandFiles) {
// 	const filePath = path.join(commandsPath, file);
// 	const { default: command } = await import(filePath);
// 	commands.push(command.data.toJSON());
// }

// Construct and prepare an instance of the REST module
const rest = new REST({ version: '10' }).setToken(LISTENER.TOKEN);

// and deploy your commands!
(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		// The put method is used to fully refresh all commands in the guild with the current set
		const data = await rest.put(
			Routes.applicationCommands(LISTENER.CLIENT_ID),
			{ body: commands },
		);

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
})();