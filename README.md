# sabara.org

Minimal static landing page for [sabara.org](https://sabara.org), published with GitHub Pages.

## Structure

- `index.html` — landing page markup and metadata
- `style.css` — responsive presentation
- `404.html` — fallback page
- `assets/` — logos and browser icons
- `CNAME` — custom domain configuration
- `.nojekyll` — disables Jekyll processing
- `robots.txt` — crawler policy

## Local preview

Because the site is fully static, it can be served with any local HTTP server. For example:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Deployment

GitHub Pages publishes the root of the `main` branch. Changes are deployed after they are committed and pushed:

```powershell
git add .
git commit -m "Describe the change"
git push origin main
```

The custom domain is configured in `CNAME` as `sabara.org`.

## Analytics and privacy

The page includes Google Analytics 4 (`G-6Y6738MP4N`). Depending on the audience and legal basis, a consent mechanism and privacy notice may be required, particularly in Germany and the European Union.
