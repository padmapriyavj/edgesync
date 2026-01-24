import { Kafka, Producer } from "kafkajs";

export interface InvalidationEvent {
  type: "key" | "tag" | "pattern"; // What to invalidate
  target: string; // Which key/tag/pattern
  version?: number; // Optional version number
  timestamp: number; // When this happened
  priority: "HIGH" | "MEDIUM" | "LOW"; // How urgent
}

export class InvalidationProducer {
  private kafka: Kafka;
  private producer: Producer;
  private connected: boolean = false;

  constructor(brokers: string[]) {
    this.kafka = new Kafka({
      clientId: "origin-server",
      brokers: brokers,
    });
    this.producer = this.kafka.producer();
  }

  async connect(): Promise<void> {
    try {
      await this.producer.connect(); // Connect to Kafka
      this.connected = true; // Mark as connected
      console.log("Kafka Producer connected");
    } catch (error) {
      console.error("Failed to connect Kafka producer:", error);
      throw error; // Re-throw error
    }
  }
  async disconnect(): Promise<void> {
    if (this.connected) {
      // Only if connected
      await this.producer.disconnect(); // Disconnect from Kafka
      this.connected = false; // Mark as disconnected
      console.log("Kafka Producer disconnected");
    }
  }

  async publishInvalidation(event: InvalidationEvent): Promise<void> {
    try {
      await this.producer.send({
        topic: "cache.invalidation",
        messages: [
          {
            key: event.target,
            value: JSON.stringify(event),
            headers: {
              "event-type": event.type,
              priority: event.priority,
            },
          },
        ],
      });

      console.log(
        `Published invalidation event: ${event.type} - ${event.target}`
      );
    } catch (error) {
      console.error("Failed to publish invalidation event:", error);
      throw error;
    }
  }
}
