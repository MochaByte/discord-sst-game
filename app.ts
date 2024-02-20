import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  time,
  bold,
  userMention,
  Partials,
  TextChannel,
} from "discord.js";
import { SetUpDiscord } from "./discord";
import {
  TOKEN,
  BOT_CHANNEL_ID,
  LEADERBOARD_CHANNEL_ID,
  MESSAGE_ID,
} from "./config/config";
import { getLeaderBoard, insertTrader, getTrader } from "./provider/mongodb";
import formatNumber from "./utils/formatNumber";

const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  partials: [Partials.User, Partials.Message],
});

const cooldowns: Map<string, number> = new Map();
const leaderboard: Map<string, number> = new Map(); // New leaderboard Map

// All Market options to choose from
const marketOptions = ["BTC", "ETH", "LINK", "ARB", "OP", "SNX", "KWENTA"];

export async function Run(): Promise<void> {
  try {
    console.log("Running Bot");

    discordClient.once("ready", () => {
      console.log(`Logged in as ${discordClient.user?.tag}`);
    });

    discordClient.on("debug", (info) => {
      console.log("Info", info);
    });

    discordClient.on("warn", (warning) => {
      console.warn(warning);
    });

    discordClient.on("error", (error) => {
      console.error("Discord client error:", error);
    });

    discordClient.on("interactionCreate", async (interaction) => {
      if (!interaction.isCommand()) {
        return;
      }

      const { commandName } = interaction;
      // Check if interaction is in the trading-game Channel
      if (interaction.channelId === BOT_CHANNEL_ID) {
        const userId = interaction.user.id;

        // Handle the /help command
        if (commandName === "help") {
          // Send the manual content as a response
          await interaction.reply(`
          **Commands**  
          - \`/short\`: Simulates a short trade.
          - \`/long\`: Simulates a long trade.
          
          **Options**
          - \`/market\`: Select the cryptocurrency market (e.g., BTC, ETH).
          - \`/leverage\`: Choose the leverage for the trade.
          `);
          return;
        }

        // Check for "/short" and "/long" commands
        if (commandName === "short" || commandName === "long") {
          await interaction.deferReply();
          // Check for cooldown

          const lastCommandTime = cooldowns.get(userId) || 0;
          const now = Date.now();
          const timeLeft = now - lastCommandTime;
          const isOnCooldown = timeLeft < 0;

          if (isOnCooldown) {
            const waitUntil = addMillisecondsToDate(new Date(now), timeLeft);
            await interaction.editReply(
              `You are on cooldown. Try again later. Wait ${time(
                waitUntil,
                "R"
              )}`
            );
            return;
          }

          // Handle market selection
          // const selectedMarket = interaction.options.get("market");
          const selectedMarket = interaction.options?.get("market")
            ?.value as string;
          const leverageOption = interaction.options?.get("leverage")
            ?.value as string;
          const boostedMarket = getRandomMarket(); // Get a random market to boost

          // Game Logic
          const [isWinner, pointsWon] = simulateTrade(
            selectedMarket,
            boostedMarket,
            leverageOption,
            commandName
          );

          // Update user cooldown if they lost
          if (!isWinner) {
            const cooldownDuration = 10 * 1000; // 10 seconds cooldown after a loss
            cooldowns.set(userId, now + cooldownDuration);
          }

          // Update leaderboard
          const user = await getTrader(userId);
          const prevPoints = (user?.points ?? 0) as number;

          const points = isWinner ? prevPoints + pointsWon : 0;

          await insertTrader({ userId, points });

          // Get the appropriate GIF URL based on win/lose
          let gifUrl =
            isWinner && boostedMarket === selectedMarket
              ? "https://media.tenor.com/-IvhQPu9IYYAAAAC/pump-it.gif" // Win GIF
              : isWinner
              ? undefined // No GIF if boostedMarket !== selectedMarket
              : commandName != "long"
              ? "https://media.tenor.com/A3_uv_vy9FkAAAAC/crypto-rugpull.gif"
              : "https://media1.tenor.com/m/4Uh9ptxlOFYAAAAd/bogdanoff-dump-it.gif"; // Lose GIF

          if (selectedMarket == "KWENTA" && commandName == "short") {
            gifUrl =
              "https://media1.tenor.com/m/W_lIAMnqeqYAAAAC/rekt-goingdown-nft-crypto-pat-patnut.gif";
          }

          if (
            selectedMarket == "ETH" &&
            commandName == "long" &&
            boostedMarket == "ETH" &&
            isWinner
          ) {
            gifUrl = `https://c.tenor.com/NshDCcCDqPEAAAAd/tenor.gi`;
          }

          if (leverageOption == "none") {
            gifUrl = `https://media1.tenor.com/m/oo2UOU5qNAYAAAAC/weak-pussy.gif`;
          }

          const embed = gifUrl
            ? new EmbedBuilder().setImage(gifUrl)
            : undefined;

          const directionText = commandName == "long" ? "Long" : "Short";

          let replyContent =
            isWinner && boostedMarket === selectedMarket
              ? `${directionText} ${bold("$" + selectedMarket)}${
                  leverageOption == "none" ? "" : " " + leverageOption
                } PUMPED!!!!! You won ${bold("+$" + formatNumber(pointsWon))}\n`
              : isWinner
              ? `Congrats! ${directionText} ${bold("$" + selectedMarket)}${
                  leverageOption == "none" ? "" : " " + leverageOption
                } won ${bold("+$" + formatNumber(pointsWon))}\n`
              : `You got ${bold("LIQUIDATED")}. Rekt. Back to McDonalds ser.\n`;

          if (selectedMarket == "KWENTA" && commandName == "short") {
            replyContent = `Short ${bold("$KWENTA")}?? ngmi.\n`;
          }
          if (leverageOption == "none") {
            replyContent = `No leverage? ser this is a casino. ngmi.\n`;
          }

          replyContent = replyContent += `Balance: ${bold(
            "$" + formatNumber(points)
          )} \n\n`;

          if (embed) {
            await interaction.editReply({
              content: replyContent,
              embeds: [embed],
            });
          } else {
            await interaction.editReply(replyContent);
          }

          // Update the leaderboard
          await updateLeaderboardMessage(discordClient);
        }
      }
    });

    await SetUpDiscord(discordClient, TOKEN);

    console.log(`Bot status: ${discordClient.user?.presence?.status}`);
  } catch (error) {
    console.error("Error during bot execution:", error);
  }
}

