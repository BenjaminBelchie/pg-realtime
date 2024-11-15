import { Pool, type PoolClient } from "pg";
import { type ILogObj, Logger } from "tslog";

class PostgresNotifier {
  private connectionString: string;
  private channelName: string | undefined;
  private pool: Pool;
  private client: PoolClient | undefined;
  private logger: Logger<ILogObj>;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
    this.logger = new Logger({
      hideLogPositionForProduction: true,
      prefix: ["pg-realtime"],
    });
    this.pool = new Pool({
      connectionString: this.connectionString,
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
      this.logger.info(
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
      this.logger.info(
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
