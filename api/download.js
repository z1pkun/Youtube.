const ALLOWED_METHOD = "POST";
const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const YT_COOKIE_STRING = process.env.YT_COOKIE || '';

function parseCookieString(cookieString, domain = '.youtube.com') {
  const jar = new CookieJar();
  if (!cookieString) return jar;
  const pairs = cookieString.split(';').map(s => s.trim());
  for (const pair of pairs) {
    const [key, ...valParts] = pair.split('=');
    const value = valParts.join('=');
    if (key && value) {
      try {
        jar.setCookieSync(`${key}=${value}`, `https://${domain}`);
      } catch (e) {}
    }
  }
  return jar;
}

function getRandomUserAgent() {
  const uas = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0'
  ];
  return uas[Math.floor(Math.random() * uas.length)];
}

function getRandomAcceptLanguage() {
  const langs = [
    'en-US,en;q=0.9',
    'en-US,en;q=0.9,ja;q=0.8',
    'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
    'en-GB,en;q=0.9',
    'en-US,en;q=0.9,fr;q=0.8',
    'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
  ];
  return langs[Math.floor(Math.random() * langs.length)];
}

function getRandomPlatform() {
  const platforms = ['Windows', 'macOS', 'Linux', 'Android', 'iOS'];
  return platforms[Math.floor(Math.random() * platforms.length)];
}

function getRandomSecChUa() {
  const uas = [
    '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    '"Not A(Brand";v="99", "Google Chrome";v="120", "Chromium";v="120"',
    '"Microsoft Edge";v="119", "Not?A_Brand";v="8", "Chromium";v="119"',
    '"Google Chrome";v="121", "Not A(Brand";v="99", "Chromium";v="121"'
  ];
  return uas[Math.floor(Math.random() * uas.length)];
}

