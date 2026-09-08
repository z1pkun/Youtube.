const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const { PassThrough } = require('stream');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { url, format, quality } = req.body || {};

  if (!url) {
    return res.status(400).json({ message: 'URL is required' });
  }

  if (!ytdl.validateURL(url)) {
    return res.status(400).json({ message: 'Invalid YouTube URL' });
  }

  if (!['mp4', 'mp3'].includes(format)) {
    return res.status(400).json({ message: 'Invalid format' });
  }

  try {
    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');

    if (format === 'mp3') {
      const audioStream = ytdl(url, { quality: 'lowestaudio' });
      const passThrough = new PassThrough();

      res.setHeader('Content-Disposition', `attachment; filename="${title}.mp3"`);
      res.setHeader('Content-Type', 'audio/mpeg');

      ffmpeg(audioStream)
        .audioBitrate(128)
        .toFormat('mp3')
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          if (!res.headersSent) {
            res.status(500).json({ message: 'Audio conversion failed' });
          }
        })
        .pipe(passThrough, { end: true });

      passThrough.pipe(res);

    } else {
      const videoQuality = quality || '720';
      const videoStream = ytdl(url, { quality: videoQuality });

      res.setHeader('Content-Disposition', `attachment; filename="${title}.mp4"`);
      res.setHeader('Content-Type', 'video/mp4');

      videoStream.pipe(res);
    }

  } catch (error) {
    console.error('Download error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message || 'Download failed' });
    }
  }
};
