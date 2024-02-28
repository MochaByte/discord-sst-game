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
import { Trooper, Outcome } from './types/index'; 
import formatNumber from "./utils/formatNumber";
import { IndexType } from "typescript";

const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  partials: [Partials.User, Partials.Message],
});

const cooldowns: Map<string, number> = new Map();

// All Weapon options to choose from
const weaponOptions = ["AssultRifle", "Gun", "Blaster", "Stick"];
const defenceOptions = ["Attack", "BuildWall", "SupplyRun", "Snacking"];


// ################################################# Start the Bot #################################################
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


      // UPDATE Switch/case for all the commands
      switch (commandName) {
        case "help":
          await interaction.reply({content:`
          **Commands:**
          \n- \`/attack\`: Launch an attack against the CEX bugs to earn points. Your success and the points you earn depend on your chosen power level and your current territory.
          \n-  \`/defend\`: Defend your current territory from incoming bugs. Like attacks, your success depends on your power level and territory.
          \n-  \`/leaderboard\`: Displays the top Infinex Troopers, their points, and territories.
          \n-  \`/wormhole\`: Travel to another CEX territory. Requires paying gas fees in points.
          \n- \`/points\`: Displays your current points, territory, and other player stats.
          \n-  \`/howtoplay\`: Check how to play for more information.`, ephemeral: true} );
          break;
        case "howtoplay":
          await interaction.reply({content:`
          **How to play:**
          \nWelcome to Infinex Troopers!
          \nIn a universe where decentralized exchanges (DEXs) battle for supremacy against centralized exchanges (CEXs), you are an Infinex Trooper, defending the realm of decentralized finance against the invasive CEX bugs. Your mission: secure the blockchain territories, earn points, and rise through the ranks of Infinex Troopers.
          \n**Territories Explained:**
          \n- Testnet: Your training ground. Lower risk but also lower rewards.
          \n- Base: The frontline of defense. A step up from Testnet with better rewards.
          \n- Optimism: A strategic stronghold. Higher risk, but the rewards are significantly greater.
          \n- Ethereum: The heart of the blockchain. The highest risk but offers the most lucrative rewards.
          \n\n**Moving Between Territories:**
          \n- Use \`/wormhole\` to travel between territories. Each move requires paying gas fees in points, with higher territories costing more (Testnet: 0, Base: 1000, Optimism: 10000, Ethereum: 100000).
          \n- Success in a higher territory earns you more points, but failure could mean falling back to a lower territory or losing all of your points.
          \n\n**Gameplay Tips:**
          \n- Start in Testnet to get the hang of the game with lower risk.
          \n- Consider the risk vs. reward of moving to a higher territory. Higher territories offer more points but come with a greater risk of falling back.
          \n- Keep an eye on the leaderboard to see how you stack up against other players.
          \n- Join the battle, protect the blockchain, and may the best Trooper win!`, ephemeral: true});
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
          await interaction.reply({content: "Unknown command. Use `/help` to see all commands.", ephemeral: true});
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

// ################################################# Attack/Defense Logic #################################################
async function handleCombatCommand(interaction: CommandInteraction, commandName: string) {
  // Immediately defer the reply to buy time for processing ## Good to know 
  await interaction.deferReply();
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

  // Game logic 
  // Fetch the current trooper's status, including territory
  let trooper = await getTrooper(userId) || { userId, points: 0, currentTerritory: 'Testnet' };
  const powerLevel = interaction.options.get('power-level')?.value as number|| 1;
  const userChoice = interaction.options.get('choose_action')?.value as string|| 'AssaultRifle';
  console.log(userChoice);
  // Special outcomes for "Stick" or "Snacking"
  if (userChoice === "Stick" || userChoice === "Snacking") {
    await handleSpecialOutcome(interaction, userChoice, trooper, userId);
    return; // Exit the function early for special cases
  }
  
  // Determine if the selected weapon is boosted
  const boosted = randomBoostedItem();
  console.log('boostred item:');
  console.log(boosted);
  const isBoosted = userChoice === boosted;

  // Adjusting success chance and points change based on the territory and power level
  const successChance = getSuccessChance(powerLevel, trooper.currentTerritory);
  const isSuccessful = Math.random() < successChance;
  let pointsChange = isSuccessful ? calculatePoints(powerLevel, trooper.currentTerritory): 0;
  if (isBoosted) pointsChange *= 5; // 5 times the points for boosted weapon
 
  let messageContent = '';
  let gifUrl = '';

  if (isSuccessful) {
    trooper.points += pointsChange;
    messageContent = `Your ${bold(commandName)} was ${bold('successful')} against the CEX bugs🪲! You earned ${bold(pointsChange + ' points')}.`;
    
    
    if (isBoosted) {
      messageContent += ` Your weapon was airdropped 🪂 from Infinex, earning you extra points! ${bold('Hurray!')}`
      gifUrl = "https://media1.tenor.com/m/C0vINUKPPtUAAAAC/dizzy-flores-isabel-flores-isabelle-flores-dina-meyer-starship-troopers.gif";
    };
  } else {
    // If user dies, handle defeat based on their current territory
    if (trooper.currentTerritory !== 'Testnet') {
      trooper.currentTerritory = getFallbackTerritory(trooper.currentTerritory);
      trooper.points = 0; // Reset points to 0
      messageContent = (`You have been ${bold('DEFEATED')} and lost all your points.💀 \nFall back to the ${bold(trooper.currentTerritory)} territory.`);
      gifUrl = "https://media1.tenor.com/m/0uCuBpDbYVYAAAAd/dizzy-death.gif";
    } else {
      trooper.points = 0; // Lose all points in Testnet as well
      //Different message when you die in the Testnet realm
      messageContent = (`You have been completely ${bold('DEFEATED')} and lost all your points!💀`);
      gifUrl = "https://media1.tenor.com/m/iWJOxKk1s84AAAAd/bug-attack-starship-troopers.gif";
      
    }
    
    cooldowns.set(userId, Date.now() + 1000); // Apply 4-hour cooldown 4 * 60 * 60 * 1000
  }

  // Update player data
  await insertOrUpdatePlayer(trooper);

  // Construct and send the reply
const commandNameCapitalized = interaction.commandName.charAt(0).toUpperCase() + interaction.commandName.slice(1);
const embed = new EmbedBuilder()
  .setTitle(`${commandNameCapitalized} against all CEX!💥`)
  .setDescription(messageContent);

// Conditionally add an image if the URL is not empty
if (gifUrl !== '') {
  embed.setImage(gifUrl);
}

  await interaction.editReply({ embeds: [embed] });
}

// ################################################# Special Outcome Logic #################################################
async function handleSpecialOutcome(interaction: CommandInteraction, userChoice: string, trooper: Trooper, userId: string) {
  const outcomes: Record<string, Outcome> = {
    "Stick": {
      message: `The CEX bugs giggle, you ${bold('DIED')}.`,
      gifUrl: "https://64.media.tumblr.com/feecd39f27c6c4c3fdbbc82eb4824c20/tumblr_p8cogtiYuK1rgu2zjo1_1280.gif" // Replace with actual URL
    },
    "Snacking": {
      message: `You accidentally ate a bug and choked, you ${bold('DIED')}.`,
      gifUrl: "https://media1.tenor.com/m/zSAq7iqX40EAAAAd/beetlejuice-beetles.gif" // Replace with actual URL
    }
  };

  if (!(userChoice in outcomes)) {
    console.error(`Invalid userChoice: ${userChoice}`);
    return; // Or handle this case appropriately
  }

  const outcome = outcomes[userChoice];

  trooper.points = 0;
  if (trooper.currentTerritory !== 'Testnet') {
    trooper.currentTerritory = getFallbackTerritory(trooper.currentTerritory);
    cooldowns.set(userId, Date.now() + 1000); // 4-hour cooldown
  } else {
    cooldowns.set(userId, Date.now() + 1000); // 4-hour cooldown in Testnet as well
  }

  await insertOrUpdatePlayer(trooper); // Update player data

  // embed with special outcome message and GIF
  const specialOutcomeEmbed = new EmbedBuilder()
    .setTitle("You're the worst trooper ever!") //
    .setDescription(outcome.message)
    .setImage(outcome.gifUrl);

  await interaction.followUp({ embeds: [specialOutcomeEmbed] });
}

// ################################################# Leaderboard command #################################################
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

// ################################################# Leaderboard Channel Update Logic #################################################
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

// ################################################# Wormhole Logic #################################################
async function handleWormholeCommand(interaction: CommandInteraction) {
  await interaction.deferReply();
  const userId = interaction.user.id;
  const newTerritory = (interaction.options.get('destination')?.value as string);
  let trooper: Trooper = await getTrooper(userId) || { userId, points: 0, currentTerritory: 'Testnet' }; // Assuming getTrooper returns a trooper object

  const updateSuccessful = await updatePlayerTerritory(userId, trooper.points, newTerritory,);

  // Define a GIF URL to include in the reply
  const wormholeGifUrl = "https://media1.tenor.com/m/mny-6-XqV1kAAAAd/wormhole.gif"; // Replace with your actual GIF URL

  if (updateSuccessful) {
    const embed = new EmbedBuilder()
      .setTitle(`Wormhole Travel to ${newTerritory}!`)
      .setDescription(`You have successfully traveled to ${bold(newTerritory)}, gas fees deducted.`)
      .setImage(wormholeGifUrl); // Include the GIF in the embed

    await interaction.editReply({ embeds: [embed] });
  } else {
    await interaction.editReply(`You do not have enough points to travel to ${bold(newTerritory)}.`);
  }
}

// ################################################# Update Territory #################################################
async function updatePlayerTerritory(userId: string, currentPoints: number, newTerritory: string) {
  //Gas fees to switch territories:
  const gasFees: { [key: string]: number } = { 'Testnet': 0,'Base': 1000, 'Optimism': 10000, 'Ethereum': 100000 };
  const fee = gasFees[newTerritory]; // Now TypeScript knows newTerritory is a valid key
  console.log(newTerritory);
  console.log(gasFees);
  if (currentPoints >= fee) {
    await insertOrUpdatePlayer({ userId, points: currentPoints - fee, currentTerritory: newTerritory });
    return true; // Territory update was successful
  } else {
    return false; // Not enough points for the territory change
  }
}

// ################################################# Points Command Logic #################################################
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




// ################################################# Helper functions #################################################

function addMillisecondsToDate(
  inputDate: Date,
  millisecondsToAdd: number
): Date {
  const currentTimestamp = inputDate.getTime(); // Get the current timestamp in milliseconds
  const newTimestamp = currentTimestamp + millisecondsToAdd; // Add the desired milliseconds
  const newDate = new Date(newTimestamp); // Create a new Date object with the updated timestamp
  return newDate;
}



//Defeat function 
function handleDefeat(trooper: Trooper, userId: string) {
  // Reset points and set cooldown
  trooper.points = 0;
  cooldowns.set(userId, Date.now() + 1000); // 4 hours cooldown

  // Downgrade territory if applicable
  trooper.currentTerritory = getFallbackTerritory(trooper.currentTerritory);
}

function randomBoostedItem() {
  // Assuming weaponOptions and defenseOptions are defined arrays
  const allOptions = [...weaponOptions, ...defenceOptions]; // Include "Snacking" if it's a defense option
  const randomIndex = Math.floor(Math.random() * allOptions.length);
  return allOptions[randomIndex];
}

// Logic to determine the fallback territory if a user "dies"
function getFallbackTerritory(currentTerritory: string): string {
 
  const territoryOrder = ['Testnet', 'Base', 'Optimism','Ethereum'];
  const currentIndex = territoryOrder.indexOf(currentTerritory);
  return currentIndex > 0 ? territoryOrder[currentIndex - 1] : 'Testnet';
}

// Calculates the success change with the choosen powerLevel
function getSuccessChance(powerLevel: number, territory: string): number {
  let successChance: number;
  switch (territory) {
    case 'Testnet':
      successChance = powerLevel === 100 ? 0.5 : powerLevel === 10 ? 0.75 : 0.95;
      break;
    case 'Base':
      successChance = powerLevel === 100 ? 0.45 : powerLevel === 10 ? 0.70 : 0.90;
      break;
    case 'Optimism':
      successChance = powerLevel === 100 ? 0.40 : powerLevel === 10 ? 0.65 : 0.85;
      break;
    case 'Ethereum':
      successChance = powerLevel === 100 ? 0.30 : powerLevel === 10 ? 0.50 : 0.80;
      break;
    default:
      successChance = 0.95;
  }
  return successChance;
}

function calculatePoints(powerLevel: number, territory: string): number {
  let points: number;
  switch (territory) {
    case 'Testnet':
      points = powerLevel === 100 ? 500 : powerLevel === 10 ? 200 : 100;
      break;
    case 'Base':
      points = powerLevel === 100 ? 1000 : powerLevel === 10 ? 400 : 200;
      break;
    case 'Optimism':
      points = powerLevel === 100 ? 2000 : powerLevel === 10 ? 800 : 400;
      break;
    case 'Ethereum':
      points = powerLevel === 100 ? 4000 : powerLevel === 10 ? 1500 : 800;
      break;
    default:
      points = 100; 
  }
  return points;
}