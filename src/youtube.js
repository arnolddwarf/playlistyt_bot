// src/youtube.js
import fetch from 'node-fetch';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Markup } from 'telegraf';
import { YOUTUBE_API_KEY, CHAT_ID, PLAYLISTS } from './config.js';
import { getCollection } from './db.js';
import { bot } from './bot.js';

if (!YOUTUBE_API_KEY) {
  throw new Error('YOUTUBE_API_KEY no está definido en las variables de entorno');
}

// Lógica para una sola playlist
async function fetchLatestVideo(playlistId, topicId) {
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=1&key=${YOUTUBE_API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  if (!data.items || data.items.length === 0) return;

  const latestVideo = data.items[0];
  const videoId = latestVideo.snippet.resourceId.videoId;
  const videoTitle = latestVideo.snippet.title;
  const thumbs = latestVideo.snippet.thumbnails || {};
  const videoThumbnail =
    thumbs.maxres?.url ||
    thumbs.standard?.url ||
    thumbs.high?.url ||
    thumbs.default?.url;

  const videoOwnerChannelTitle = latestVideo.snippet.videoOwnerChannelTitle;
  const videoOwnerChannelId = latestVideo.snippet.videoOwnerChannelId;
  const videoPublishedAt = latestVideo.contentDetails.videoPublishedAt;
  const formattedDate = formatDistanceToNow(parseISO(videoPublishedAt), { addSuffix: true });

  const collection = await getCollection();

  const existing = await collection.findOne({ id: videoId });
  if (existing) return;

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const channelUrl = `https://www.youtube.com/channel/${videoOwnerChannelId}`;

  const message = `
💽 Artist: ${videoTitle}
👤 Channel: ${videoOwnerChannelTitle}
📅 Date: ${formattedDate}
  `;

  // Guardar en Mongo
  const insertResult = await collection.insertOne({
    id: videoId,
    title: videoTitle,
    description: latestVideo.snippet.description,
    channelTitle: videoOwnerChannelTitle,
    channelId: videoOwnerChannelId,
    publishedAt: videoPublishedAt,
    url: videoUrl,
    reactions: { like: 0, love: 0, angry: 0 },
    userReactions: {}
  });

  const replyMarkup = Markup.inlineKeyboard([
    [
      Markup.button.callback('👍', `like_${videoId}`),
      Markup.button.callback('❤️', `love_${videoId}`),
      Markup.button.callback('😡', `angry_${videoId}`)
    ],
    [
      Markup.button.url('Ver vídeo', videoUrl),
      Markup.button.url('Ver canal', channelUrl)
    ],
    [Markup.button.callback('ℹ️ Más info', `info_${videoId}`)]
  ]);

  const sentMessage = await bot.telegram.sendPhoto(CHAT_ID, videoThumbnail, {
    caption: message,
    reply_markup: replyMarkup.reply_markup,
    message_thread_id: topicId
  });

  await collection.updateOne(
    { _id: insertResult.insertedId },
    { $set: { messageId: sentMessage.message_id } }
  );

  console.log('Message sent for playlist', playlistId, 'video', videoId);
}

// Función que usará /api/check-playlists
export async function fetchLatestVideoForAllPlaylists() {
  const tasks = [];

  for (const [playlistId, topicId] of Object.entries(PLAYLISTS)) {
    tasks.push(fetchLatestVideo(playlistId, topicId));
  }

  await Promise.all(tasks);
}
