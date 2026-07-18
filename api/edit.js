export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST requests are allowed" });
  }

  try {
    const { prompt, imageUrl } = req.body;

    if (!prompt || !imageUrl) {
      return res.status(400).json({ error: "Both 'prompt' and 'imageUrl' are required" });
    }

    const HF_TOKEN = process.env.HF_TOKEN;
    if (!HF_TOKEN) {
      return res.status(500).json({ error: "Server missing HF_TOKEN environment variable" });
    }

    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) {
      return res.status(400).json({ error: "Could not download source image" });
    }
    const imageBuffer = Buffer.from(await imgResponse.arrayBuffer());

    const hfResponse = await fetch(
      "https://api-inference.huggingface.co/models/timbrooks/instruct-pix2pix",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/octet-stream",
          "X-Wait-For-Model": "true"
        },
        body: imageBuffer
      }
    );

    if (!hfResponse.ok) {
      const errText = await hfResponse.text();
      return res.status(502).json({ error: "AI provider error", details: errText });
    }

    const resultBuffer = Buffer.from(await hfResponse.arrayBuffer());

    res.setHeader("Content-Type", "image/jpeg");
    return res.status(200).send(resultBuffer);

  } catch (err) {
    console.error("Edit API error:", err);
    return res.status(500).json({ error: err.message });
  }
}
