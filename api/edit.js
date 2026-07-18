import { InferenceClient } from "@huggingface/inference";

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

    let imageBuffer;
    if (imageUrl.startsWith("data:")) {
      const base64 = imageUrl.split(",")[1];
      imageBuffer = Buffer.from(base64, "base64");
    } else {
      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) {
        return res.status(400).json({ error: "Could not download source image" });
      }
      imageBuffer = Buffer.from(await imgResponse.arrayBuffer());
    }

    const client = new InferenceClient(HF_TOKEN);

    const resultBlob = await client.imageToImage({
      provider: "fal-ai",
      model: "black-forest-labs/FLUX.1-Kontext-dev",
      inputs: new Blob([imageBuffer]),
      parameters: { prompt: prompt }
    });

    const resultBuffer = Buffer.from(await resultBlob.arrayBuffer());

    res.setHeader("Content-Type", "image/jpeg");
    return res.status(200).send(resultBuffer);

  } catch (err) {
    console.error("Edit API error:", err);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}
