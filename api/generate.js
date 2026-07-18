export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const prompt = req.method === "POST" ? req.body?.prompt : req.query?.prompt;

  if (!prompt) {
    return res.status(400).json({ error: "'prompt' is required" });
  }

  try {
    const encodedPrompt = encodeURIComponent(prompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}`;

    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) {
      return res.status(502).json({ error: "Image provider failed" });
    }

    const buffer = Buffer.from(await imgResponse.arrayBuffer());
    res.setHeader("Content-Type", "image/jpeg");
    return res.status(200).send(buffer);

  } catch (err) {
    console.error("Generate API error:", err);
    return res.status(500).json({ error: err.message });
  }
}
