//const Discord = require('discord.js');
//const { SlashCommandBuilder, ChannelType } = require('discord.js');
//const { joinVoiceChannel, createAudioPlayer, NoSubscriberBehavior, EndBehaviorType, createAudioResource, StreamType } = require('@discordjs/voice');
//const AudioMixer = require('node-audio-mixer');
//const Prism = require('prism-media');
//const { PassThrough } = require('stream');

import { Client, SlashCommandBuilder, ChannelType } from 'discord.js';
import { VoiceConnectionStatus, joinVoiceChannel, createAudioPlayer, NoSubscriberBehavior, EndBehaviorType, createAudioResource, StreamType } from '@discordjs/voice';
import { AudioMixer } from 'node-audio-mixer';
import Prism from 'prism-media';
import { PassThrough } from 'stream';

// const Client = new Client();

export default {
	data: new SlashCommandBuilder()
        // コマンドの名前
		.setName('streamnew')
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
		const memberList = new Map();
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

			const mixer = new AudioMixer({
				sampleRate: 48000,
				bitDepth: 16,
				channels: 2,
				generateSilent: true,
				autoClose: false,
			});
			// 音声をVCに流す機能
			const player = createAudioPlayer({
				behaviors: {
					// 聞いている人がいなくても音声を中継してくれるように設定
					noSubscriber: NoSubscriberBehavior.play,
				},
			});
			const resource = createAudioResource(mixer,
				{
					inputType: StreamType.Raw,
                    //silencePaddingFrames: -1,
				},
			);
			player.play(resource);
			connection2.subscribe(player);

			connection2.on(VoiceConnectionStatus.Destroyed, () => {
				memberList.forEach((voice) => {
					if (voice !== undefined && voice !== null) voice.destroy();
				})
				mixer.close();
			});

			//TODO:client1がVCに入った時、すでに入っていたmemberの分のAudioInputを作成する
			//voiceChannel1.members.filter(user => !user.bot).each(user => {
			voiceChannel1.members.each(user => {
				if (user.id === client1.user.id) return;
				memberList.set(user.id, createUserAudioStream(connection1, mixer, user.id));
			});

			//TODO:ここclient1でいいの？
            client1.on("voiceStateUpdate", (oldState, newState) => {
				if (oldState.channelId === voiceChannel1.id && newState.channelId === null) {
					//disconnect from VC Event
					console.log('disconnect user: '+oldState.member.user.id);
					if (oldState.member.user.id === client1.user.id) return;
					const voice = memberList.get(oldState.member.user.id);
					if (voice !== undefined && voice !== null) voice.destroy();
					memberList.delete(oldState.member.user.id);
				} else if (oldState.channelId === null && newState.channelId === voiceChannel1.id) {
					//connect to VC Event
					console.log('connect user: '+newState.member.user.id);
					if (newState.member.user.id === client1.user.id) return;
					memberList.set(newState.member.user.id, createUserAudioStream(connection1, mixer, newState.member.user.id));
				}
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

function createUserAudioStream(connection, mixer, userid) {
	const userInput = mixer.createAudioInput({
		sampleRate: 48000,
		bitDepth: 16,
		channels: 2,
		forceClose: true,
	});

	const voice = connection.receiver.subscribe(userid, {
		end: { behavior: EndBehaviorType.Manual, },
	});
	const rawStream = new PassThrough();
	voice
		.pipe(new Prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 }))
		.pipe(rawStream);
	const p = rawStream.pipe(userInput);
	rawStream.on('end', () => {
		if (mixer != null) {
			mixer.removeAudioInput(userInput);
			userInput.close(); //automatically removed from audioMixer.
			rawStream.destroy();
			p.destroy();
		}
	});
	console.log('create user AudioStream: '+userid);
	return voice;
}