import axios, { AxiosInstance } from "axios";
import { config } from "dotenv";

//content interface
export interface Content {
  id: number;
  slug: string;
  title: string;
  body: string;
  metadata: any;
  version: number;
  created_at: string;
  updated_at: string;
}

export class OriginClient {
  private client: AxiosInstance;
  private readonly regionName: string;

  constructor(baseURL: string, regionName: string) {
    this.regionName = regionName;

    //axios instance with configuration
    this.client = axios.create({
      baseURL,
      timeout: 5000,
      headers: {
        "X-Edge-Region": regionName,
        "Content-Type": "application/json",
      },
    });

    this.client.interceptors.request.use((config) => {
      console.log(`[${this.regionName}] Fetching from origin: ${config.url}`);
      return config;
    });

    this.client.interceptors.response.use(
      (response) => {
        console.log(`[${this.regionName}] Origin response: ${response.status}`);
        return response;
      },
      (error) => {
        console.error(`[${this.regionName}] Origin error:`, error.message);
        throw error;
      }
    );
  }
  async getContent(id: string | number): Promise<Content> {
    try {
      const response = await this.client.get(`/api/content/${id}`);

      if (!response.data.success) {
        throw new Error("Origin returned unsuccessful response");
      }
      return response.data.data;
    } catch (error: any) {
      if (error.reponse?.status === 404) {
        throw new Error("Content not found");
      }
      throw new Error(`Failed to fetch from origin: ${error.message}`);
    }
  }
  async getAllContent(): Promise<Content[]> {
    try {
      // Make GET request to get all content
      const response = await this.client.get("/api/content");

      // Check if successful
      if (!response.data.success) {
        throw new Error("Origin returned unsuccessful response");
      }

      // Return array of content
      return response.data.data;
    } catch (error: any) {
      throw new Error(`Failed to fetch from origin: ${error.message}`);
    }
  }
  async healthCheck(): Promise<boolean> {
    try {
      // Check if origin is healthy
      const response = await this.client.get("/health");
      return response.data.status === "ok";
    } catch (error) {
      // If any error, origin is not healthy
      return false;
    }
  }
}
