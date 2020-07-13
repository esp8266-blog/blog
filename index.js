const FS = require('fs');
const URL = require('url');
const Path = require('path');
const glob = require('glob');
const request = require('request');

const articles = [];
const index = new Map();
const pages = new Map();
const CACHE = './.cache.json';
const API_KEY = process.env.API_KEY || '';

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
  articles.forEach(getMarkdownFor);
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

function updateArticles() {
  glob('articles/**/*.md', async (_, files) => {
    for (filePath of files) {
      const slug = filePath.slice(0, -3);
      const fullPath = Path.join(__dirname, filePath);
      const contentBuffer = await FS.promises.readFile(fullPath);
      const stats = await FS.promises.stat(fullPath);
      const content = contentBuffer.toString('utf8').trim();
      const title = content.split('\n')[0].replace(/^[#]{1,}\s/, '') || slug;
      const lastModified = Number(stats.mtimeMs);

      const article = {
        slug,
        title,
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
    }

    articles.sort((a, b) => b.lastModified - a.lastModified);
    saveCache();
  });
}

const server = require('http').createServer(async function (request, response) {
  const url = URL.parse(request.url);

  if (url.pathname.startsWith('/update') && API_KEY) {
    const key = url.pathname.slice('/update/'.length);
    if (key === API_KEY) {
      require('child_process').execSync('git pull --rebase');
      updateArticles();
    }
  }

  if (url.pathname === '/') {
    response.writeHead(200);

    response.end(
      pages.get('index')
        .replace('%content%', renderArticles(articles.slice(0, 5)))
        .replace('%nav%', renderNavLinks(articles))
        .replace('%title%', 'Welcome!')
    );
    return;
  }

  if (url.pathname.startsWith('/articles/')) {
    const slug = url.pathname.slice(1);

    if (index.has(slug)) {
      const article = index.get(slug);
      response.writeHead(200);

      response.end(
        pages.get('index')
          .replace('%content%', renderArticles([article]))
          .replace('%nav%', renderNavLinks(articles))
          .replace('%title%', article.title)
      );
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