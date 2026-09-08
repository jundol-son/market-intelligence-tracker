declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ADMIN_PASSWORD?: string;
    ADMIN_TOKEN?: string;
    ALPHA_VANTAGE_API_KEY?: string;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_CHAT_ID?: string;
    TELEGRAM_WEBHOOK_SECRET?: string;
    EMAIL?: SendEmail;
    EMAIL_FROM?: string;
    EMAIL_TO?: string;
    PUBLIC_APP_URL?: string;
  }
}
