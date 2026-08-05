export type TweetType = "original" | "retweet" | "reply";

export interface Tweet {
  id: string;
  type: TweetType;
  timestamp: string;
  url: string;
  textSnippet: string;
}

export interface TweetCounts {
  original: number;
  retweet: number;
  reply: number;
  total: number;
}

export interface PoliticianDayResult {
  handle: string;
  name: string;
  party: string;
  status: "ok" | "error";
  error?: string;
  counts: TweetCounts | null;
  tweets: Tweet[];
}

export interface DayData {
  date: string;
  scrapedAt: string;
  range: { start: string; end: string };
  politicians: Record<string, PoliticianDayResult>;
}

export interface Politician {
  id: string;
  name: string;
  role: string;
  party: string;
  handle: string;
}
