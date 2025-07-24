const { getChapterContent } = require("../lib/novelfull");

module.exports = async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  try {
    const chapter = await getChapterContent(url);
    res.status(200).json(chapter);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// File: vercel.json
{
  "version": 2,
  "functions": {
    "api/*.js": {
      "runtime": "nodejs18.x"
    }
  }
}
