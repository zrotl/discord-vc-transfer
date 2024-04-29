// import fs from 'fs';
// import url from 'url';
// import path from 'path';
import { Client, Collection, Events, GatewayIntentBits } from 'discord.js';
import { readFiles } from './readfile.js';
import { AudioMixer } from 'node-audio-mixer';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { LISTENER, SPEAKER } = require('./config.json');

const client1 = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const client2 = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });

let connections = [];

// Listenner-botに対してのみコマンドを割り当てる。
client1.commands = new Collection();

await readFiles(async filePath => {
	const { default: command } = await import('./commands/'+filePath);

	// 取得した.jsファイル内の情報から、コマンドと名前をListenner-botに対して設定
	if ('data' in command && 'execute' in command) {
		client1.commands.set(command.data.name, command);
		console.log('SetCommand: '+command.data.name);
	} else {
		console.log(`[WARNING]  ${filePath} のコマンドには、必要な "data" または "execute" プロパティがありません。`);
	}
});

// // commandsフォルダから、.jsで終わるファイルのみを取得
// const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
// const commandsPath = path.join(__dirname, 'commands');
// const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// for (const file of commandFiles) {
// 	const filePath = path.join(commandsPath, file);
// 	const { default: command } = await import(filePath);

// 	// 取得した.jsファイル内の情報から、コマンドと名前をListenner-botに対して設定
// 	if ('data' in command && 'execute' in command) {
// 		client1.commands.set(command.data.name, command);
// 		console.log('SetCommand: '+command.data.name);
// 	} else {
// 		console.log(`[WARNING]  ${filePath} のコマンドには、必要な "data" または "execute" プロパティがありません。`);
// 	}
// }

global.mixer = new AudioMixer({
	sampleRate: 48000,
	bitDepth: 16,
	channels: 2,
	generateSilent: true,
	autoClose: false,
});

// コマンドが送られてきた際の処理
client1.on(Events.InteractionCreate, async interaction => {
    // コマンドでなかった場合は処理せずさよなら。
	if (!interaction.isChatInputCommand() && !interaction.isAutocomplete()) return;

	const command = interaction.client.commands.get(interaction.commandName);

    // 一致するコマンドがなかった場合
	if (!command) {
		console.error(` ${interaction.commandName} というコマンドは存在しません。`);
		return;
	}

	try {
        // コマンドを実行
		switch (interaction.commandName) {
			case 'join':
			case 'stream':
			case 'streamnew':
			case 'autocomplete':
				connections = await command.execute(interaction, client1, client2);
				break;
			case 'record':
				await command.execute(interaction, connections[0]);
				break;
			case 'play':
				await command.execute(interaction, connections[1]);
				break;
			case 'bye':
				await command.execute(interaction, connections);
				break;
			default:
				await command.execute(interaction);
		}
		// if (interaction.commandName === 'join' || interaction.commandName === 'stream' || interaction.commandName ===  'autocomplete') {
		// 	connections = await command.execute(interaction, client1, client2);
		// }
		// else if (interaction.commandName === 'record') {
		// 	await command.execute(interaction, connections[0]);
		// }
		// else if (interaction.commandName === 'play') {
		// 	await command.execute(interaction, connections[1]);
		// }
		// else if (interaction.commandName === 'bye') {
		// 	await command.execute(interaction, connections);
		// }
		// else {
		// 	await command.execute(interaction);
		// }
		if (interaction.isAutocomplete()) {
			await command.autocomplete(interaction);
		}
	} catch (error) {
		console.error(error);
		await interaction.reply({ content: 'コマンドを実行中にエラーが発生しました。', ephemeral: true });
	}
});

client1.once(Events.ClientReady, c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
});

client2.once(Events.ClientReady, c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
});

client1.login(LISTENER.TOKEN);
client2.login(SPEAKER.TOKEN);
