import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';

export interface InvalidationEvent {
  type: 'key' | 'tag' | 'pattern';
  target: string;
  version?: number;
  timestamp: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export class InvalidationConsumer {
  private kafka: Kafka;
  private consumer: Consumer;
  private connected: boolean = false;
  private readonly regionName: string;

  constructor(brokers: string[], regionName: string) {
    this.regionName = regionName;
    
    this.kafka = new Kafka({
      clientId: `edge-${regionName}`,
      brokers: brokers,
    });

    this.consumer = this.kafka.consumer({
      groupId: `cache-invalidation-${regionName}`,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });
  }

  async connect(): Promise<void> {
    try {
      await this.consumer.connect();
      this.connected = true;
      console.log(`[${this.regionName}] Kafka Consumer connected`);
    } catch (error) {
      console.error(`Failed to connect Kafka consumer [${this.regionName}]:`, error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.consumer.disconnect();
      this.connected = false;
      console.log(`Kafka Consumer [${this.regionName}] disconnected`);
    }
  }

  async subscribe(
    handler: (event: InvalidationEvent) => Promise<void>
  ): Promise<void> {
    try {
      await this.consumer.subscribe({
        topic: 'cache.invalidation',
        fromBeginning: false, // Only process new messages
      });

      console.log(`[${this.regionName}] Subscribed to cache.invalidation topic`);

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
          try {
            if (!message.value) return;

            const event: InvalidationEvent = JSON.parse(
              message.value.toString()
            );

            console.log(
              `[${this.regionName}] Received invalidation event: ${event.type} - ${event.target}`
            );

            // Call the handler
            await handler(event);
          } catch (error) {
            console.error(
              `[${this.regionName}] Error processing message:`,
              error
            );
          }
        },
      });
    } catch (error) {
      console.error(`Failed to subscribe [${this.regionName}]:`, error);
      throw error;
    }
  }
}