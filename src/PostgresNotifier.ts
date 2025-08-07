import { Pool, type PoolConfig, type PoolClient } from "pg";
import { type Logger } from "pino";
import { createChildLogger } from "./logger";

class PostgresNotifier {
  private readonly connectionString: string;
  private channelName: string | undefined;
  private readonly pool: Pool;
  private client: PoolClient | undefined;
  private readonly logger: Logger;

  constructor(poolConfig: PoolConfig) {
    const { connectionString } = poolConfig;
    if (!connectionString) {
      throw new Error("Connection string is required for PostgresNotifier.");
    }
    this.connectionString = connectionString;
    this.logger = createChildLogger({ component: "PostgresNotifier" });
    this.pool = new Pool({
      connectionString: this.connectionString,
      ...poolConfig,
    });
  }

  public channel(channelName: string): this {
    this.channelName = channelName;
    return this;
  }

  public async subscribe(
    callback: (payload: string | undefined) => void
  ): Promise<void> {
    this.client = await this.pool.connect();

    try {
      await this.client.query(`LISTEN ${this.channelName}`);
      this.logger.debug(
        `Listening for notifications on channel: ${this.channelName}`
      );

      this.client.on("notification", (msg) => {
        const payload = msg.payload;
        if (this.channelName === msg.channel) {
          callback(payload);
        }
      });
    } catch (error) {
      this.logger.error("Error listening for notifications:", error);
    }
  }

  public async notify(payload: string): Promise<void> {
    const client: PoolClient = await this.pool.connect();

    try {
      this.logger.debug(
        `Notifying ${this.channelName} with payload: ${payload}`
      );
      await client.query(`NOTIFY ${this.channelName}, '${payload}'`);
    } catch (error) {
      this.logger.error("Notification error:", error);
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    if (this.client) {
      this.client.release();
      this.client = undefined;
    }
    await this.pool.end();
  }
}

export default PostgresNotifier;
