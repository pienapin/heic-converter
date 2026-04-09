import fetch from 'node-fetch';
import sharp from 'sharp';
import heicConvert from 'heic-convert';

export const config = {
  api: {
    bodyParser: true,
    responseLimit: '20mb',
  },
};

export default async function handler(req, res) {
  // CORS headers so you can call this from anywhere
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Accept ?url= as query param OR { url } in POST body
  const imageUrl = req.query.url || req.body?.url;

  if (!imageUrl) {
    return res.status(400).json({ error: 'Missing required parameter: url' });
  }

  const format = (req.query.format || req.body?.format || 'webp').toLowerCase();
  if (!['webp', 'jpg', 'jpeg'].includes(format)) {
    return res.status(400).json({ error: 'format must be webp, jpg, or jpeg' });
  }

  try {
    // 1. Fetch the image from the provided URL
    const response = await fetch(imageUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0' }, // some hosts block bot agents
    });

    if (!response.ok) {
      return res.status(502).json({
        error: `Failed to fetch image: ${response.status} ${response.statusText}`,
      });
    }

    const contentType = response.headers.get('content-type') || '';
    const buffer = Buffer.from(await response.arrayBuffer());

    let inputBuffer = buffer;

    // 2. If HEIC/HEIF, convert to a raw JPEG buffer first
    const isHeic =
      contentType.includes('heic') ||
      contentType.includes('heif') ||
      imageUrl.toLowerCase().includes('.heic') ||
      imageUrl.toLowerCase().includes('.heif');

    if (isHeic) {
      inputBuffer = await heicConvert({
        buffer,
        format: 'JPEG',   // heic-convert outputs JPEG; sharp handles the rest
        quality: 1,
      });
    }

    // 3. Convert to target format with sharp
    const outputFormat = format === 'jpg' ? 'jpeg' : format;
    const converted = await sharp(inputBuffer)
      [outputFormat]({ quality: 85 })
      .toBuffer();

    // 4. Return the image
    const mimeType = outputFormat === 'webp' ? 'image/webp' : 'image/jpeg';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="converted.${format}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(converted);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Conversion failed' });
  }
}
