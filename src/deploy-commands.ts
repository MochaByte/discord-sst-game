import { REST } from "discord.js";
import { Routes } from "discord-api-types/v9";
import { CLIENT_ID, GUILD_ID, TOKEN } from "./config/config";

const commands = [
  {
    name: "attack",
    description: "Attack the CEX bugs and destroy their hive.",
    options: [
      {
        name: "choose_weapon",
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
