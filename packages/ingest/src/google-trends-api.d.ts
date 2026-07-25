declare module "google-trends-api" {
  interface TrendsOptions {
    keyword: string | string[];
    startTime?: Date;
    endTime?: Date;
    geo?: string;
    granularTimeResolution?: boolean;
  }
  const api: {
    /** resolves with a JSON string (or an HTML error page when rate-limited) */
    interestOverTime(options: TrendsOptions): Promise<string>;
  };
  export default api;
}
