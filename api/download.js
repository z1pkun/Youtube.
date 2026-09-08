const ytdl = require("@distube/ytdl-core");
const ffmpegPath = require("ffmpeg-static");
const { spawn } = require("child_process");

const ALLOWED_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtube-nocookie.com"
]);

const QUALITY_MAP = {
  "360": 360,
  "480": 480,
  "720": 720,
  "1080": 1080
};

function validYouTubeUrl(value) {
  try {
    const url = new URL(value);

    return (
      ALLOWED_HOSTS.has(url.hostname) &&
      (
        url.hostname === "youtu.be" ||
        url.searchParams.has("v") ||
        url.pathname.startsWith("/shorts/")
      )
    );
  } catch {
    return false;
  }
}

function safeFilename(name) {
  return String(name || "download")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "download";
}

function pickProgressiveFormat(formats, targetHeight) {
  const candidates = formats
    .filter(format =>
      format.hasVideo &&
      format.hasAudio &&
      format.container === "mp4" &&
      Number(format.height || 0) > 0
    )
    .sort((a, b) => {
      const aDistance = Math.abs(Number(a.height) - targetHeight);
      const bDistance = Math.abs(Number(b.height) - targetHeight);

      if (aDistance !== bDistance) {
        return aDistance - bDistance;
      }

      return Number(b.bitrate || 0) - Number(a.bitrate || 0);
    });

  return candidates[0] || null;
}

function pickSeparateFormats(formats, targetHeight) {
  const videos = formats
    .filter(format =>
      format.hasVideo &&
      !format.hasAudio &&
      format.container === "mp4" &&
      Number(format.height || 0) > 0
    )
    .sort((a, b) => {
      const aDistance = Math.abs(Number(a.height) - targetHeight);
      const bDistance = Math.abs(Number(b.height) - targetHeight);

      if (aDistance !== bDistance) {
        return aDistance - bDistance;
      }

      return Number(b.bitrate || 0) - Number(a.bitrate || 0);
    });

  const audios = formats
    .filter(format =>
      format.hasAudio &&
      !format.hasVideo &&
      format.audioCodec
    )
    .sort((a, b) =>
      Number(b.audioBitrate || b.bitrate || 0) -
      Number(a.audioBitrate || a.bitrate || 0)
    );

  return {
    video: videos[0] || null,
    audio: audios[0] || null
  };
}

