import { Telegraf, Markup } from 'telegraf';
import fetch from 'node-fetch';
import cron from 'node-cron';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { MongoClient } from 'mongodb';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const CHAT_ID = process.env.CHAT_ID;
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'youtubeBotDB';
const COLLECTION_NAME = 'notifiedVideos';

// Mapeo de playlist IDs a topic IDs
const playlists = {
  'PLTKJJiHaMZjeEDrhGz2ae07ArkWm8GbN4': 8, // Playlist 1 -> Topic ID 8
  'PLTKJJiHaMZjfOGUN4u96fTmhkPPDM5dQ6': 6, // Playlist 2 -> Topic ID 9
  'PLTKJJiHaMZjexSsYWCb4y4eYJPaNgHCIC': 4, // Playlist 3 -> Topic ID 10
  // Añade más playlists según sea necesario
};

const bot = new Telegraf(TELEGRAM_TOKEN);

const client = new MongoClient(MONGO_URI);

const fetchLatestVideo = async (playlistId, topicId) => {
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${playlistId}&maxResults=1&key=${YOUTUBE_API_KEY}`;
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
          reply_markup: replyMarkup.reply_markup,
          message_thread_id: topicId
        });

        // Guardar el ID del mensaje enviado en la base de datos para futuras actualizaciones
        await collection.updateOne({ id: videoId }, { $set: { messageId: sentMessage.message_id } });

        console.log('Message sent:', message); // Agregar logging para verificar el mensaje
      }
    }
  } catch (error) {
    console.error('Error fetching latest video:', error);
  }
};

// Conectar a la base de datos antes de iniciar el bot y mantener la conexión abierta
const startBot = async () => {
  try {
    await client.connect();
    console.log('Conectado a la base de datos');

    // Verifica cada minuto si hay un nuevo video en cada playlist
    cron.schedule('* * * * *', () => {
      for (const [playlistId, topicId] of Object.entries(playlists)) {
        fetchLatestVideo(playlistId, topicId);
      }
    });

    bot.start((ctx) => ctx.reply('¡Bienvenido! Te notificaré cuando haya nuevos videos en la playlist.'));

    // Manejar el comando /info
    bot.action(/info_(.+)/, async (ctx) => {
      const videoId = ctx.match[1];
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
    });

    // Manejar acciones de los botones de reacciones
    const handleReaction = async (ctx, reactionType) => {
      const videoId = ctx.match[1];
      const userId = ctx.from.id;
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

      await ctx.answerCbQuery(); // Confirmar la interacción del botón
    };

    bot.action(/like_(.+)/, (ctx) => handleReaction(ctx, 'like'));
    bot.action(/love_(.+)/, (ctx) => handleReaction(ctx, 'love'));
    bot.action(/angry_(.+)/, (ctx) => handleReaction(ctx, 'angry'));

    bot.launch().then(() => {
      console.log('Bot está funcionando...');
    });
  } catch (error) {
    console.error('Error conectando a la base de datos:', error);
  }
};

startBot();
