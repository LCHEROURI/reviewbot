import dotenv from "dotenv";
import { createApp } from "./app";

dotenv.config();

const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);

if (!Number.isInteger(PORT) || PORT <= 0) {
  console.error("PORT must be a positive integer");
  process.exit(1);
}

const server = createApp();

server.listen(PORT, () => {
  console.info(`ReviewBot is running on port ${PORT}`);
});
