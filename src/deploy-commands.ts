import { REST } from "discord.js";
import { Routes } from "discord-api-types/v9";
import { CLIENT_ID, GUILD_ID, TOKEN } from "./config/config";

const commands = [
  {
    name: "attack",
    description: "Attack the CEX bugs and destroy their hive.",
    options: [
      {
        name: "choose_action",
        description: "choose one to kill these sons of b$?*#s ",
        type: 3,
        required: true,
        choices: [
          { name: "AssultRifle", value: "AssultRifle" },
          { name: "Gun", value: "Gun" },
          { name: "Blaster", value: "Blaster" },
          { name: "Stick", value: "Stick" },
        ],
      },
      {
        name: "power-level",
        description: "Set the power level for your attack (higher risk but higher reward).",
        type: 4, // Type 4 for an integer
        required: true,
        choices: [
          { name: "1x", value: 1 },
          { name: "5x", value: 5 },
          { name: "10x", value: 10 },
          { name: "100x", value: 100 },
        ],
      },
    ],
  },
  {
    name: "defend",
    description: "Defend Infinex HQ from CEX bugs.",
    options: [
      {
        name: "choose_action",
        description: "choose defend method",
        type: 3,
        required: true,
        choices: [
          { name: "Attack", value: "Attack" },
          { name: "BuildWall", value: "BuildWall" },
          { name: "SupplyRun", value: "SupplyRun" },
          { name: "Snacking", value: "Snacking" },
        ],
      },
      {
        name: "power-level",
        description: "Set the power level for your defence (higher risk but higher reward).",
        type: 4, // Type 4 for an integer
        required: true,
        choices: [
          { name: "1x", value: 1 },
          { name: "5x", value: 5 },
          { name: "10x", value: 10 },
          { name: "100x", value: 100 },
        ],
      },
    ],
  },
  
  {
    name: "leaderboard",
    description: "Displays the leaderboard of top users",
  },
  {
    name: "help",
    description: "Shows the manual and instructions for using the bot.",
  },
  {
    name: "howtoplay",
    description: "How to play the game and more information",
  },
  {
    name: "points",
    description: "Displays your current points and territory."
  },
 {
  name: "wormhole",
  description: "Travel through a wormhole to another territory.",
  options: [
    {
      name: "destination",
      description: "The destination territory",
      type: 3,
      required: true,
      choices: [
        { name: "Ethereum", value: "Ethereum" },
        { name: "Optimism", value: "Optimism" },
        { name: "Base", value: "Base" },
        { name: "Testnet", value: "Testnet" },
      ],
    },
  ],
},
  
];

const rest = new REST({ version: "9" }).setToken(TOKEN);

(async () => {
  try {
    console.log("Started refreshing application (/) commands.");

    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
})();
