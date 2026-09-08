const ALLOWED_METHOD = "POST";

module.exports = async (req, res) => {
  if (req.method !== ALLOWED_METHOD) {
    return res.status(405).json({ message: "Method not allowed" });
  }

  /*
   * Vercel serverless functions are not a good place to proxy/convert
   * arbitrary third-party video streams. This endpoint is intentionally
   * a safe integration scaffold.
   *
   * Connect it to a backend/service that you are authorized to use for
   * content you have permission to download. Do not bypass platform
   * restrictions or download content when the rights/terms do not allow it.
   */

  const { url, format, quality } = req.body || {};

  if (!url) {
    return res.status(400).json({ message: "URL is required" });
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ message: "Invalid URL" });
  }

  const allowedHosts = new Set([
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
    "www.youtube-nocookie.com"
  ]);

  if (!allowedHosts.has(parsed.hostname)) {
    return res.status(400).json({ message: "Please enter a YouTube URL" });
  }

  if (!["mp4", "mp3"].includes(format)) {
    return res.status(400).json({ message: "Invalid format" });
  }

  if (format === "mp4" && quality && !["best", "1080", "720", "480", "360"].includes(String(quality))) {
    return res.status(400).json({ message: "Invalid quality" });
  }

  return res.status(501).json({
    message:
      "変換エンジンは未接続です。利用規約と権利関係を確認した、許可済みの変換バックエンド/APIを接続してください。",
    requested: { format, quality: quality || null }
  });
};
