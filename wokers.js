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

  if (
    hostname.includes("novelfull") ||
    hostname.includes("novelbin") ||
    hostname.includes("novlove")
  ) {
    text = text.replace(
      /window\.pubfuturetag[\s\S]*?push\([^)]*\);?/g,
      ""
    );
    text = text.replace(/Translated by.*?Source.*?novelbin/gi, "");
    return text.replace(/\s+/g, " ").trim();
  }

  return text.trim();
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors() });
    }

    const { searchParams } = new URL(request.url);
    let targetUrl = searchParams.get("url");
    const mode = searchParams.get("mode") || "content";

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: "Missing 'url' parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...cors() },
      });
    }

    const targetParsed = new URL(targetUrl);
    const { hostname, pathname } = targetParsed;

    let results = [];

    try {
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/123.0.0.0 Safari/537.36",
          Accept: "text/html",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: `Failed to fetch: ${response.status}` }),
          { status: 500, headers: { "Content-Type": "application/json", ...cors() } }
        );
      }

      if (mode === "link") {
        if (hostname.includes("wtr-lab.com")) {
          const parts = pathname.split("/").filter(Boolean);
          const seriePart = parts.find(p => p.startsWith("serie-"));
          const slug = parts[parts.length - 1].split("?")[0];
          const id = seriePart.slice(6);
          const language = parts[0];
          const apiUrl = `https://wtr-lab.com/api/chapters/${id}`;
          const apiResp = await fetch(apiUrl);
          const json = await apiResp.json();
          results = json.chapters.map(
            (a) => `https://wtr-lab.com/${language}/serie-${id}/${slug}/${a.order}`
          );
        } else if (hostname.includes("novelfull")) {
          // Use multi-page TOC scrape for novelfull
          const html = await response.text();
          let limit = 1;

          await new HTMLRewriter()
            .on("li.last a", {
              element(el) {
                let page = el.getAttribute("data-page");
                if (!page) {
                  const href = el.getAttribute("href");
                  if (href) {
                    try {
                      const url = new URL(href, targetUrl);
                      page = url.searchParams.get("page");
                    } catch (_) {}
                  }
                }
                if (page) {
                  limit = (parseInt(page) || 0) + 1; // ✅ Add 1 to include last page
                }
              },
            })
            .transform(new Response(html)).text();

          for (let i = 1; i <= limit; i++) {
            const tocUrl = `${targetUrl}?page=${i}&per-page=50`;
            const pageResp = await fetch(tocUrl, {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                  "AppleWebKit/537.36 (KHTML, like Gecko) " +
                  "Chrome/123.0.0.0 Safari/537.36",
                Accept: "text/html",
                "Accept-Language": "en-US,en;q=0.9",
              },
            });

            const pageHtml = await pageResp.text();

            await new HTMLRewriter()
              .on("ul.list-chapter a", {
                element(el) {
                  const href = el.getAttribute("href");
                  if (href) {
                    results.push(`https://novelfull.com${href}`);
                  }
                },
              })
              .transform(new Response(pageHtml)).text();
          }

        } else if (hostname.includes("novelbin") || hostname.includes("novlove")) {
          // ✅ Keep AJAX for novelbin & novlove
          let slug = pathname.split("/").filter(Boolean).pop();
          if (slug) {
            let baseHost = hostname.includes("novelbin")
              ? "https://novelbin.com"
              : "https://novlove.com";
            const ajaxUrl = `${baseHost}/ajax/chapter-archive?novelId=${slug}`;
            const ajaxResp = await fetch(ajaxUrl, {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                  "AppleWebKit/537.36 (KHTML, like Gecko) " +
                  "Chrome/123.0.0.0 Safari/537.36",
                Accept: "text/html",
              },
            });
            const html = await ajaxResp.text();
            const regex = /<a\s+[^>]*href=["']([^"']+)["']/gi;
            let match;
            while ((match = regex.exec(html)) !== null) {
              results.push(match[1]);
            }
          }
        } else {
          // fallback generic
          const html = await response.text();
          const regex = /<a\s+[^>]*href=["']([^"']+)["']/gi;
          let match;
          while ((match = regex.exec(html)) !== null) {
            results.push(match[1]);
          }
        }
      } else {
        const html = await response.text();
        const selector = searchParams.get("selector") || "body";
        const selectors = selector.split(",").map(s => s.trim());
        let rawTextChunks = [];
        let rewriter = new HTMLRewriter();

        for (const sel of selectors) {
          rewriter = rewriter.on(sel, {
            text(textChunk) {
              rawTextChunks.push(textChunk.text);
            },
          });
        }

        await rewriter.transform(new Response(html)).text();

        const joined = rawTextChunks.join("\n");
        const cleaned = cleanText(hostname, joined);
        results = [cleaned];
      }

      return new Response(JSON.stringify({ results }), {
        headers: { "Content-Type": "application/json", ...cors() },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...cors() },
      });
    }
  },
};
