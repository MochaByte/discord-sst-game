import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Partials,
  CommandInteraction,
  userMention, 
  bold,
  time,
  TextChannel,
} from "discord.js";
import { SetUpDiscord } from "./discord";
import {
  TOKEN,
  BOT_CHANNEL_ID,
  LEADERBOARD_CHANNEL_ID,
  MESSAGE_ID,
} from "./config/config";
import {
  getLeaderBoard,
  insertOrUpdatePlayer,
  updateAndFetchRanks,
  getTrooper,
  // updatePlayerTerritory,
} from "./provider/mongodb";

import { Trooper } from './types/index'; 
// export interface Trooper {
//   userId: string;
//   points: number;
//   territory: string; // Add this line
// }


import formatNumber from "./utils/formatNumber";

const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  partials: [Partials.User, Partials.Message],
});

const cooldowns: Map<string, number> = new Map();

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

      if (!interaction.isCommand() || !interaction.guildId) return;
    
      const { commandName } = interaction;

      if (interaction.channelId !== BOT_CHANNEL_ID) {
        // If the interaction does not come from the specified BOT_CHANNEL_ID it will be ignored
        return;
      }

      const userId = interaction.user.id;

      // Cooldown logic for all commands
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

      // UPDATE Switch/case for all the commands
      switch (commandName) {
        case "help":
          await interaction.reply(`**Commands:**
          \n- \`/attack\`: Attack the bugs to earn CEX Destruction Points.
          \n-  \`/defend\`: Defend your base from the bugs for decentralized freedom.
          \n-  \`/leaderboard\`: Show the leaderboard of top players.
          \n-  \`/wormhole\`: Travel through a wormhole to another territory and defend the CEX.
          \n- \`/points\`: Shows your current Points and your current Territory`);
          break;
        case "attack":
        case "defend":
          await handleCombatCommand(interaction, commandName);
          break;
        case "leaderboard":
          await handleLeaderboardCommand(interaction);
          break;
        case "points":
          await handlePointsCommand(interaction);
          break;
        case "wormhole":
          await handleWormholeCommand(interaction);
          break;
        default:
          await interaction.reply("Unknown command. Use `/help` to see all commands.");
          break;
      }
      // Update the leaderboard in the leaderboard channel
    await updateLeaderboardMessage(discordClient);
    });
    

    await SetUpDiscord(discordClient, TOKEN);
    console.log(`Bot status: ${discordClient.user?.presence?.status}`);
  } catch (error) {
    console.error("Error during bot execution:", error);
  }
}

async function handleCombatCommand(interaction: CommandInteraction, commandName: string) {
  // Immediately defer the reply to buy time for processing ## Good to know 
  await interaction.deferReply();
  const userId = interaction.user.id;

  //Game logic with leveraging power
  // TODO: Implement a different value for the weapon you chose and the destination
  //const weapon = (interaction.options.get('weapon')?.value as string) || "assultRifle";

    // Fetch the current trooper's status, including territory
  let trooper: Trooper = await getTrooper(userId) || { userId, points: 0, currentTerritory: 'Testnet' };
  const powerLevel = (interaction.options.get('power-level')?.value as number) || 1; // Default power is 1 if not specified, PowerLevel is basically like leverage
  //const destination = (interaction.options.get('destination')?.value as string) || 'defaultTerritory';

 // Adjusting success chance and points change based on the territory and power level
 const successChance = getSuccessChance(powerLevel, trooper.currentTerritory);
 const isSuccessful = Math.random() < successChance;
 let pointsChange = isSuccessful ? calculatePoints(powerLevel, trooper.currentTerritory) : -calculatePoints(powerLevel, trooper.currentTerritory) / 2;
 
 // If user dies in a territory higher than Testnet, downgrade territory
 if (!isSuccessful && trooper.currentTerritory !== 'Testnet') {
   trooper.currentTerritory = getFallbackTerritory(trooper.currentTerritory);
   interaction.followUp(`You have been defeated and fall back to the ${trooper.currentTerritory} territory.`);
 } else if (!isSuccessful && trooper.currentTerritory === 'Testnet') {
   // Lose half the points if died in Testnet
   pointsChange = -trooper.points / 2;
   cooldowns.set(userId, Date.now() + 10000); // 10-second cooldown
 }
  //Updated points:
  trooper.points += pointsChange;

  // Applying a cooldown if the user fails
  if (!isSuccessful) {
    cooldowns.set(userId, Date.now() + 10000); // 10-second cooldown
  }

  await insertOrUpdatePlayer(trooper); // Update database

  const gifUrl = isSuccessful ? "https://media1.tenor.com/m/41agPzUN8gAAAAAC/starship-troopers-shoot.gif" : 
                                "https://media1.tenor.com/m/0uCuBpDbYVYAAAAd/dizzy-death.gif";


  const messagePrefix = isSuccessful ? "Attacking the CEX bugs" : "Defending base from CEX bugs";
  const successMessage = isSuccessful ? `was ${bold('successful')}, you'll live another day` : `failed, you ${bold('DIED')}`;
  const winOrLoseMessage = isSuccessful ?  `${bold('WIN')}` :  `${bold('LOSE')}`;
  const pointsMessage = `You ${winOrLoseMessage}. ${pointsChange > 0 ? `${bold('+')}` : ''} ${bold(pointsChange + 'points')}`;

  const embed = new EmbedBuilder()
  .setTitle(`${messagePrefix} ${successMessage}!`)
  .setDescription(pointsMessage)
  .setImage(gifUrl);

  await interaction.editReply({ embeds: [embed] });
}

