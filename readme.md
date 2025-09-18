# Vite Landing Template

Is a bundler for your landing project

## Installation

Requires [Node.js](https://nodejs.org/) v16+ to run.

Install the dependencies and devDependencies and start the server.

```sh
  npm i
  npm run dev
```

## Eslint + Pretier

If you don't have a .vscode/settings.json file yet, create it with the following settings:

```sh
{
  ...
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}

```

## GitHub Pages

Set the correct base in vite.config.js.

If you are deploying to `https://<USERNAME>.github.io/`, you can omit base as it defaults to `/`.

If you are deploying to `https://<USERNAME>.github.io/<REPO>/`, for example your repository is at `https://github.com/<USERNAME>/<REPO>`, then set base to `/<REPO>/`.

## License

MIT

**Free Software, Hell Yeah!**
