import { MongoClient } from "mongodb";
import { MONGO_SECRET, MONGO_URL, MONGO_USER } from "../config/config";
import { Trooper } from "../types/index"; 

const mongoUri = `mongodb+srv://${MONGO_USER}:${MONGO_SECRET}${MONGO_URL}`;
const db = "starshipTroopersGame"; // Updated to match the theme
const collectionName = "troopers"; // Updated to reflect Starship Troopers theme

// interface Trooper {
//   userId: string;
//   points: number;
//   currentTerritory: string;
// }


export async function getLeaderBoard(): Promise<Trooper[]> {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const collection = client.db(db).collection(collectionName);
  const documents = await collection.find().sort({ points: -1 }).toArray();
  await client.close();
  return documents.map(doc => ({
    userId: doc.userId,
    points: doc.points,
    currentTerritory: doc.currentTerritory, // Include currentTerritory in the mapping
  })) as Trooper[];
}

export async function getTrooper(userId: string): Promise<Trooper | undefined> {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const collection = client.db(db).collection(collectionName);
  const document = await collection.findOne({ userId: userId });
  await client.close();
  if (!document) return undefined;
  return {
    userId: document.userId,
    points: document.points,
    currentTerritory: document.currentTerritory, // Include currentTerritory
  } as Trooper;
}

export async function upsertTrooper(data: Trooper): Promise<void> {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const collection = client.db(db).collection(collectionName);
  await collection.updateOne({ userId: data.userId }, { $set: data }, { upsert: true });
  console.log(`Trooper updated: ${data.userId}`);
  await client.close();
}

// New function to update a trooper's current territory
// export async function updatePlayerTerritory(userId: string, territory: string): Promise<void> {
//   const client = new MongoClient(mongoUri);
//   await client.connect();
//   const collection = client.db(db).collection(collectionName);
//   await collection.updateOne({ userId: userId }, { $set: { currentTerritory: territory } }, { upsert: true });
//   console.log(`Trooper territory updated: ${userId} to ${territory}`);
//   await client.close();
// }

export async function updateAndFetchRanks(): Promise<Trooper[]> {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const collection = client.db(db).collection(collectionName);

  // Fetch all troopers and sort them by points in descending order
  const troopers = await collection.find().sort({ points: -1 }).toArray() as unknown as Trooper[];

  // Prepare bulk operations for rank updates
  const bulkOps = troopers.map((trooper, index) => ({
    updateOne: {
      filter: { userId: trooper.userId },
      update: { $set: { rank: index + 1 } }
    }
  }));

  // Execute bulk operations if there are any
  if (bulkOps.length > 0) {
    await collection.bulkWrite(bulkOps);
  }

  await client.close();
  return troopers; // Note: This returns troopers with their new ranks as calculated, but does not re-fetch from the database
}

export async function insertOrUpdatePlayer(trooper: Trooper): Promise<void> {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const collection = client.db(db).collection(collectionName);
  await collection.updateOne({ userId: trooper.userId }, { $set: trooper }, { upsert: true });
  await client.close();
}

