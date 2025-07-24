const { getNovelInfo: getFromNovelfull } = require("../lib/novelfull");
const { getNovelInfo: getFromRoyalroad } = require("../lib/royalroad");

module.exports = async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  try {
    let novel;

    if (url.includes("novelfull.com")) {
      novel = await getFromNovelfull(url);
    } else if (url.includes("royalroad.com")) {
      novel = await getFromRoyalroad(url);
    } else {
      return res.status(400).json({ error: "Unsupported site" });
    }

    res.status(200).json(novel);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
