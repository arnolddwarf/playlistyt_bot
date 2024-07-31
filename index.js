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


const fetchLatestVideo = async () => {
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${PLAYLIST_ID}&maxResults=1&key=${YOUTUBE_API_KEY}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.items.length > 0) {
      const latestVideo = data.items[0];
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
        
        // Enviar el mensaje con la miniatura y botones interactivos
        await bot.telegram.sendPhoto(CHAT_ID, videoThumbnail, {
          caption: message,
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('👍 Me gusta', `like_${videoId}`)],
            [Markup.button.url('🔗 Compartir', videoUrl)]
          ])
        });
      }
    }
  } catch (error) {
    console.error('Error fetching latest video:', error);
  }
};

// Verifica cada 10 segundos si hay un nuevo video en la playlist
cron.schedule('* * * * *', fetchLatestVideo);

bot.start((ctx) => ctx.reply('¡Bienvenido! Te notificaré cuando haya nuevos videos en la playlist.'));

// Maneja los botones de "Me gusta"
bot.action(/like_(.*)/, async (ctx) => {
  const videoId = ctx.match[1];
  // Aquí puedes manejar la lógica para "Me gusta", como guardar la interacción en una base de datos
  await ctx.answerCbQuery('¡Gracias por tu "Me gusta"!');
});

bot.launch();



