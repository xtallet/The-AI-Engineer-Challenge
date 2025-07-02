# How to Merge Your Feature Branch Back to Main

This guide explains two ways to merge your feature branch into the `main` branch: using a GitHub Pull Request (PR) and using the GitHub CLI.

---

## 1. Merging via GitHub Pull Request (PR)

1. **Push your feature branch to GitHub:**
   ```bash
   git push origin <your-feature-branch>
   ```
2. **Go to your repository on GitHub.**
3. **Click the "Compare & pull request" button** next to your branch.
4. **Review the changes** and add a descriptive title and comment.
5. **Click "Create pull request".**
6. Wait for any required reviews or checks to complete.
7. **Click "Merge pull request"** and confirm the merge.
8. (Optional) **Delete your feature branch** on GitHub after merging.

---

## 2. Merging via GitHub CLI

1. **Ensure you have the GitHub CLI installed:**
   [GitHub CLI installation guide](https://cli.github.com/manual/installation)
2. **Authenticate with GitHub (if not already):**
   ```bash
   gh auth login
   ```
3. **Push your feature branch to GitHub:**
   ```bash
   git push origin <your-feature-branch>
   ```
4. **Create a pull request from your branch:**
   ```bash
   gh pr create --base main --head <your-feature-branch> --fill
   ```
5. **Merge the pull request:**
   ```bash
   gh pr merge --merge
   ```
6. (Optional) **Delete your feature branch locally and remotely:**
   ```bash
   git branch -d <your-feature-branch>
   git push origin --delete <your-feature-branch>
   ```

---

**Replace `<your-feature-branch>` with the name of your branch.**

If you have any questions or run into issues, consult the [GitHub documentation](https://docs.github.com/) or ask your team for help. 