const { Telegraf } = require('telegraf');

const TELEGRAM_TOKEN = '7311328243:AAHDEcTifQdX_Aml4L_t4X6Fr86Y9I9qA4M';

const bot = new Telegraf(TELEGRAM_TOKEN);

bot.start((ctx) => {
  console.log(`Chat ID: ${ctx.chat.id}`);
  ctx.reply(`Tu Chat ID es: ${ctx.chat.id}`);
});

bot.on('text', (ctx) => {
  console.log(`Chat ID: ${ctx.chat.id}`);
  ctx.reply(`Tu Chat ID es: ${ctx.chat.id}`);
});

bot.launch();
