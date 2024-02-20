import { Client } from 'discord.js';

export async function SetUpDiscord(client: Client, accessToken: string): Promise<void> {
  try {
    console.log('Setting up Discord');

    // Log in to Discord
    await client.login(accessToken);

    // Set up any additional configuration, listeners, or logic here

  } catch (error) {
    console.error('Error setting up Discord:', error);
    throw error;
  }
}
