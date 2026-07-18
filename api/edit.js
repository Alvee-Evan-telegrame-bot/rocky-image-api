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

    // 1. Get the source image as base64 (works for both remote URLs and data: URLs)
    let base64Image;
    if (imageUrl.startsWith("data:")) {
      base64Image = imageUrl.split(",")[1];
    } else {
      const imgResponse = await fetch(imageUrl);
      if (!imgResponse.ok) {
        return res.status(400).json({ error: "Could not download source image" });
      }
      const imageBuffer = Buffer.from(await imgResponse.arrayBuffer());
      base64Image = imageBuffer.toString("base64");
    }

    // 2. Call Hugging Face image-to-image model using proper JSON payload
    const hfResponse = await fetch(
      "https://api-inference.huggingface.co/models/timbrooks/instruct-pix2pix",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
          "X-Wait-For-Model": "true"
        },
        body: JSON.stringify({
          inputs: base64Image,
          parameters: { prompt: prompt }
        })
      }
    );

    if (!hfResponse.ok) {
      const errText = await hfResponse.text();
      console.error("HF error:", errText);
      return res.status(502).json({ error: "AI provider error", details: errText });
    }

    const contentType = hfResponse.headers.get("content-type") || "";

    // HF sometimes returns JSON with a base64 image inside instead of raw bytes
    if (contentType.includes("application/json")) {
      const data = await hfResponse.json();
      if (data.error) {
        return res.status(502).json({ error: "AI provider error", details: data.error });
      }
      const outBase64 = data[0]?.generated_image || data.image || data[0];
      if (!outBase64) {
        return res.status(502).json({ error: "Unexpected response format from AI provider" });
      }
      const outBuffer = Buffer.from(outBase64, "base64");
      res.setHeader("Content-Type", "image/jpeg");
      return res.status(200).send(outBuffer);
    }

    const resultBuffer = Buffer.from(await hfResponse.arrayBuffer());
    res.setHeader("Content-Type", "image/jpeg");
    return res.status(200).send(resultBuffer);

  } catch (err) {
    console.error("Edit API error:", err);
    return res.status(500).json({ error: err.message });
  }
}
