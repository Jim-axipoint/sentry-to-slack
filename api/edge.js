export const config = { runtime: "edge" };

export default async (req) => {
  const body = await req.json().catch(() => ({}));
  const event = body.event ?? {};
  const title = event.title ?? event.metadata?.title ?? body.message ?? "Sentry event";
  const message =
    event.logentry?.formatted ??
    event.exception?.values?.[0]?.value ??
    body.message ?? "";
  const icon = event.level === "error" || event.level === "fatal" ? ":red_circle: " : "";

  const slack = await (await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${process.env.SLACK_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      channel: process.env.CHANNEL_ID,
      text: `${icon}${title}`,
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: `${icon}*${title}*` } },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Environment:*\n${event.environment ?? "?"}` },
            { type: "mrkdwn", text: `*Level:*\n${event.level ?? "?"}` },
            { type: "mrkdwn", text: `*Project:*\n${body.project_name ?? body.project ?? "?"}` },
            { type: "mrkdwn", text: `*Where:*\n${body.culprit ?? event.culprit ?? "?"}` },
          ],
        },
        ...(message ? [{ type: "section", text: { type: "mrkdwn", text: message.slice(0, 2900) } }] : []),
        ...(body.url ? [{ type: "section", text: { type: "mrkdwn", text: `<${body.url}|Open in Sentry>` } }] : []),
      ],
    }),
  })).json();

  if (!slack.ok) console.error("slack refused:", slack.error);
  return new Response(slack.ok ? "ok" : `slack: ${slack.error}`, { status: slack.ok ? 200 : 502 });
};