function sendError(res, status, message) {
  if (res.headersSent) {
    return;
  }

  res.status(status).json({
    ok: false,
    message
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendError(res, 405, "Method not allowed");
  }

  const body = req.body || {};

  const url = typeof body.url === "string"
    ? body.url.trim()
    : "";

  const format = body.format === "mp3"
    ? "mp3"
    : body.format === "mp4"
      ? "mp4"
      : null;

  const requestedQuality = String(body.quality || "720");

  if (!url) {
    return sendError(res, 400, "URL is required");
  }

  if (!validYouTubeUrl(url)) {
    return sendError(res, 400, "Invalid YouTube URL");
  }

  if (!format) {
    return sendError(res, 400, "Invalid format");
  }

  if (format === "mp4" && requestedQuality !== "best" && !QUALITY_MAP[requestedQuality]) {
    return sendError(res, 400, "Invalid quality");
  }

  try {
    const info = await ytdl.getInfo(url);

    const title = safeFilename(
      info.videoDetails?.title || "download"
    );

    /*
     * MP3
     */
    if (format === "mp3") {
      const audio = ytdl.downloadFromInfo(info, {
        filter: "audioonly",
        quality: "highestaudio"
      });

      res.statusCode = 200;

      res.setHeader(
        "Content-Type",
        "audio/mpeg"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${title}.mp3"`
      );

      audio.on("error", error => {
        console.error("Audio stream error:", error);

        if (!res.headersSent) {
          sendError(res, 500, "Audio stream failed");
        } else {
          res.destroy(error);
        }
      });

      const ffmpeg = spawn(ffmpegPath, [
        "-hide_banner",
        "-loglevel",
        "error",

        "-i",
        "pipe:0",

        "-vn",

        "-c:a",
        "libmp3lame",

        "-b:a",
        "128k",

        "-f",
        "mp3",

        "pipe:1"
      ]);

      ffmpeg.stderr.on("data", data => {
        console.error(
          "FFmpeg:",
          data.toString()
        );
      });

      ffmpeg.on("error", error => {
        console.error(
          "FFmpeg process error:",
          error
        );

        if (!res.headersSent) {
          sendError(
            res,
            500,
            "FFmpeg could not start"
          );
        } else {
          res.destroy(error);
        }
      });

      ffmpeg.on("close", code => {
        if (code !== 0) {
          console.error(
            "FFmpeg exited with code:",
            code
          );
        }
      });

      audio.pipe(ffmpeg.stdin);

      ffmpeg.stdout.pipe(res);

      req.on("close", () => {
        if (!ffmpeg.killed) {
          ffmpeg.kill("SIGKILL");
        }

        audio.destroy();
      });

      return;
    }

    /*
     * MP4
     */
    const targetHeight =
      requestedQuality === "best"
        ? Number.MAX_SAFE_INTEGER
        : QUALITY_MAP[requestedQuality];

    /*
     * First try progressive MP4.
     *
     * Progressive means video + audio are already
     * contained in the same stream.
     */
    let progressive;

    if (requestedQuality === "best") {
      progressive = info.formats
        .filter(format =>
          format.hasVideo &&
          format.hasAudio &&
          format.container === "mp4"
        )
        .sort((a, b) =>
          Number(b.height || 0) -
          Number(a.height || 0)
        )[0];
    } else {
      progressive = pickProgressiveFormat(
        info.formats,
        targetHeight
      );
    }

    if (progressive) {
      res.statusCode = 200;

      res.setHeader(
        "Content-Type",
        "video/mp4"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${title}.mp4"`
      );

      const stream = ytdl.downloadFromInfo(
        info,
        {
          quality: progressive.itag
        }
      );

      stream.on("error", error => {
        console.error(
          "Video stream error:",
          error
        );

        res.destroy(error);
      });

      stream.pipe(res);

      return;
    }

    /*
     * If progressive MP4 isn't available,
     * download separate video/audio streams
     * and merge them with FFmpeg.
     */
    const selected = pickSeparateFormats(
      info.formats,
      targetHeight === Number.MAX_SAFE_INTEGER
        ? Math.max(
            ...info.formats
              .filter(f => f.hasVideo && f.height)
              .map(f => Number(f.height))
          )
        : targetHeight
    );

    if (!selected.video || !selected.audio) {
      return sendError(
        res,
        404,
        "Compatible MP4 video/audio formats were not found"
      );
    }

    res.statusCode = 200;

    res.setHeader(
      "Content-Type",
      "video/mp4"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${title}.mp4"`
    );

    const videoStream =
      ytdl.downloadFromInfo(info, {
        quality: selected.video.itag
      });

    const audioStream =
      ytdl.downloadFromInfo(info, {
        quality: selected.audio.itag
      });

    const ffmpeg = spawn(ffmpegPath, [
      "-hide_banner",
      "-loglevel",
      "error",

      "-i",
      "pipe:3",

      "-i",
      "pipe:4",

      "-map",
      "0:v:0",

      "-map",
      "1:a:0",

      "-c:v",
      "copy",

      "-c:a",
      "aac",

      "-b:a",
      "128k",

      "-movflags",
      "frag_keyframe+empty_moov",

      "-f",
      "mp4",

      "pipe:1"
    ], {
      stdio: [
        "ignore",
        "pipe",
        "pipe",
        "pipe",
        "pipe"
      ]
    });

    videoStream.pipe(ffmpeg.stdio[3]);
    audioStream.pipe(ffmpeg.stdio[4]);

    ffmpeg.stderr.on("data", data => {
      console.error(
        "FFmpeg:",
        data.toString()
      );
    });

    ffmpeg.on("error", error => {
      console.error(
        "FFmpeg process error:",
        error
      );

      videoStream.destroy();
      audioStream.destroy();

      if (!res.headersSent) {
        sendError(
          res,
          500,
          "FFmpeg could not start"
        );
      } else {
        res.destroy(error);
      }
    });

    ffmpeg.stdout.pipe(res);

    const cleanup = () => {
      videoStream.destroy();
      audioStream.destroy();

      if (!ffmpeg.killed) {
        ffmpeg.kill("SIGKILL");
      }
    };

    req.on("close", cleanup);

    ffmpeg.on("close", code => {
      if (code !== 0) {
        console.error(
          "FFmpeg exited with code:",
          code
        );
      }
    });

  } catch (error) {
    console.error(
      "Download error:",
      error
    );

    if (!res.headersSent) {
      return sendError(
        res,
        500,
        error.message || "Download failed"
      );
    }

    res.destroy(error);
  }
};