Run();

// Helper function to get a random market
function getRandomMarket(): string {
  const randomIndex = Math.floor(Math.random() * marketOptions.length);
  return marketOptions[randomIndex];
}

// Helper function to simulate a trade with market options
function simulateTrade(
  selectedMarket: string,
  boostedMarket: string,
  leverageOption: string,
  commandName: string
): [boolean, number] {
  // Game Logic

  if (
    (selectedMarket == "KWENTA" && commandName == "short") ||
    leverageOption == "none"
  ) {
    return [false, 0];
  }
  const isWinner = Math.random() < getWinChance(leverageOption); // Win chance based on leverage

  let pointsWon = isWinner
    ? parseFloat(calculateReward(getWinChance(leverageOption)).toFixed(2))
    : 0; // Adjusted reward based on leverage

  // Boost market based on user choice
  const boostedAmount = selectedMarket === boostedMarket ? 100000 : 0;
  pointsWon += boostedAmount;

  return [isWinner, pointsWon];
}

// Helper function to get the win chance based on leverage
function getWinChance(leverageOption: string): number {
  switch (leverageOption) {
    case "none":
      return 0.95; // 90% chance to win
    case "x5":
      return 0.95; // 70% chance to win
    case "x10":
      return 0.85; // 50% chance to win
    case "x50":
      return 0.75; // 30% chance to win
    case "x100":
      return 0.65; // 20% chance to win
    case "x1000":
      return 0.45; // 5% chance to win
    default:
      return 0.95; // Default is 90% chance to win
  }
}

// Helper function to get the top users from the leaderboard
function getTopUsers(count: number): [string, number][] {
  return [...leaderboard.entries()]
    .sort((a, b) => b[1] - a[1]) // Sort in descending order based on scores
    .slice(0, count); // Take the top 'count' entries
}

// Helper function to calculate reward based on a random amount within a range
function calculateReward(leverage: number): number {
  return (leverage - 1 * -100) * getRandomAmount(50, 500);
}

// Helper function to get a random amount within a range
function getRandomAmount(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper function to format the leaderboard text
function formatLeaderboard(topUsers: [string, number][]): string {
  if (topUsers.length === 0) {
    return "Leaderboard is empty.";
  }

  const leaderboardText = topUsers
    .map(([userId, score], index) => `${index + 1}. <@${userId}>: $${score}`)
    .join("\n");

  return `Top Users:\n${leaderboardText}`;
}

function addMillisecondsToDate(
  inputDate: Date,
  millisecondsToAdd: number
): Date {
  const currentTimestamp = inputDate.getTime(); // Get the current timestamp in milliseconds
  const newTimestamp = currentTimestamp + millisecondsToAdd; // Add the desired milliseconds
  const newDate = new Date(newTimestamp); // Create a new Date object with the updated timestamp
  return newDate;
}

async function updateLeaderboardMessage(client: Client) {
  const leaderboard = await getLeaderBoard();

  if (!leaderboard) {
    return;
  }

  const leaderboardString = leaderboard
    .map(
      (entry, index) =>
        `#${index + 1}. ${userMention(entry.userId)}: $${entry.points}`
    )
    .join("\n");

  const channel = await client.channels.fetch(LEADERBOARD_CHANNEL_ID);

  if (channel?.isTextBased()) {
    const textChannel = channel as TextChannel;
    const message = await textChannel.messages.fetch(MESSAGE_ID);
    if (message) {
      message.edit(
        `**Respect The Pump 2023 - Leaderboard**\n${leaderboardString}`
      );
    } else {
      textChannel.send("Waiting to start...");
    }
  }
  // if (channel?.isTextBased()) {
  //   channel.send(`**Leaderboard**\n${leaderboardString}`);
  // }
}
