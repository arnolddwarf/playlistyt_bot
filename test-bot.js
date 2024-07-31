import { Telegraf, Markup } from 'telegraf';

const TELEGRAM_TOKEN = '7311328243:AAHDEcTifQdX_Aml4L_t4X6Fr86Y9I9qA4M';
const CHAT_ID = '168278914';

const bot = new Telegraf(TELEGRAM_TOKEN);

bot.launch().then(() => {
  console.log('Bot está funcionando...');
});

// Enviar mensaje con botones
const sendTestMessage = async () => {
  try {
    const message = 'Prueba los botones a continuación:';
    const replyMarkup = Markup.inlineKeyboard([
      [Markup.button.callback('Botón 1', 'callback_1')],
      [Markup.button.callback('Botón 2', 'callback_2')]
    ]);

    const sentMessage = await bot.telegram.sendMessage(CHAT_ID, message, {
      reply_markup: replyMarkup.reply_markup
    });

    console.log('Message sent:', sentMessage);
  } catch (error) {
    console.error('Error sending message:', error);
  }
};

// Llamar a la función para enviar el mensaje
sendTestMessage();

// Manejar acciones de botones
bot.action('callback_1', (ctx) => ctx.reply('Has presionado el Botón 1.'));
bot.action('callback_2', (ctx) => ctx.reply('Has presionado el Botón 2.'));
