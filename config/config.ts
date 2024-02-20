import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

// Ensure the required environment variables are defined
const validateEnvVar = (envVar: string | undefined, varName: string) => {
  if (!envVar) {
    throw new Error(`Missing environment variable: ${varName}`);
  }
  return envVar;
};

export const CLIENT_ID = validateEnvVar(process.env.CLIENT_ID, "CLIENT_ID");
export const GUILD_ID = validateEnvVar(process.env.GUILD_ID, "GUILD_ID");
export const TOKEN = validateEnvVar(process.env.BOT_TOKEN, "BOT_TOKEN");
export const BOT_CHANNEL_ID = validateEnvVar(
  process.env.BOT_CHANNEL_ID,
  "BOT_CHANNEL_ID"
);
export const LEADERBOARD_CHANNEL_ID = validateEnvVar(
  process.env.LEADERBOARD_CHANNEL_ID,
  "LEADERBOARD_CHANNEL_ID"
);

export const MONGO_USER = validateEnvVar(process.env.MONGO_USER, "MONGO_USER");
export const MONGO_SECRET = validateEnvVar(
  process.env.MONGO_SECRET,
  "MONGO_SECRET"
);

export const MONGO_URL = validateEnvVar(process.env.MONGO_URL, "MONGO_URL");
export const MESSAGE_ID = validateEnvVar(process.env.MESSAGE_ID, "MESSAGE_ID");
