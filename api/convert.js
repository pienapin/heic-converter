import fetch from 'node-fetch';
import sharp from 'sharp';

export const config = {
  api: {
    bodyParser: true,
    responseLimit: '20mb',
  },
  runtime: 'nodejs20.x',   // NOT edge
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const imageUrl = req.query.url || req.body?.url;
  if (!imageUrl) return res.status(400).json({ error: 'Missing url' });

  const format = (req.query.format || 'webp').toLowerCase();

  try {
    const response = await fetch(imageUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!response.ok) {
      return res.status(502).json({ error: `Fetch failed: ${response.status}` });
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Let sharp try to handle it directly - works for jpg/png/webp/gif
    // For HEIC, we need to check and reject clearly
    const metadata = await sharp(buffer).metadata();
    
    const outputFormat = format === 'jpg' ? 'jpeg' : format;
    const converted = await sharp(buffer)[outputFormat]({ quality: 85 }).toBuffer();

    const mimeType = format === 'webp' ? 'image/webp' : 'image/jpeg';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(converted);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
