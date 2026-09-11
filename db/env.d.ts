declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    ADMIN_PASSWORD?: string;
    ADMIN_TOKEN?: string;
    ALPHA_VANTAGE_API_KEY?: string;
    KIS_APP_KEY?: string;
    KIS_APP_SECRET?: string;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_CHAT_ID?: string;
    TELEGRAM_WEBHOOK_SECRET?: string;
    EMAIL?: SendEmail;
    RESEND_API_KEY?: string;
    EMAIL_FROM?: string;
    EMAIL_TO?: string;
    PUBLIC_APP_URL?: string;
  }
}
