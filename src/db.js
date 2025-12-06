// src/db.js
import { MongoClient } from 'mongodb';
import { MONGO_URI, DB_NAME, COLLECTION_NAME } from './config.js';

if (!MONGO_URI) {
  throw new Error('MONGO_URI no está definido en las variables de entorno');
}

let client;
let clientPromise;

export function getMongoClient() {
  if (!clientPromise) {
    client = new MongoClient(MONGO_URI);
    clientPromise = client.connect();
  }
  return clientPromise;
}

export async function getCollection() {
  const cli = await getMongoClient();
  const db = cli.db(DB_NAME);
  return db.collection(COLLECTION_NAME);
}
