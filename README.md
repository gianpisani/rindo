# Welcome to your Rindo project

## Project info

**URL**: https://lovable.dev/projects/cda9aa30-448e-452f-8bff-7a2e15615295

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/cda9aa30-448e-452f-8bff-7a2e15615295) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## Escala de diseño

La UI usa una escala cerrada (valores en `tailwind.config.ts` y los tokens de `src/index.css`):

- **Texto:** `text-xs`, `text-sm`, `text-xl`, `text-hero` (en CSS: `var(--fs-1|2|3|hero)`), nunca `text-[Npx]`.
- **Grosor:** `font-normal`, `font-medium`; `font-semibold` solo para el número protagonista.
- **Radio:** `rounded-card` (superficies) y `rounded-full` (lo que se toca), más `rounded-none` y sus direccionales (`rounded-t-card`).
- **Sombra:** `shadow-float` (solo lo que flota) o ninguna; sin `drop-shadow`.

`npm run lint:design` lo revisa (también corre en CI). Una excepción real se justifica con un comentario `design-scale-ok: motivo` en la misma línea o la anterior.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/cda9aa30-448e-452f-8bff-7a2e15615295) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
