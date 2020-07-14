const FS = require('fs');
const URL = require('url');
const Path = require('path');
const glob = require('glob');
const request = require('request');

const articles = [];
const index = new Map();
const pages = new Map();
const CACHE = './.cache.json';

if (FS.existsSync(CACHE)) {
  try {
    const cacheData = FS.readFileSync(CACHE);
    const cache = JSON.parse(cacheData);

    cache.forEach(article => {
      articles.push(article);
      index.set(article.slug, article);
    })
  } catch (error) {
    console.log('Failed to prime cache, skipping it');
    articles.length = 0;
    index.forEach((_, key) => index.delete(key));
  }
}

function saveCache() {
  FS.writeFileSync(CACHE, JSON.stringify(articles, null, 2));
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
  return articles.map(article => `
    <article class="${article.html ? '' : 'text'}" id="${article.slug}">${article.html || article.content}</article>
  `).join('\n');
}

function renderNavLinks(articles) {
  return articles.map(article => `<li><a href="/${article.slug}">${article.title}</a></li>`).join('\n');
}

function cleanUpPath(path) {
  path = path.replace(/(\.\.*){1,}/g, '.');
  path = Path.normalize(path);

  return Path.join(__dirname, path);
}

function render(articles) {
  const meta = articles.length === 1 ? articles[0].meta : { title: 'Beep boop! Welcome!' };

  return pages.get('index')
    .replace('%content%', renderArticles(articles))
    .replace('%nav%', renderNavLinks(articles))
    .replace('%title%', meta.title)
    .replace('%meta_description%', meta.description)
}

function updateArticles() {
  glob('articles/**/*.md', async (_, files) => {
    for (filePath of files) {
      const slug = filePath.slice(0, -3);
      const fullPath = Path.join(__dirname, filePath);
      const contentBuffer = await FS.promises.readFile(fullPath);
      const stats = await FS.promises.stat(fullPath);
      const rawContent = contentBuffer.toString('utf8').trim();
      const lastModified = Number(stats.mtimeMs);
      const metaString = rawContent.startsWith('#META') ? rawContent.slice(5, rawContent.indexOf('\n')) : '';
      const content = metaString ? rawContent.slice(rawContent.indexOf('\n') + 1) : rawContent;
      let meta = {};

      try { meta = Function('return {' + metaString + '}')(); } catch { }

      const title = meta.title || content.split('\n')[0].replace(/^[#]{1,}\s/, '') || slug;
      meta.title = title;

      const article = {
        slug,
        title,
        meta,
        content,
        lastModified,
      };

      if (!index.has(slug)) {
        articles.push(article);
        index.set(slug, article);
      } else if (index.get(slug).lastModified < lastModified) {
        const articleIndex = articles.findIndex(a => a.slug === slug);
        articles[articleIndex] = article;
        index.set(slug, article);
      }

      getMarkdownFor(article);
    }

    articles.sort((a, b) => b.lastModified - a.lastModified);
    saveCache();
  });
}

const server = require('http').createServer(async function (request, response) {
  const url = URL.parse(request.url);

  if (url.pathname === '/') {
    response.writeHead(200);
    response.end(render(articles.slice(0, 5)));
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
  response.end(pages.get('404'));
});

FS.readFile(cleanUpPath('404.html'), (_, buffer) => pages.set('404', buffer.toString('utf-8')));
FS.readFile(cleanUpPath('index.html'), (_, buffer) => pages.set('index', buffer.toString('utf-8')));

updateArticles();

server.listen(process.env.PORT || 3000);