function getRandomDelay() {
  return Math.floor(Math.random() * 3000) + 1000;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getAuthenticatedClient() {
  const jar = parseCookieString(YT_COOKIE_STRING);
  const ua = getRandomUserAgent();
  const client = wrapper(axios.create({
    jar,
    headers: {
      'User-Agent': ua,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': getRandomAcceptLanguage(),
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Ch-Ua': getRandomSecChUa(),
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': `"${getRandomPlatform()}"`,
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0',
      'Connection': 'keep-alive',
      'Cookie': YT_COOKIE_STRING,
    },
    withCredentials: true,
    timeout: 45000,
  }));
  return client;
}

function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&?#]+)/,
    /youtube\.com\/shorts\/([^&?#]+)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function getStreamingUrls(videoId) {
  const client = await getAuthenticatedClient();
  
  await sleep(getRandomDelay());
  
  const bpctr = Date.now() + Math.floor(Math.random() * 900000 + 100000);
  const params = new URLSearchParams({
    v: videoId,
    bpctr: bpctr,
    has_verified: '1',
    hl: ['en', 'ja', 'ko', 'es', 'fr', 'de'][Math.floor(Math.random() * 6)]
  });
  
  const response = await client.get(`https://www.youtube.com/watch?${params.toString()}`, {
    headers: {
      'Referer': 'https://www.youtube.com/',
      'Origin': 'https://www.youtube.com',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Cookie': YT_COOKIE_STRING,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    },
    maxRedirects: 5,
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const html = response.data;
  
  let playerResponse = null;
  const match1 = html.match(/var ytInitialPlayerResponse\s*=\s*({.*?});/s);
  if (match1) {
    playerResponse = JSON.parse(match1[1]);
  } else {
    const match2 = html.match(/ytInitialPlayerResponse\s*=\s*({.*?});/s);
    if (match2) {
      playerResponse = JSON.parse(match2[1]);
    } else {
      const match3 = html.match(/<script\s*[^>]*>.*?ytInitialPlayerResponse\s*=\s*({.*?});.*?<\/script>/s);
      if (match3) {
        playerResponse = JSON.parse(match3[1]);
      }
    }
  }
  
  if (!playerResponse) {
    throw new Error('Player response not found');
  }
  
  const formats = playerResponse?.streamingData?.formats || [];
  const adaptiveFormats = playerResponse?.streamingData?.adaptiveFormats || [];
  const allFormats = [...formats, ...adaptiveFormats];
  
  const processedFormats = allFormats.map(f => {
    let url = f.url;
    if (f.signatureCipher || f.cipher) {
      const cipher = f.signatureCipher || f.cipher;
      const params = new URLSearchParams(cipher);
      url = params.get('url');
      const sig = params.get('s');
      if (sig && url) {
        try {
          const decodedSig = decodeURIComponent(sig);
          url = url + '&sig=' + decodedSig;
        } catch (e) {}
      }
    }
    return { ...f, url };
  }).filter(f => f.url);
  
  return processedFormats;
}

function convertToMp3(inputBuffer, bitrate = '192k') {
  return new Promise((resolve, reject) => {
    const tempId = crypto.randomBytes(16).toString('hex');
    const inputPath = path.join('/tmp', `${tempId}.m4a`);
    const outputPath = path.join('/tmp', `${tempId}.mp3`);
    
    fs.writeFileSync(inputPath, inputBuffer);
    
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputPath,
      '-vn',
      '-acodec', 'libmp3lame',
      '-ab', bitrate,
      '-ar', '44100',
      '-y',
      outputPath
    ]);
    
    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg failed: ${stderr}`));
        return;
      }
      try {
        const outputBuffer = fs.readFileSync(outputPath);
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
        resolve(outputBuffer);
      } catch (e) {
        reject(e);
      }
    });
    
    ffmpeg.on('error', (err) => {
      reject(err);
    });
  });
}

module.exports = async (req, res) => {
  if (req.method !== ALLOWED_METHOD) {
    return res.status(405).json({ message: "Method not allowed" });
  }

  if (!YT_COOKIE_STRING) {
    return res.status(400).json({ 
      message: "YT_COOKIE environment variable is required",
      hint: "Set YT_COOKIE with your YouTube authentication cookies"
    });
  }

  const { url, format, quality, bitrate } = req.body || {};

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
    "youtube.com", "www.youtube.com", "m.youtube.com",
    "youtu.be", "www.youtube-nocookie.com"
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

  if (format === "mp3" && bitrate && !["128k", "192k", "256k", "320k"].includes(String(bitrate))) {
    return res.status(400).json({ message: "Invalid bitrate" });
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    return res.status(400).json({ message: "Invalid YouTube video ID" });
  }

  try {
    const streams = await getStreamingUrls(videoId);
    
    let filtered = streams;
    
    if (format === 'mp4') {
      filtered = streams.filter(s => s.mimeType && s.mimeType.includes('video/mp4'));
      
      if (quality && quality !== 'best') {
        const height = parseInt(quality);
        filtered = filtered.filter(s => {
          const h = parseInt(s.qualityLabel || s.height || 0);
          return h <= height;
        });
      }
      
    } else {
      filtered = streams.filter(s => s.mimeType && s.mimeType.includes('audio/mp4'));
      
      const targetBitrate = parseInt(bitrate || '192k');
      filtered = filtered.filter(s => {
        const b = parseInt(s.bitrate || 0);
        return b >= targetBitrate * 0.8;
      });
    }
    
    const selected = filtered.sort((a, b) => {
      if (format === 'mp4') {
        const aH = parseInt(a.qualityLabel || a.height || 0);
        const bH = parseInt(b.qualityLabel || b.height || 0);
        return bH - aH;
      } else {
        const aB = parseInt(a.bitrate || 0);
        const bB = parseInt(b.bitrate || 0);
        return bB - aB;
      }
    })[0];
    
    if (!selected || !selected.url) {
      throw new Error('No suitable stream found');
    }

    const client = await getAuthenticatedClient();
    
    await sleep(getRandomDelay());
    
    const streamResponse = await client.get(selected.url, {
      responseType: 'arraybuffer',
      headers: {
        'Referer': 'https://www.youtube.com/',
        'Origin': 'https://www.youtube.com',
        'Range': 'bytes=0-',
        'Cookie': YT_COOKIE_STRING,
        'Accept': format === 'mp4' ? 'video/webm,video/mp4,video/*;q=0.9,*/*;q=0.8' : 'audio/webm,audio/mp4,audio/*;q=0.9,*/*;q=0.8',
        'Accept-Language': getRandomAcceptLanguage(),
        'Sec-Fetch-Dest': format === 'mp4' ? 'video' : 'audio',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': getRandomUserAgent(),
        'Connection': 'keep-alive',
      },
    });

    let outputBuffer = Buffer.from(streamResponse.data);
    const ext = format === 'mp4' ? 'mp4' : 'mp3';
    const filename = `${videoId}.${ext}`;
    
    if (format === 'mp3') {
      try {
        outputBuffer = await convertToMp3(outputBuffer, bitrate || '192k');
      } catch (convertError) {
        console.error('MP3 conversion failed:', convertError);
        return res.status(500).json({
          message: 'MP3 conversion failed',
          error: 'ffmpeg not available or conversion error',
          hint: 'Please ensure ffmpeg is installed on the system'
        });
      }
    }
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', format === 'mp4' ? 'video/mp4' : 'audio/mpeg');
    res.setHeader('Content-Length', outputBuffer.length);
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    
    res.send(outputBuffer);
    
  } catch (error) {
    console.error('Download error:', error);
    return res.status(500).json({
      message: 'Download failed',
      error: error.message,
      hint: 'Check if YT_COOKIE is valid and not expired'
    });
  }
};
