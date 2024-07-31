import { Telegraf, Markup } from 'telegraf';
import fetch from 'node-fetch';
import cron from 'node-cron';
import { formatDistanceToNow, parseISO } from 'date-fns';

const TELEGRAM_TOKEN = '7311328243:AAHDEcTifQdX_Aml4L_t4X6Fr86Y9I9qA4M';
const YOUTUBE_API_KEY = 'AIzaSyC7alwcg7E29V2C4CgKuPSTlvSDiW_vjq4';
const PLAYLIST_ID = 'PLTKJJiHaMZjeEDrhGz2ae07ArkWm8GbN4';
const CHAT_ID = '168278914'; // ID del chat donde quieres enviar los mensajes

const bot = new Telegraf(TELEGRAM_TOKEN);

let lastVideoId = null;
let latestVideo = null; // Guardar el último video

const fetchLatestVideo = async () => {
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${PLAYLIST_ID}&maxResults=1&key=${YOUTUBE_API_KEY}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.items.length > 0) {
      latestVideo = data.items[0]; // Guardar el video actual
      const videoId = latestVideo.snippet.resourceId.videoId;
      const videoTitle = latestVideo.snippet.title;
      const videoThumbnail = latestVideo.snippet.thumbnails.maxres 
        ? latestVideo.snippet.thumbnails.maxres.url 
        : latestVideo.snippet.thumbnails.standard 
        ? latestVideo.snippet.thumbnails.standard.url 
        : latestVideo.snippet.thumbnails.high 
        ? latestVideo.snippet.thumbnails.high.url 
        : latestVideo.snippet.thumbnails.default.url;
      const videoOwnerChannelTitle = latestVideo.snippet.videoOwnerChannelTitle;
      const videoPublishedAt = latestVideo.contentDetails.videoPublishedAt;
      const formattedDate = formatDistanceToNow(parseISO(videoPublishedAt), { addSuffix: true });
      
      if (videoId !== lastVideoId) {
        lastVideoId = videoId;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const message = `
💽 Artist: ${videoTitle}
👤 Channel: ${videoOwnerChannelTitle}
📅 Date: ${formattedDate}
🔗 Link: ${videoUrl}
        `;
        
        const replyMarkup = Markup.inlineKeyboard([
          [Markup.button.callback('ℹ️ Más info', `info_${videoId}`)]
        ]);

        const sentMessage = await bot.telegram.sendPhoto(CHAT_ID, videoThumbnail, {
          caption: message,
          reply_markup: replyMarkup.reply_markup
        });
        console.log('Message sent:', sentMessage); // Agregar logging para verificar el mensaje
      }
    }
  } catch (error) {
    console.error('Error fetching latest video:', error);
  }
};

// Verifica cada minuto si hay un nuevo video en la playlist
cron.schedule('* * * * *', fetchLatestVideo);

bot.start((ctx) => ctx.reply('¡Bienvenido! Te notificaré cuando haya nuevos videos en la playlist.'));

// Manejar el comando /info
bot.action(/info_(.+)/, async (ctx) => {
  const videoId = ctx.match[1];
  if (latestVideo && latestVideo.snippet.resourceId.videoId === videoId) {
    const videoDescription = latestVideo.snippet.description;
    const message = `
💽 Artist: ${latestVideo.snippet.title}
👤 Channel: ${latestVideo.snippet.channelTitle}
📅 Date: ${formatDistanceToNow(parseISO(latestVideo.snippet.publishedAt)), { addSuffix: true }}
🔗 Link: https://www.youtube.com/watch?v=${videoId}
      
📝 Descripción:
${videoDescription}
    `;
    await ctx.reply(message);
  } else {
    await ctx.reply('No hay información disponible para este video.');
  }
});

bot.launch().then(() => {
  console.log('Bot está funcionando...');
});
