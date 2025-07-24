const cheerio = require("cheerio");

async function getNovelInfo(url) {
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);

  const title = $("h3.title").text().trim();
  const author = $("div.info div a").first().text().trim();n
  const chapters = [];
  $("#list-chapter .list-chapter li a").each((_, el) => {
    chapters.push({
      title: $(el).text().trim(),
      url: `https://novelfull.com${$(el).attr("href")}`,
    });
  });

  return { title, author, chapters };
}

async function getChapterContent(url) {
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);

  const title = $(".chapter-title").text().trim();
  const content = $("#chapter-content").text().trim();

  return { title, content };
}

module.exports = {
  getNovelInfo,
  getChapterContent,
};

// File: api/novel.js
const { getNovelInfo } = require("../lib/novelfull");

module.exports = async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  try {
    const novel = await getNovelInfo(url);
    res.status(200).json(novel);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
