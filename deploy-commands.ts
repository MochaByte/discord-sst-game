import { REST } from "discord.js";
import { Routes } from "discord-api-types/v9";
import { CLIENT_ID, GUILD_ID, TOKEN } from "./config/config";

const commands = [
  {
    name: "short",
    description: "Place a short trade you dirty bear.",
    options: [
      {
        name: "market",
        description: "Select the market for the trade",
        type: 3,
        required: true,
        choices: [
          { name: "BTC", value: "BTC" },
          { name: "ETH", value: "ETH" },
          { name: "LINK", value: "LINK" },
          { name: "PEPE", value: "PEPE" },
          { name: "SNX", value: "SNX" },
          { name: "KWENTA", value: "KWENTA" },
        ],
      },
      {
        name: "leverage",
        description: "Select the leverage for the trade",
        type: 3,
        required: true,
        choices: [
          { name: "x5", value: "x5" },
          { name: "x10", value: "x10" },
          { name: "x100", value: "x100" },
          { name: "x1000", value: "x1000" },
          { name: "none", value: "none" },
        ],
      },
    ],
  },
  {
    name: "long",
    description: "Place a long you bullah.",
    options: [
      {
        name: "market",
        description: "Select the market for the trade",
        type: 3,
        required: true,
        choices: [
          { name: "BTC", value: "BTC" },
          { name: "ETH", value: "ETH" },
          { name: "LINK", value: "LINK" },
          { name: "PEPE", value: "PEPE" },
          { name: "SNX", value: "SNX" },
          { name: "KWENTA", value: "KWENTA" },
        ],
      },
      {
        name: "leverage",
        description: "Select the leverage for the trade",
        type: 3,
        required: true,
        choices: [
          { name: "x5", value: "x5" },
          { name: "x10", value: "x10" },
          { name: "x100", value: "x100" },
          { name: "x1000", value: "x1000" },
          { name: "none", value: "none" },
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
