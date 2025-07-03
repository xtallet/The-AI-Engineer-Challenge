# Cómo fusionar feat/docx-support a main

## Opción 1: Pull Request en GitHub
1. Ve a: https://github.com/xtallet/The-AI-Engineer-Challenge/pull/new/feat/docx-support
2. Revisa los cambios y crea el Pull Request.
3. Haz merge del PR una vez aprobado.

## Opción 2: Línea de comandos (CLI)
```bash
git checkout main
git pull origin main
git merge --no-ff feat/docx-support
git push origin main
```

---

Esta rama añade soporte para subir y procesar archivos DOCX además de PDF, tanto en backend como en frontend. 