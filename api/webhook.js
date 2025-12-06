// api/webhook.js
import { bot } from '../src/bot.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const update = req.body;
    await bot.handleUpdate(update);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Error in webhook handler:', err);
    return res.status(500).json({ ok: false });
  }
}
