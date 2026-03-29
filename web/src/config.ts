const dev = import.meta.env.DEV;
const useProxy = import.meta.env.VITE_USE_DEV_PROXY === "true";

export const originBase =
  dev && useProxy
    ? "/proxy/origin"
    : import.meta.env.VITE_ORIGIN_URL || "http://localhost:4000";

export const edgeBases = {
  "us-east":
    dev && useProxy
      ? "/proxy/edge/us"
      : import.meta.env.VITE_EDGE_US_URL || "http://localhost:5001",
  "eu-west":
    dev && useProxy
      ? "/proxy/edge/eu"
      : import.meta.env.VITE_EDGE_EU_URL || "http://localhost:5002",
  "ap-south":
    dev && useProxy
      ? "/proxy/edge/ap"
      : import.meta.env.VITE_EDGE_AP_URL || "http://localhost:5003",
} as const;

export type EdgeRegionKey = keyof typeof edgeBases;

export const regionCards = [
  {
    key: "us-east" as const,
    label: "US East",
    subtitle: "100ms · eager",
    port: 5001,
  },
  {
    key: "eu-west" as const,
    label: "EU West",
    subtitle: "300ms · lazy",
    port: 5002,
  },
  {
    key: "ap-south" as const,
    label: "AP South",
    subtitle: "600ms · lazy",
    port: 5003,
  },
];
