import fetch from 'node-fetch';
import sharp from 'sharp';
import heicDecode from 'heic-decode';

export const config = {
  api: {
    bodyParser: true,
    responseLimit: '20mb',
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const imageUrl = req.query.url || req.body?.url;
  if (!imageUrl) return res.status(400).json({ error: 'Missing required parameter: url' });

  const format = (req.query.format || req.body?.format || 'webp').toLowerCase();
  if (!['webp', 'jpg', 'jpeg'].includes(format)) {
    return res.status(400).json({ error: 'format must be webp, jpg, or jpeg' });
  }

  try {
    // 1. Fetch the image
    const response = await fetch(imageUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!response.ok) {
      return res.status(502).json({
        error: `Failed to fetch image: ${response.status} ${response.statusText}`,
      });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || '';

    const isHeic =
      contentType.includes('heic') ||
      contentType.includes('heif') ||
      imageUrl.toLowerCase().includes('.heic') ||
      imageUrl.toLowerCase().includes('.heif');

    let outputBuffer;

    if (isHeic) {
      // 2a. Decode HEIC → raw RGBA pixels using pure-JS heic-decode
      const { width, height, data } = await heicDecode({ buffer });

      // 3a. Feed raw pixels into sharp
      const outputFormat = format === 'jpg' ? 'jpeg' : format;
      outputBuffer = await sharp(Buffer.from(data), {
        raw: { width, height, channels: 4 },
      })
        [outputFormat]({ quality: 85 })
        .toBuffer();

    } else {
      // 2b. Non-HEIC: let sharp handle it directly
      const outputFormat = format === 'jpg' ? 'jpeg' : format;
      outputBuffer = await sharp(buffer)
        [outputFormat]({ quality: 85 })
        .toBuffer();
    }

    const mimeType = format === 'webp' ? 'image/webp' : 'image/jpeg';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="converted.${format}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(outputBuffer);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Conversion failed' });
  }
}
