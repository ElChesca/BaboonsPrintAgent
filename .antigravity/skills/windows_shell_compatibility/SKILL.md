# Skill: Windows Shell Compatibility

This skill serves as a persistent reminder for AI agents operating on Windows environments to avoid common cross-platform command-line pitfalls.

## Problem: Unix Commands on Windows
Many common developer commands (e.g., `grep`, `sed`, `awk`, `find`, `ls -R`) are not native to the standard Windows CMD or PowerShell environments unless specific tools (like Git Bash or WSL) are installed and in the PATH.

### 🚫 Erroneous Command Examples:
- `grep -r "pattern" .` (Fails on Windows CMD/PS)
- `find . -name "*.js"` (Fails on Windows PS)
- `rm -rf node_modules` (Fails on Windows CMD/PS unless using `git-bash`)

## ✅ Correct Approach:

### 1. 🛠️ Use Internal Tools (Preferred)
Always prefer using the internal agentic tools as they are cross-platform by design:
- Use `grep_search` instead of `grep`.
- Use `list_dir` instead of `ls` or `dir`.
- Use `write_to_file` / `replace_file_content` instead of `sed` or `echo > file`.

### 2. 🪟 Use Native Windows/PowerShell Alternatives
If you MUST use `run_command`, use native Windows equivalents:
- **Search Text:** Use `findstr /s /i "pattern" *.*` instead of `grep`.
- **Search Files:** Use `Get-ChildItem -Recurse -Filter "*.js"` in PowerShell.
- **Copy/Move:** Use `copy`, `move`, or `xcopy`.
- **Delete:** Use `Remove-Item -Recurse -Force` (PowerShell) or `del /s /q`.

### 3. Check OS First
Always verify the OS type from `<user_information>` before proposing commands. If the OS is **windows**, do NOT propose `grep`, `sed`, `awk`, etc.

---
> [!IMPORTANT]
> Failure to respect the host OS leads to "Command not found" errors and process frustration. When in doubt, use the internal `grep_search` tool.
