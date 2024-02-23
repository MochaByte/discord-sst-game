import {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  time,
  bold,
  userMention,
  Partials,
  TextChannel,
  CommandInteraction, 
} from "discord.js";
import { SetUpDiscord } from "./discord";
import {
  TOKEN,
  BOT_CHANNEL_ID,
  LEADERBOARD_CHANNEL_ID,
  MESSAGE_ID,
} from "./config/config";
import { getLeaderBoard, insertOrUpdatePlayer, updateAndFetchRanks, getTrooper } from "./provider/mongodb";
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

    discordClient.on("interactionCreate", async (interaction) => {
      if (!interaction.isCommand()) {
        return;
      }

      const { commandName } = interaction;
      if (interaction.channelId === BOT_CHANNEL_ID) {
        const userId = interaction.user.id;

        switch (commandName) {
          case "help":
            await interaction.reply(`**Commands**
            - \`/attack\`: Attack the bugs to earn CEX Destruction Points.
            - \`/defend\`: Defend your base from the CEX bugs for decentralized freedom.
            - \`/leaderboard\`: Show the leaderboard of top players.
            `);
            break;
          case "attack":
          case "defend":
            await handleCombatCommand(interaction, commandName);
            break;
          case "leaderboard":
            await handleLeaderboardCommand(interaction);
            break;
          default:
            await interaction.reply("Unknown command. Use `/help` to see all commands.");
            break;
        }
      }
    });

    await SetUpDiscord(discordClient, TOKEN);

    console.log(`Bot status: ${discordClient.user?.presence?.status}`);
  } catch (error) {
    console.error("Error during bot execution:", error);
  }
}

async function handleCombatCommand(interaction: CommandInteraction, commandName: string) {
  try {
    // Immediately defer the reply to buy time for processing
    await interaction.deferReply();
    const userId = interaction.user.id;
    const isAttack = commandName === "attack";
    const successChance = Math.random() < 0.5;
    const pointsChange = successChance ? 100 : -50;
  
    // Fetch the trooper or initialize if not exists
    let trooper = await getTrooper(userId) || { userId, points: 0 }; // Ensure trooper has a default value if not found
    trooper.points += pointsChange; // Adjust points directly
  
    const messagePrefix = isAttack ? "Attacking CEX bugs" : "Defending base from CEX bugs";
    const successMessage = successChance ? "was successful" : "failed";
    const pointsMessage = `You ${successMessage}. ${pointsChange > 0 ? '+' : ''}${pointsChange} points.`;
    const gifUrl = successChance ? "https://media1.tenor.com/m/41agPzUN8gAAAAAC/starship-troopers-shoot.gif" : 
                                   "https://media1.tenor.com/m/0uCuBpDbYVYAAAAd/dizzy-death.gif"; // Valid URLs here

    await insertOrUpdatePlayer(trooper); // Update database

    const embed = new EmbedBuilder()
      .setTitle(`${messagePrefix} ${successMessage}!`)
      .setDescription(pointsMessage)
      .setImage(gifUrl); // Include the image in the embed

    // Use editReply because we deferred the reply initially
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error("Error handling command:", error);
    // If an error occurs, let the user know.
    // Ensure to catch any potential errors from editReply or followUp here as well.
    await interaction.followUp({ content: "There was an error processing your command.", ephemeral: true }).catch(console.error);
  }
}


async function handleLeaderboardCommand(interaction: CommandInteraction) {
  const rankedPlayers = await updateAndFetchRanks();
  let leaderboardMessage = "Leaderboard:\n";
  rankedPlayers.slice(0, 10).forEach((player, index) => { // Top 10 players
    leaderboardMessage += `${index + 1}. <Infinex Trooper: @${player.userId}> - Points: ${player.points}, Rank: ''\n`;
  });

  await interaction.reply(leaderboardMessage);
}

Run();
