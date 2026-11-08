/**
 * Google Chrome's "site can't be reached" page. Used to answer requests from
 * addresses that are not on the admin IP allowlist, so the protected area
 * behaves like an unreachable host rather than an access-denied app.
 */
export function renderChromeUnreachablePage(host: string): string {
  const displayHost = host || "localhost";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${displayHost}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      * { box-sizing: border-box; }
      body {
        font: 13.5px/1.4 arial, sans-serif;
        background: #fff; color: #3c4043;
        margin: 0; padding: 0;
        display: flex; flex-direction: column; align-items: center;
        min-height: 100vh;
      }
      .top { width: 100%; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
      .brand { width: 20px; height: 20px; border-radius: 50%; background: #4285f4; color: #fff;
               font: 700 12px/20px arial, sans-serif; text-align: center; }
      .top-right { font-size: 12px; color: #5f6368; }
      .body { margin-top: 11vh; max-width: 600px; width: 100%; padding: 0 24px; }
      .cloud { width: 96px; height: 96px; margin: 0 auto 28px; }
      h1 { font-size: 20px; font-weight: 400; color: #202124; margin: 0 0 22px; }
      .row { display: flex; align-items: baseline; font-size: 13px; margin-bottom: 6px; }
      .row span.link { color: #1a73e8; font-weight: 400; }
      .err { color: #5f6368; margin-left: auto; font-size: 11px; }
      .divider { border: none; border-top: 1px solid #eaeaea; margin: 28px 0 18px; }
      .hint { color: #5f6368; font-size: 13px; margin: 0 0 20px; }
      .list { color: #3c4043; font-size: 13px; margin: 0; padding-left: 22px; }
      .list li { margin-bottom: 10px; }
      .footer { margin-top: 12vh; padding: 0 24px 24px; color: #9aa0a6; font-size: 11px; width: 100%; max-width: 600px; }
      code { font: 12px/1.5 monospace; }
      @media (prefers-color-scheme: dark) {
        body { background: #202124; color: #bdc1c6; }
        h1, .row span.link { color: #e8eaed; }
        .divider { border-top-color: #3c4043; }
        .hint, .list, .err, .top-right { color: #9aa0a6; }
        .footer { color: #5f6368; }
      }
    </style>
  </head>
  <body>
    <div class="top">
      <span class="brand">C</span>
      <span class="top-right">New Incognito window</span>
    </div>
    <div class="body">
      <svg class="cloud" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path fill="#dadce0" d="M22 66a15 15 0 0 1-2-29.9A21 21 0 0 1 60 30.6a13.5 13.5 0 0 1 12 13.4c0 .7-.1 1.4-.2 2.1A12 12 0 0 1 70 70z"/>
        <path fill="#f1f3f4" d="M26 62a13 13 0 0 1-2.4-25.7A19 19 0 0 1 58 31.5a12 12 0 0 1 9.4 11.6c0 .6-.1 1.2-.2 1.8A11 11 0 0 1 67 65z"/>
        <path stroke="#dadce0" stroke-width="2.5" fill="none" stroke-linecap="round" d="M30 76l12-14M48 78l12-14M66 76l12-14"/>
        <path fill="#5f6368" d="M40 46h16v3H40zM40 53h16v3H40z"/>
      </svg>
      <h1>This site can't be reached</h1>
      <div class="row"><span class="link">${displayHost}</span><span class="err">refused to connect</span></div>
      <div class="row"><span class="err">ERR_CONNECTION_REFUSED</span></div>
      <hr class="divider" />
      <p class="hint">Try:</p>
      <ul class="list">
        <li>Checking the connection</li>
        <li>Checking the proxy and the firewall</li>
        <li>Running Windows Network Diagnostics</li>
      </ul>
    </div>
    <div class="footer">ERR_CONNECTION_REFUSED</div>
  </body>
</html>`;
}

export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #111; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>Something went wrong on our end. You can try refreshing or head back home.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Try again</button>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}
