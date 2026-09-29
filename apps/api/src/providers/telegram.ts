type NotifyDetails = Record<string, string | number | boolean | null | undefined>;

const maxDetails = 10;

function formatDetails(details: NotifyDetails = {}) {
  return Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .slice(0, maxDetails)
    .map(([key, value]) => `• ${key}: ${String(value)}`)
    .join("\n");
}

export async function notifyDbUpdate(title: string, details?: NotifyDetails) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const timestamp = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Aqtau",
    dateStyle: "short",
    timeStyle: "medium"
  }).format(new Date());
  const detailText = formatDetails(details);
  const text = [`Boltzzmann DB update`, title, `Время: ${timestamp}`, detailText].filter(Boolean).join("\n\n");

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true
      })
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("Telegram notification failed", response.status, body.slice(0, 300));
    }
  } catch (error) {
    console.error("Telegram notification failed", error);
  }
}
