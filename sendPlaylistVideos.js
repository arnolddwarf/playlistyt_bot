import { Telegraf, Markup } from 'telegraf';
import fetch from 'node-fetch';
import { MongoClient } from 'mongodb';
import { formatDistanceToNow, parseISO } from 'date-fns';

const TELEGRAM_TOKEN = '7311328243:AAHDEcTifQdX_Aml4L_t4X6Fr86Y9I9qA4M';
const YOUTUBE_API_KEY = 'AIzaSyC7alwcg7E29V2C4CgKuPSTlvSDiW_vjq4';
const PLAYLIST_ID = 'PLTKJJiHaMZjexSsYWCb4y4eYJPaNgHCIC';
const CHAT_ID = '-1002170231873';
const TOPIC_ID = '4'; // ID del topic específico
const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME = 'youtubeBotDB';
const COLLECTION_NAME = 'notifiedVideos';

const bot = new Telegraf(TELEGRAM_TOKEN);

const client = new MongoClient(MONGO_URI);

const fetchPlaylistVideos = async () => {
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${PLAYLIST_ID}&maxResults=50&key=${YOUTUBE_API_KEY}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.items && data.items.length > 0) {
      await client.connect();
      const db = client.db(DB_NAME);
      const collection = db.collection(COLLECTION_NAME);

      for (const item of data.items) {
        const videoId = item.snippet?.resourceId?.videoId;
        const videoTitle = item.snippet?.title;
        const videoThumbnail = item.snippet?.thumbnails?.maxres?.url
          || item.snippet?.thumbnails?.standard?.url
          || item.snippet?.thumbnails?.high?.url
          || item.snippet?.thumbnails?.default?.url;
        const videoOwnerChannelTitle = item.snippet?.videoOwnerChannelTitle;
        const videoPublishedAt = item.contentDetails?.videoPublishedAt;
        const formattedDate = videoPublishedAt ? formatDistanceToNow(parseISO(videoPublishedAt), { addSuffix: true }) : null;

        if (!videoId || !videoTitle || !videoThumbnail || !videoOwnerChannelTitle || !videoPublishedAt) {
          console.log(`Skipping video due to missing information:`, { videoId, videoTitle, videoThumbnail, videoOwnerChannelTitle, videoPublishedAt });
          continue; // Skip this video if any required information is missing
        }

        const videoExists = await collection.findOne({ id: videoId });

        if (!videoExists) {
          const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
          const message = `
💽 Artist: ${videoTitle}
👤 Channel: ${videoOwnerChannelTitle}
📅 Date: ${formattedDate}
🔗 [Watch Video](${videoUrl})
          `;

          // Guardar video notificado en la base de datos
          await collection.insertOne({
            id: videoId,
            title: videoTitle,
            description: item.snippet.description,
            channelTitle: videoOwnerChannelTitle,
            publishedAt: videoPublishedAt,
            url: videoUrl,
            reactions: { like: 0, love: 0, angry: 0 },
            userReactions: {}
          });

          // Enviar el mensaje con la miniatura y botones interactivos
          const replyMarkup = Markup.inlineKeyboard([
            [Markup.button.url('Ver vídeo', videoUrl)],
            [Markup.button.callback('ℹ️ Más info', `info_${videoId}`)]
          ]);

          await bot.telegram.sendPhoto(CHAT_ID, videoThumbnail, {
            caption: message,
            parse_mode: 'Markdown',
            reply_markup: replyMarkup.reply_markup,
            message_thread_id: TOPIC_ID
          });

          console.log('Message sent:', message);
        }
      }
    }
  } catch (error) {
    console.error('Error fetching playlist videos:', error);
  } finally {
    await client.close();
  }
};

// Llama a la función para enviar videos de la playlist
fetchPlaylistVideos();

bot.launch().then(() => {
  console.log('Bot está funcionando...');
});


