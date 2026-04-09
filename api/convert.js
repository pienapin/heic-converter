import fetch from 'node-fetch';
import Vips from 'wasm-vips';

export const config = {
  api: {
    bodyParser: true,
    responseLimit: '20mb',
  },
};

let vipsInstance = null;
async function getVips() {
  if (!vipsInstance) {
    vipsInstance = await Vips();
  }
  return vipsInstance;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const imageUrl = req.query.url || req.body?.url;
  if (!imageUrl) return res.status(400).json({ error: 'Missing required parameter: url' });

  const format = (req.query.format || req.body?.format || 'webp').toLowerCase();

  try {
    const response = await fetch(imageUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!response.ok) {
      return res.status(502).json({ error: `Failed to fetch: ${response.status}` });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const vips = await getVips();

    // Load image from buffer — wasm-vips handles HEIC natively
    const image = vips.Image.newFromBuffer(buffer);

    const outputFormat = format === 'jpg' ? 'jpeg' : format;
    const outBuffer = image.writeToBuffer(`.${outputFormat}`, {
      Q: 85,
    });

    image.delete();

    const mimeType = format === 'webp' ? 'image/webp' : 'image/jpeg';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="converted.${format}"`);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(Buffer.from(outBuffer));

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Conversion failed' });
  }
}
