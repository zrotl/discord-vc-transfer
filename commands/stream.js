import { SlashCommandBuilder, ChannelType } from 'discord.js';
import { VoiceConnectionStatus, joinVoiceChannel, createAudioPlayer, NoSubscriberBehavior, EndBehaviorType, createAudioResource, StreamType } from '@discordjs/voice';
import { AudioMixer } from 'node-audio-mixer';
import Prism from 'prism-media';
import { PassThrough } from 'stream';

export default {
	data: new SlashCommandBuilder()
        // コマンドの名前
		.setName('stream')
        // コマンドの説明文
		.setDescription('VCを中継。')
		// コマンドのオプションを追加
		.addChannelOption((option) =>
			option
				.setName('channel1')
				.setDescription('The channel that Listener-bot join')
				.setRequired(true)
				.addChannelTypes(ChannelType.GuildVoice),
		)
		.addStringOption((option) =>
			option
				.setName('channel2')
				.setDescription('The channel that Speaker-bot join')
				.setAutocomplete(true)
				.setRequired(true),
		),
	async autocomplete(interaction) {
		const focusedValue = interaction.options.getFocused();
		const vc = interaction.options.get('channel1');
		const chats = interaction.guild.channels.cache;
		const voiceChannels = chats.filter(file => file.type === 2);
		let unSelectedVoiceChannels = [];

		for (const voiceChannel of voiceChannels) {
			if (voiceChannel[0] !== vc.value) {
				unSelectedVoiceChannels.push(voiceChannel);
			}
		}
		
		const filtered = unSelectedVoiceChannels.filter(unSelectedVoiceChannel => unSelectedVoiceChannel[1].name.startsWith(focusedValue));

		await interaction.respond(
			filtered.map(unSelectedVoiceChannel => ({ name: unSelectedVoiceChannel[1].name, value: unSelectedVoiceChannel[1].id })).slice(0, 25)
		);
	},
	async execute(interaction, client1, client2) {
		const voiceChannel1 = interaction.options.getChannel('channel1');
		const voiceChannel2 = interaction.options.getString('channel2');
		if (voiceChannel1 && voiceChannel2) {
			if (voiceChannel1 === voiceChannel2) {
				await interaction.reply('同じVCには参加できません🥺');
				return;
			}
			// Listener-botがVCに参加する処理
			const connection1 = joinVoiceChannel({
				// なぜかはわからないが、groupの指定をしないと、先にVCに入っているBOTがVCを移動するだけになってしまうので、記述。
				group: 'listener',
				guildId: interaction.guildId,
				channelId: voiceChannel1.id,
				// どっちのBOTを動かしてあげるかの指定をしてあげる。
				adapterCreator: client1.guilds.cache.get(interaction.guildId).voiceAdapterCreator,
				// VC参加時にマイクミュート、スピーカーミュートにするか否か
				selfMute: true,
				selfDeaf: false,
			});
			// Speaker-botがVCに参加する処理
			const connection2 = joinVoiceChannel({
				group: 'speaker',
				guildId: interaction.guildId,
				channelId: voiceChannel2,
				adapterCreator: client2.guilds.cache.get(interaction.guildId).voiceAdapterCreator,
				selfMute: false,
				selfDeaf: true,
			});
		//TODO:bye.jsでこのAudioMixer消さないとだめじゃない？
		//index.js内で宣言し、ここでconst mixer = global.mixerとでもする？
		//あるいはここでglobal.mixerをclose→newしておくか。
			if (global.mixer != null) global.mixer.close();
			global.mixer = new AudioMixer({
				sampleRate: 48000,
				bitDepth: 16,
				channels: 2,
				generateSilent: true,
				autoClose: false,
			});
		
			// Listener-botが参加しているVCで誰かが話し出したら実行
			connection1.receiver.speaking.on('start', (userId) => {
				const standaloneInput = global.mixer.createAudioInput({
					sampleRate: 48000,
					bitDepth: 16,
					channels: 2,
					forceClose: true,
				});
				// VCの音声取得機能
				const audio = connection1.receiver.subscribe(userId, {
					end: {
						behavior: EndBehaviorType.AfterSilence,
						// Opusの場合、100msだと短過ぎるのか、エラー落ちするため1000msに設定
						// Rawに変換する場合、1000msだと長過ぎるのか、エラー落ちするため100msに設定
						duration: 400,
					},
				});
				const rawStream = new PassThrough();
				audio
					.pipe(new Prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 }))
					.pipe(rawStream);
				const p = rawStream.pipe(standaloneInput);
				rawStream.on('end', () => {
					if (global.mixer != null) {
						global.mixer.removeAudioInput(standaloneInput);
						standaloneInput.close(); //automatically removed from audioMixer.
						rawStream.destroy();
						p.destroy();
					}
				});
			});
			
			// 音声をVCに流す機能
			const player = createAudioPlayer({
				behaviors: {
					// 聞いている人がいなくても音声を中継してくれるように設定
					noSubscriber: NoSubscriberBehavior.play,
				},
			});
			const resource = createAudioResource(global.mixer,
				{
					inputType: StreamType.Raw,
				},
			);
			player.play(resource);
			connection2.subscribe(player);
			connection2.on(VoiceConnectionStatus.Destroyed, (oldState, newState) => {
				global.mixer.close();
			});

			await interaction.reply('VCを中継します！');
			return [connection1, connection2];
		}
		// autocomplete不使用時はコメントアウトを解除
		// else {
		// 	await interaction.reply('BOTを参加させるVCを指定してください！');
		// }
	},
};