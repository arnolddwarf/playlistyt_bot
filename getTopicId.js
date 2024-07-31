const { Telegraf } = require('telegraf');

const bot = new Telegraf('7311328243:AAHDEcTifQdX_Aml4L_t4X6Fr86Y9I9qA4M');

// Comando para obtener el ID del topic actual
bot.command('gettopicid', (ctx) => {
  if (ctx.message.message_thread_id) {
    ctx.reply(`Topic ID: ${ctx.message.message_thread_id}`);
  } else {
    ctx.reply('Este mensaje no está en un topic.');
  }
});

// Comando para enviar un mensaje a un topic específico y obtener su ID
bot.command('sendtotopic', async (ctx) => {
  const topicName = ctx.message.text.split(' ')[1];
  if (!topicName) {
    return ctx.reply('Por favor proporciona el nombre del topic.');
  }
  
  // Mapea los nombres de los topics a los IDs correspondientes
  const topicIds = {
    topic1: 8,
    topic2: 987654321,
    topic3: 543216789,
    // Agrega más topics según sea necesario
  };

  const topicId = topicIds[topicName];
  if (!topicId) {
    return ctx.reply('Topic no encontrado.');
  }

  try {
    const sentMessage = await ctx.telegram.sendMessage(ctx.chat.id, `Mensaje de prueba para obtener ID del topic ${topicName}`, {
      message_thread_id: topicId
    });
    ctx.reply(`Mensaje enviado al topic "${topicName}" con ID: ${topicId}`);
  } catch (error) {
    console.error('Error enviando mensaje al topic:', error);
    ctx.reply('Hubo un error al enviar el mensaje al topic.');
  }
});

bot.launch().then(() => {
  console.log('Bot está funcionando...');
});
