export const config = { runtime: "edge" };

export default async (req) => {
  const body = await req.json().catch(() => ({}));
  console.log("sentry body:", JSON.stringify(body).slice(0, 4000));

  const data = body.data ?? {};
  const e = data.event ?? data.issue ?? body.event ?? {};
  const tag = (name) => (e.tags ?? []).find((t) => (t[0] ?? t.key) === name)?.[1] ?? (e.tags ?? []).find((t) => t.key === name)?.value;

  const title = e.title ?? e.metadata?.title ?? body.message ?? "Sentry event";
  const message = e.logentry?.formatted ?? e.exception?.values?.[0]?.value ?? e.metadata?.value ?? "";
  const environment = e.environment ?? tag("environment") ?? "?";
  const level = e.level ?? tag("level") ?? "?";
  const project = e.project?.name ?? e.project?.slug ?? body.project_name ?? "?";
  const where = e.culprit ?? body.culprit ?? "?";
  const link = e.web_url ?? e.permalink ?? body.url;
  const rule = data.triggered_rule;
  const icon = level === "error" || level === "fatal" ? ":red_circle: " : "";

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
            { type: "mrkdwn", text: `*Environment:*\n${environment}` },
            { type: "mrkdwn", text: `*Level:*\n${level}` },
            { type: "mrkdwn", text: `*Project:*\n${project}` },
            { type: "mrkdwn", text: `*Where:*\n${where}` },
          ],
        },
        ...(message ? [{ type: "section", text: { type: "mrkdwn", text: message.slice(0, 2900) } }] : []),
        ...(link || rule ? [{ type: "context", elements: [{ type: "mrkdwn", text: [link && `<${link}|Open in Sentry>`, rule && `Rule: ${rule}`].filter(Boolean).join(" · ") }] }] : []),
      ],
    }),
  })).json();

  if (!slack.ok) console.error("slack refused:", slack.error);
  return new Response(slack.ok ? "ok" : `slack: ${slack.error}`, { status: slack.ok ? 200 : 502 });
};
