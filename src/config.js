// src/config.js
export const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
export const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
export const CHAT_ID = process.env.CHAT_ID;
export const MONGO_URI = process.env.MONGO_URI;

export const DB_NAME = 'youtubeBotDB';
export const COLLECTION_NAME = 'notifiedVideos';

// Mapeo de playlist IDs a topic IDs
export const PLAYLISTS = {
  'PLTKJJiHaMZjeEDrhGz2ae07ArkWm8GbN4': 8,
  'PLTKJJiHaMZjfOGUN4u96fTmhkPPDM5dQ6': 6,
  'PLTKJJiHaMZjexSsYWCb4y4eYJPaNgHCIC': 4
  // añade más si quieres
};
