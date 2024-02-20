import { MongoClient } from "mongodb";
import { MONGO_SECRET, MONGO_URL, MONGO_USER } from "../config/config";
import { LeaderBoard } from "../types";

const mongoUri = `mongodb+srv://${MONGO_USER}:${MONGO_SECRET}${MONGO_URL}`;
const db = "trading-game";
const collectionName = "kwenta";

export async function getLeaderBoard(): Promise<LeaderBoard[] | undefined> {
  console.log("RETRIEVING LEADERBOARD");
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const collection = client.db(db).collection(collectionName);
    const leaderboard = (await collection
      .find()
      .sort({ points: -1 })
      .toArray()) as any as LeaderBoard[];
    return leaderboard;
  } catch (error) {
    console.error("getTradeError: ", error);
  } finally {
    await client.close();
  }
}

export async function getTrader(userId: string) {
  console.log("RETRIEVING Trader", userId);
  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    const collection = client.db(db).collection(collectionName);

    // Check if user already exists
    const docs = (await collection
      .find({ userId: userId })
      .limit(1)
      .toArray()) as any as LeaderBoard[];

    if (docs?.length) {
      return docs[0];
    } else {
      return {
        userId: userId,
        points: 0,
      };
    }
  } catch (error) {
    console.error("Error: ", error);
  } finally {
    await client.close();
  }
}

export async function insertTrader(data: LeaderBoard) {
  console.log("INSERTING Trader", data);

  const client = new MongoClient(mongoUri);
  try {
    await client.connect();
    const collection = client.db(db).collection(collectionName);

    // Check if user already exists
    const docs = await collection
      .find({ userId: data.userId })
      .limit(1)
      .toArray();

    if (!docs?.length) {
      await collection.insertOne({
        ...data,
      });
      console.log(
        `Successfully inserted ${data.userId} user with ${data.points} points.`
      );
      return data;
    } else {
      await collection.updateOne(
        { _id: docs[0]?._id },
        { $set: { points: data.points } }
      );
      console.log(
        `Successfully updated ${data.userId} user with ${data.points} points.`
      );
      return { ...docs[0], ...data };
    }
  } catch (error) {
    console.error("Error: ", error);
  } finally {
    await client.close();
  }
}
