import express from 'express';
import fetch from 'node-fetch';
import sharp from 'sharp';

const app = express();
app.use(express.json());

app.get('/api/convert', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const imageUrl = req.query.url;
  if (!imageUrl) return res.status(400).json({ error: 'Missing url' });

  const format = (req.query.format || 'webp').toLowerCase();

  try {
    const response = await fetch(imageUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (!response.ok) return res.status(502).json({ error: `Fetch failed: ${response.status}` });

    const buffer = Buffer.from(await response.arrayBuffer());
    const outputFormat = format === 'jpg' ? 'jpeg' : format;

    // sharp linked against system libvips WITH heic support = works!
    const converted = await sharp(buffer)[outputFormat]({ quality: 85 }).toBuffer();

    res.setHeader('Content-Type', format === 'webp' ? 'image/webp' : 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(converted);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log('Running on :3000'));
