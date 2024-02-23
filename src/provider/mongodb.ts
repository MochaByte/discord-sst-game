import { MongoClient } from "mongodb";
import { MONGO_SECRET, MONGO_URL, MONGO_USER } from "../config/config";
// import { Trooper } from "../types"; 

const mongoUri = `mongodb+srv://${MONGO_USER}:${MONGO_SECRET}${MONGO_URL}`;
const db = "starshipTroopersGame"; // Updated to match the theme
const collectionName = "troopers"; // Updated to reflect Starship Troopers theme

interface Trooper {
  userId: string;
  points: number;
  // rank: number; // Optional for now, will be calculated on leaderboard retrieval
}


export async function getLeaderBoard(): Promise<Trooper[]> {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const collection = client.db(db).collection(collectionName);
  const documents = await collection.find().sort({ points: -1 }).toArray();
  const leaderboard: Trooper[] = documents.map(doc => ({
    userId: doc.userId,
    points: doc.points,
    rank: doc.rank // Assuming 'rank' is stored in the document; if not, it will be undefined
  }));
  await client.close();
  return leaderboard;
}

export async function getTrooper(userId: string): Promise<Trooper | undefined> {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const collection = client.db(db).collection(collectionName);
  const document = await collection.findOne({ userId: userId });
  if (!document) return undefined;
  const trooper: Trooper = {
    userId: document.userId,
    points: document.points,
    // rank: document.rank // Assuming 'rank' is stored in the document; if not, it will be undefined
  };
  await client.close();
  return trooper;
}

export async function upsertTrooper(data: Trooper): Promise<void> {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const collection = client.db(db).collection(collectionName);
  await collection.updateOne(
    { userId: data.userId },
    { $set: data },
    { upsert: true }
  );
  console.log(`Trooper updated: ${data.userId}`);
  await client.close();
}

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

