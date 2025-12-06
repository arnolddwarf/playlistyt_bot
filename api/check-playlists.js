// api/check-playlists.js
import { fetchLatestVideoForAllPlaylists } from '../src/youtube.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    await fetchLatestVideoForAllPlaylists();
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Error in check-playlists handler:', err);
    return res.status(500).json({ ok: false });
  }
}