async function handleLeaderboardCommand(interaction: CommandInteraction) {
  try{
  await interaction.deferReply();
  const rankedPlayers = await updateAndFetchRanks();
  let leaderboardMessage = "Leaderboard:\n";
  for (const [index, player] of rankedPlayers.slice(0, 10).entries()) { // Top 10 players
    try {
      const user = await interaction.client.users.fetch(player.userId); // Fetch user object
      leaderboardMessage += `${index + 1}. Infinex Trooper <@${player.userId}> - Points: ${player.points}\n`;
    } catch {
      // If there's an issue fetching the user (e.g., user not found), fallback to showing the ID
      leaderboardMessage += `${index + 1}. User ID: ${player.userId} - Points: ${player.points}\n`;
    }
  }
  // Use editReply because we used deferReply initially (deferReply to give time to process command)
  await interaction.editReply(leaderboardMessage);
} catch (error) {
  console.error("Error handling leaderboard command:", error);
  //Error Handling 
  await interaction.followUp({ content: "There was an error processing the leaderboard command.", ephemeral: true }).catch(console.error);
}
}

async function updateLeaderboardMessage(client: Client) {
  const leaderboard = await getLeaderBoard();

  if (!leaderboard) {
    console.log("No leaderboard data available.");
    return;
  }

  const leaderboardString = leaderboard
    .map(
      (entry, index) =>
        `#${index + 1}. ${userMention(entry.userId)}: ${entry.points} points, current territory: ${entry.currentTerritory}`
    )
    .join("\n");

  const channel = await client.channels.fetch(LEADERBOARD_CHANNEL_ID);

  if (channel?.isTextBased()) {
    const textChannel = channel as TextChannel;

    try {
      // Try to fetch the existing leaderboard message
      const message = await textChannel.messages.fetch(MESSAGE_ID);
      // If found, edit the existing message
      await message.edit(`**Infinex Trooper - Leaderboard**\n${leaderboardString}`);
    } catch (error) {
      // If the message is not found or another error occurs, send a new message
      console.log("Existing leaderboard message not found. Sending a new message.");
      await textChannel.send(`**Infinex Trooper - Leaderboard**\n${leaderboardString}`);
    }
  } else {
    console.log("Leaderboard channel is not text-based or could not be found.");
  }
}


// Calculates the success change with the choosen powerLevel
function getSuccessChance(powerLevel: number, territory: string): number {
  switch (powerLevel) {
    case 1: return 0.95; // High chance of success with default power
    case 10: return 0.75; // Medium chance of success with moderate power
    case 100: return 0.5; // Low chance of success with high power
    default: return 0.95; // Default high chance for unspecified power levels
  }
}

function calculatePoints(powerLevel: number, territory: string): number {
  if (powerLevel === 100) {
    return 500; // High points for high power (leverage)
  } else if (powerLevel === 10) {
    return 200; // Moderate points for moderate power
  } else {
    return 100; // Default points for default power
  }
}

async function handleWormholeCommand(interaction: CommandInteraction) {
  await interaction.deferReply();
  const userId = interaction.user.id;
  const newTerritory = (interaction.options.get('destination')?.value as string);
  let trooper: Trooper = await getTrooper(userId) || { userId, points: 0, currentTerritory: 'Testnet' }; // Assuming getTrooper returns a trooper object

  const updateSuccessful = await updatePlayerTerritory(userId, trooper.points, newTerritory,);

  if (updateSuccessful) {
    await interaction.editReply(`You have successfully traveled to ${bold(newTerritory)}, gas fees deducted.`);
  } else {
    await interaction.editReply(`You do not have enough points to travel to ${bold(newTerritory)}.`);
  }
}

function getFallbackTerritory(currentTerritory: string): string {
  // Logic to determine the fallback territory if a user "dies"
  const territoryOrder = ['Ethereum', 'Optimism', 'Base', 'Testnet'];
  const currentIndex = territoryOrder.indexOf(currentTerritory);
  return currentIndex > 0 ? territoryOrder[currentIndex - 1] : 'Testnet';
}

async function updatePlayerTerritory(userId: string, currentPoints: number, newTerritory: string) {
  // Define gas fees with explicit typing to help TypeScript understand the indexing
  const gasFees: { [key: string]: number } = { 'Testnet': 0,'Base': 1000, 'Optimism': 10000, 'Ethereum': 100000 };
  const fee = gasFees[newTerritory]; // Now TypeScript knows newTerritory is a valid key
  console.log(newTerritory);
  console.log(gasFees);
  if (currentPoints >= fee) {
    // Assuming insertOrUpdatePlayer can handle updating territory
    await insertOrUpdatePlayer({ userId, points: currentPoints - fee, currentTerritory: newTerritory });
    return true; // Territory update was successful
  } else {
    return false; // Not enough points for the territory change
  }
}

// for /points command
async function handlePointsCommand(interaction: CommandInteraction) {
  await interaction.deferReply();
  const userId = interaction.user.id;
  const trooper = await getTrooper(userId);
  if (!trooper) {
    await interaction.editReply("It seems you haven't started your journey yet!");
    return;
  }
  // Construct the message with the player's details
  const replyMessage = `**Your Infinex Trooper:**\n- Points: ${trooper.points}\n- Current Territory: ${trooper.currentTerritory}`;
  await interaction.editReply(replyMessage);
}


Run();


//Helper functions:

function addMillisecondsToDate(
  inputDate: Date,
  millisecondsToAdd: number
): Date {
  const currentTimestamp = inputDate.getTime(); // Get the current timestamp in milliseconds
  const newTimestamp = currentTimestamp + millisecondsToAdd; // Add the desired milliseconds
  const newDate = new Date(newTimestamp); // Create a new Date object with the updated timestamp
  return newDate;
}