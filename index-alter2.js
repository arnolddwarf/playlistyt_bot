import { Telegraf, Markup } from 'telegraf';
import fetch from 'node-fetch';
import cron from 'node-cron';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { MongoClient } from 'mongodb';

const TELEGRAM_TOKEN = '7311328243:AAHDEcTifQdX_Aml4L_t4X6Fr86Y9I9qA4M';
const YOUTUBE_API_KEY = 'AIzaSyC7alwcg7E29V2C4CgKuPSTlvSDiW_vjq4';
const PLAYLIST_ID = 'PLTKJJiHaMZjeEDrhGz2ae07ArkWm8GbN4';
const CHAT_ID = '168278914'; // ID del chat donde quieres enviar los mensajes
const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME = 'youtubeBotDB';
const COLLECTION_NAME = 'notifiedVideos';

const bot = new Telegraf(TELEGRAM_TOKEN);
let lastVideoId = null;
let latestVideo = null; // Guardar el último video

const client = new MongoClient(MONGO_URI);

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

      await client.connect();
      const db = client.db(DB_NAME);
      const collection = db.collection(COLLECTION_NAME);

      const videoExists = await collection.findOne({ id: videoId });

      if (!videoExists) {
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const channelUrl = `https://www.youtube.com/channel/${latestVideo.snippet.videoOwnerChannelId}`;
        const message = `
💽 Artist: ${videoTitle}
👤 Channel: ${videoOwnerChannelTitle}
📅 Date: ${formattedDate}
        `;

        // Guardar video notificado en la base de datos
        await collection.insertOne({
          id: videoId,
          title: videoTitle,
          description: latestVideo.snippet.description,
          channelTitle: videoOwnerChannelTitle,
          publishedAt: videoPublishedAt,
          url: videoUrl,
          reactions: { like: 0, love: 0, angry: 0 }, // Inicializar contadores de reacciones
          userReactions: {} // Inicializar reacciones de los usuarios
        });

        // Enviar el mensaje con la miniatura y botones interactivos
        const replyMarkup = Markup.inlineKeyboard([
          [
            Markup.button.callback(`👍`, `like_${videoId}`),
            Markup.button.callback(`❤️`, `love_${videoId}`),
            Markup.button.callback(`😡`, `angry_${videoId}`)
          ],
          [
            Markup.button.url('Ver vídeo', videoUrl),
            Markup.button.url('Ver canal', channelUrl)
          ],
          [Markup.button.callback('ℹ️ Más info', `info_${videoId}`)]
        ]);

        const sentMessage = await bot.telegram.sendPhoto(CHAT_ID, videoThumbnail, {
          caption: message,
          reply_markup: replyMarkup.reply_markup
        });

        // Guardar el ID del mensaje enviado en la base de datos para futuras actualizaciones
        await collection.updateOne({ id: videoId }, { $set: { messageId: sentMessage.message_id } });

        console.log('Message sent:', message); // Agregar logging para verificar el mensaje
      }
    }
  } catch (error) {
    console.error('Error fetching latest video:', error);
  } finally {
    await client.close();
  }
};

// Verifica cada minuto si hay un nuevo video en la playlist
cron.schedule('* * * * *', fetchLatestVideo);

bot.start((ctx) => ctx.reply('¡Bienvenido! Te notificaré cuando haya nuevos videos en la playlist.'));

// Manejar el comando /info
bot.action(/info_(.+)/, async (ctx) => {
  const videoId = ctx.match[1];
  await client.connect();
  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION_NAME);

  const video = await collection.findOne({ id: videoId });

  if (video) {
    const formattedDate = formatDistanceToNow(parseISO(video.publishedAt), { addSuffix: true });
    const message = `
💽 Artist: ${video.title}
👤 Channel: ${video.channelTitle}
📅 Date: ${formattedDate}
🔗 Link: ${video.url}

📝 Descripción:
${video.description}
    `;
    await ctx.reply(message);
  } else {
    await ctx.reply('No hay información disponible para este video.');
  }
  await client.close();
});

// Manejar acciones de los botones de reacciones
const handleReaction = async (ctx, reactionType) => {
  const videoId = ctx.match[1];
  const userId = ctx.from.id;
  await client.connect();
  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION_NAME);

  const video = await collection.findOne({ id: videoId });

  // Comprobar si el usuario ya ha reaccionado de esta manera
  const currentReaction = video.userReactions[userId];
  let updateQuery;

  if (currentReaction === reactionType) {
    // Si ya ha reaccionado de esta manera, quitar la reacción
    updateQuery = {
      $inc: { [`reactions.${reactionType}`]: -1 },
      $unset: { [`userReactions.${userId}`]: "" }
    };
  } else {
    // Si es una reacción nueva o diferente, actualizar la reacción
    updateQuery = {
      $inc: { [`reactions.${reactionType}`]: 1 },
      $set: { [`userReactions.${userId}`]: reactionType }
    };

    if (currentReaction) {
      // Disminuir la reacción anterior del usuario
      updateQuery.$inc[`reactions.${currentReaction}`] = -1;
    }
  }

  // Actualizar la cuenta de reacciones en la base de datos
  await collection.updateOne({ id: videoId }, updateQuery);

  const updatedVideo = await collection.findOne({ id: videoId });

  // Construir los botones de reacción con o sin contadores
  const buildButton = (reaction, emoji) => {
    const count = updatedVideo.reactions[reaction];
    return count > 0 ? `${emoji} (${count})` : emoji;
  };

  // Actualizar el mensaje con los nuevos contadores de reacciones
  const replyMarkup = Markup.inlineKeyboard([
    [
      Markup.button.callback(buildButton('like', '👍'), `like_${videoId}`),
      Markup.button.callback(buildButton('love', '❤️'), `love_${videoId}`),
      Markup.button.callback(buildButton('angry', '😡'), `angry_${videoId}`)
    ],
    [
      Markup.button.url('Ver vídeo', updatedVideo.url),
      Markup.button.url('Ver canal', `https://www.youtube.com/channel/${updatedVideo.channelTitle}`)
    ],
    [Markup.button.callback('ℹ️ Más info', `info_${videoId}`)]
  ]);

  await bot.telegram.editMessageReplyMarkup(CHAT_ID, updatedVideo.messageId, null, replyMarkup.reply_markup);

  await ctx.answerCbQuery();
  await client.close();
};

bot.action(/like_(.+)/, async (ctx) => {
  await handleReaction(ctx, 'like');
});

bot.action(/love_(.+)/, async (ctx) => {
  await handleReaction(ctx, 'love');
});

bot.action(/angry_(.+)/, async (ctx) => {
  await handleReaction(ctx, 'angry');
});

bot.launch().then(() => {
  console.log('Bot está funcionando...');
});
