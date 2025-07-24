import cheerio from "cheerio";
import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.writeHead(204, cors()).end();
  }

  const { url: targetUrl, mode = "content", selector = "body" } = req.query;

  if (!targetUrl) {
    return res.status(400).json({ error: "Missing 'url' parameter" });
  }

  const { hostname, pathname } = new URL(targetUrl);

  try {
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      Accept: "text/html",
      "Accept-Language": "en-US,en;q=0.9",
    };

    const resp = await fetch(targetUrl, { headers });

    if (!resp.ok) {
      return res.status(500).json({ error: `Failed to fetch: ${resp.status}` });
    }

    const html = await resp.text();

    if (mode === "link") {
      const links = [];
      const $ = cheerio.load(html);

      if (hostname.includes("novelfull")) {
        $("ul.list-chapter a").each((_, el) => {
          const href = $(el).attr("href");
          if (href) links.push(`https://novelfull.com${href}`);
        });
      } else if (hostname.includes("novelbin") || hostname.includes("novlove")) {
        const slug = pathname.split("/").filter(Boolean).pop();
        const base = hostname.includes("novelbin") ? "https://novelbin.com" : "https://novlove.com";
        const ajaxUrl = `${base}/ajax/chapter-archive?novelId=${slug}`;
        const ajaxRes = await fetch(ajaxUrl, { headers });
        const ajaxHtml = await ajaxRes.text();
        const $$ = cheerio.load(ajaxHtml);
        $$("a").each((_, el) => links.push($$(el).attr("href")));
      }

      return res.json({ results: links });
    } else {
      const $ = cheerio.load(html);
      const textChunks = [];

      selector.split(",").forEach((sel) => {
        $(sel).each((_, el) => {
          textChunks.push($(el).text());
        });
      });

      const joined = textChunks.join("\n");
      return res.json({ results: [cleanText(hostname, joined)] });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

function cleanText(hostname, text) {
  if (hostname.includes("wtr-lab.com")) {
    return text.replace(/Advertisement/g, "").replace(/\s+/g, " ").trim();
  }
  if (hostname.includes("novelfull") || hostname.includes("novelbin") || hostname.includes("novlove")) {
    text = text.replace(/window\.pubfuturetag[\s\S]*?push\([^)]*\);?/g, "");
    text = text.replace(/Translated by.*?Source.*?novelbin/gi, "");
    return text.replace(/\s+/g, " ").trim();
  }
  return text.trim();
}
