// src/bot.js
import { Telegraf, Markup } from 'telegraf';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { TELEGRAM_TOKEN, CHAT_ID } from './config.js';
import { getCollection } from './db.js';

if (!TELEGRAM_TOKEN) {
  throw new Error('TELEGRAM_TOKEN no está definido en las variables de entorno');
}

export const bot = new Telegraf(TELEGRAM_TOKEN);

// /start
bot.start(async (ctx) => {
  await ctx.reply('¡Bienvenido! Te notificaré cuando haya nuevos videos en la playlist.');
});

// Acción: info_<videoId>
bot.action(/info_(.+)/, async (ctx) => {
  const videoId = ctx.match[1];
  const collection = await getCollection();

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

// Helper interno para manejar reacciones
async function handleReaction(ctx, reactionType) {
  const videoId = ctx.match[1];
  const userId = ctx.from.id;
  const collection = await getCollection();

  const video = await collection.findOne({ id: videoId });
  if (!video) {
    await ctx.answerCbQuery('Video no encontrado');
    return;
  }

  const currentReaction = video.userReactions?.[userId];
  const updateQuery = {
    $inc: { [`reactions.${reactionType}`]: 1 },
    $set: { [`userReactions.${userId}`]: reactionType }
  };

  if (currentReaction === reactionType) {
    // Quitar reacción
    updateQuery.$inc[`reactions.${reactionType}`] = -1;
    updateQuery.$unset = { [`userReactions.${userId}`]: '' };
  } else if (currentReaction) {
    // Cambiar reacción
    updateQuery.$inc[`reactions.${currentReaction}`] = -1;
  }

  await collection.updateOne({ id: videoId }, updateQuery);
  const updatedVideo = await collection.findOne({ id: videoId });

  const buildButton = (reaction, emoji) => {
    const count = updatedVideo.reactions?.[reaction] || 0;
    return count > 0 ? `${emoji} (${count})` : emoji;
  };

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

  await bot.telegram.editMessageReplyMarkup(
    CHAT_ID,
    updatedVideo.messageId,
    undefined,
    replyMarkup.reply_markup
  );

  await ctx.answerCbQuery();
}

// Acciones de reacciones
bot.action(/like_(.+)/, (ctx) => handleReaction(ctx, 'like'));
bot.action(/love_(.+)/, (ctx) => handleReaction(ctx, 'love'));
bot.action(/angry_(.+)/, (ctx) => handleReaction(ctx, 'angry'));
