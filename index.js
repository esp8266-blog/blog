const FS = require('fs');
const URL = require('url');
const Path = require('path');
const glob = require('glob');
const request = require('request');

const allArticles = [];
const index = new Map();
const assetsCache = new Map();
const ARTICLE_CACHE = './.cache.json';
const defaultColor = '#daae2b';

if (FS.existsSync(ARTICLE_CACHE)) {
  try {
    const cacheData = FS.readFileSync(ARTICLE_CACHE);
    const cache = JSON.parse(cacheData);

    cache.forEach(article => {
      allArticles.push(article);
      index.set(article.slug, article);
    })
  } catch (error) {
    console.log('Failed to prime cache, skipping it');
    allArticles.length = 0;
    index.forEach((_, key) => index.delete(key));
  }
}

function saveCache() {
  FS.writeFileSync(ARTICLE_CACHE, JSON.stringify(allArticles, null, 2));
}

function getMarkdownFor(article) {
  if (article.html) return;

  request.post({
    url: 'https://mdaas.homebots.io/',
    body: article.content
  },
    (error, response, body) => {
      if (!error && response.statusCode === 200) {
        article.html = body;
        saveCache();
      }
    });
}

function renderArticles(articles) {
  return articles.map(article => `<article class="${article.html ? '' : 'text'}" id="${article.slug}">${article.html || article.content}</article>`).join('\n');
}

function renderNavLinks(articles) {
  return articles.map(article => `<li><a href="/${article.slug}">${article.title}</a></li>`).join('\n');
}

function cleanUpPath(path) {
  path = path.replace(/(\.\.*){1,}/g, '.');
  path = Path.normalize(path);

  return Path.join(__dirname, path);
}

function resolveImports(text) {
  return text.replace(/\<%\s?(\S+?)\s?\%>/g, (_, importPath) => (assetsCache.get(importPath.trim()) || ''));
}

function template(text, variables) {
  return text.replace(/\%(\S+?)\%/g, (_, key) => (variables[key] || ''));
}

function render(articles) {
  const singleArticle = articles.length === 1;
  const meta = singleArticle ? articles[0].meta : EMPTY_META;
  const article = singleArticle ? articles[0] : {};
  const contentVars = {};

  if (singleArticle) {
    contentVars.share = assetsCache.get('assets/share.html');
  }

  const content = template(renderArticles(articles), contentVars);

  const vars = {
    content,
    nav: renderNavLinks(allArticles),
    title: meta.title || article.title,
    theme: meta.color || defaultColor,
    meta_title: meta.title,
    meta_description: meta.description,
    disqus: singleArticle ? assetsCache.get('assets/disqus.html') : '',
    url: 'https://esp8266.blog/' + article.slug,
    encodedUrl: encodeURI('https://esp8266.blog/' + article.slug),
  };

  const page = resolveImports(assetsCache.get('assets/index.html'));

  return template(page, vars);
}

function parseMetadata(text) {
  const meta = {};
  try {
    const lines = text.split('\n').map(s => s.trim());
    lines.forEach(line => {
      const key = line.split(':', 1)[0];
      const value = line.slice(key.length + 1).trim();
      meta[key] = value;
    });
  } catch {
    return {};
  }

  if (meta.tags) {
    meta.tags = meta.tags.split(/,\s+/);
  }

  return meta;
}

const EMPTY_META = {
  title: '',
  description: ''
};

function updateArticles() {
  glob('articles/**/*.md', async (_, files) => {
    for (filePath of files) {
      const slug = filePath.slice(0, -3);
      const fullPath = Path.join(__dirname, filePath);
      const contentBuffer = await FS.promises.readFile(fullPath);
      const stats = await FS.promises.stat(fullPath);
      const rawContent = contentBuffer.toString('utf8').trim();
      const lastModified = Number(stats.mtimeMs);
      const hasMetadata = rawContent.startsWith('{');
      const metaEnd = rawContent.indexOf('}\n');
      const meta = hasMetadata ? parseMetadata(rawContent.slice(1, metaEnd)) : EMPTY_META;
      const content = hasMetadata ? rawContent.slice(metaEnd + 1) : rawContent;
      const title = meta.title || content.split('\n')[0].replace(/^[#]{1,}\s/, '') || slug;

      const article = {
        slug,
        title,
        meta,
        content,
        lastModified,
      };

      if (!index.has(slug)) {
        allArticles.push(article);
        index.set(slug, article);
      } else if (index.get(slug).lastModified < lastModified) {
        const articleIndex = allArticles.findIndex(a => a.slug === slug);
        allArticles[articleIndex] = article;
        index.set(slug, article);
      }

      getMarkdownFor(article);
    }

    allArticles.sort((a, b) => b.lastModified - a.lastModified);
    saveCache();
  });
}

function loadCachedPage(filePath, cacheKey) {
  FS.readFile(cleanUpPath(filePath), (_, buffer) => assetsCache.set(cacheKey, buffer.toString('utf-8')));
}

glob('assets/*', async (_, files) => files.forEach(file => loadCachedPage(file, file)));

updateArticles();

const server = require('http').createServer(async function (request, response) {
  const url = URL.parse(request.url);

  if (url.pathname === '/') {
    response.writeHead(200);
    response.end(render(allArticles.slice(0, 5)));
    return;
  }

  if (url.pathname.startsWith('/articles/')) {
    const slug = url.pathname.slice(1);

    if (index.has(slug)) {
      const article = index.get(slug);
      response.writeHead(200);
      response.end(render([article]));
      return;
    }
  }

  response.writeHead(404, 'Bleep!');
  response.end(assetsCache.get('assets/404.html'));
});

server.listen(process.env.PORT || 3000);