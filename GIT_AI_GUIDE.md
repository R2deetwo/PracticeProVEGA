# Git & Google AI Studio Guide

This guide explains how to push your PracticePro project to GitHub and how to use it with Google AI Studio.

## 1. Push to Git (GitHub)

### Prerequisites
- Install Git: [git-scm.com](https://git-scm.com/)
- Create a GitHub account: [github.com](https://github.com/)

### Command Line Steps
Open your terminal in `c:\Users\USER\Desktop\pp` and run:

1. **Initialize Git**:
   ```bash
   git init
   ```

2. **Stage Files**:
   ```bash
   git add .
   ```

3. **Commit**:
   ```bash
   git commit -m "Initial commit of PracticePro Nigeria Build"
   ```

4. **Connect to GitHub**:
   - Create a new repository on GitHub (keep it public or private).
   - Copy the repository URL.
   ```bash
   git remote add origin YOUR_REPOSITORY_URL
   git branch -M main
   git push -u origin main
   ```

> [!NOTE]
> I have already updated your `.gitignore` to ensure `.env` files and other sensitive data are not pushed to GitHub.

---

## 2. Use with Google AI Studio

To use your codebase context in Google AI Studio for better prompts:

1. **Visit AI Studio**: [aistudio.google.com](https://aistudio.google.com/)
2. **New Prompt**: Select "Chat prompt" or "Structured prompt".
3. **Upload Files**:
   - Click the **"+" (Add media)** or use the **"Upload"** feature.
   - select key files from your `src/` directory (e.g., `src/services/reportGenerator.ts`, `src/types.ts`).
   - For a full project overview, you can zip the `src/` folder and upload it, or add files individually.
4. **Contextual Prompting**: Once uploaded, you can ask questions like:
   - *"Based on my types.ts, how do I add a new field to Matter?"*
   - *"Analyze reportGenerator.ts and suggest optimizations for Nigerian tax law."*

---

## 3. Deployment (Vercel/Cloud)
If you also want to host the app online:
1. Connect your GitHub repository to [Vercel](https://vercel.com/).
2. Add your `GEMINI_API_KEY` to the Vercel "Environment Variables" in the dashboard.
3. Vercel will automatically deploy the app from your `main` branch.
