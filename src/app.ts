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
  updatePlayerTerritory,
} from "./provider/mongodb";
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
      // Switch/case for all the commands
      switch (commandName) {
        case "help":
          await interaction.reply(`**Commands:**
            \`/attack\`: Attack the bugs to earn CEX Destruction Points.
            \`/defend\`: Defend your base from the bugs for decentralized freedom.
            \`/leaderboard\`: Show the leaderboard of top players.
            \`/wormhole\`: Travel through a wormhole to another territory and defend the CEX.`);
          break;
        case "attack":
        case "defend":
          await handleCombatCommand(interaction, commandName);
          break;
        case "leaderboard":
          await handleLeaderboardCommand(interaction);
          break;
        case "wormhole":
          const destination = (interaction.options.get('destination')?.value as string) || 'defaultTerritory';
          await updatePlayerTerritory(userId, destination);
          await interaction.reply(`You have traveled through the wormhole to the ${destination} territory. Welcome!`);
          break;
        default:
          await interaction.reply("Unknown command. Use `/help` to see all commands.");
          break;
      }
      // Update the leaderboard
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
  //const weapon = (interaction.options.get('weapon')?.value as string) || "assultRifle"; // Assuming a weapon option is mandatory
  const powerLevel = (interaction.options.get('power-level')?.value as number) || 1; // Default power is 1 if not specified, PowerLevel is basically like leverage
  //const destination = (interaction.options.get('destination')?.value as string) || 'defaultTerritory';

  // Adjusting success chance based on weapon power
  const successChance = getSuccessChance(powerLevel); 
  const isSuccessful = Math.random() < successChance;
  let pointsChange = isSuccessful ? calculatePoints(powerLevel) : -calculatePoints(powerLevel) / 2;

  let trooper = await getTrooper(userId) || { userId, points: 0 };
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
      leaderboardMessage += `${index + 1}. Infinex Trooper <@${player.userId}> - Points: ${player.points}, Rank: ${''}\n`;
    } catch {
      // If there's an issue fetching the user (e.g., user not found), fallback to showing the ID
      leaderboardMessage += `${index + 1}. User ID: ${player.userId} - Points: ${player.points}, Rank: ${''}\n`;
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
        `#${index + 1}. ${userMention(entry.userId)}: ${entry.points} points`
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
function getSuccessChance(powerLevel: number): number {
  switch (powerLevel) {
    case 1: return 0.95; // High chance of success with default power
    case 10: return 0.75; // Medium chance of success with moderate power
    case 100: return 0.5; // Low chance of success with high power
    default: return 0.95; // Default high chance for unspecified power levels
  }
}

function calculatePoints(powerLevel: number): number {
  if (powerLevel === 100) {
    return 500; // High points for high power (leverage)
  } else if (powerLevel === 10) {
    return 200; // Moderate points for moderate power
  } else {
    return 100; // Default points for default power
  }
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