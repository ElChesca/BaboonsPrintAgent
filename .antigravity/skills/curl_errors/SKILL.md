---
name: Troubleshooting Curl on Windows PowerShell
description: How to avoid the Invoke-WebRequest alias error when using curl in Windows PowerShell.
---

# Troubleshooting Curl on Windows PowerShell

When executing `curl` commands in Windows PowerShell, `curl` is by default an alias for `Invoke-WebRequest`.
Because of this aliasing, standard Linux `curl` arguments (like `-s`, `-I`, etc.) often result in error messages such as:

```text
Invoke-WebRequest : Falta un argumento para el parámetro 'SessionVariable'. 
Especifique un parámetro del tipo 'System.String' e inténtelo de nuevo.
```
or 

```text
A positional parameter cannot be found that accepts argument '-I'.
```

## Solution

To properly read URLs or test endpoints without triggering the `Invoke-WebRequest` alias, use one of the following approaches:

1. **Use the specific `read_url_content` tool**  
   Whenever possible, prioritize using the `read_url_content` tool provided natively in your toolkit. This tool is cross-platform, avoids PowerShell aliases entirely, and is built specifically for fetching HTTP resources reliably.

2. **Use `curl.exe` instead of `curl`**  
   If you absolutely must use the terminal (for example, to pipe outputs or debug headers), type `curl.exe` instead of `curl`. This bypasses the PowerShell alias and executes the actual Windows implementation of cURL.
   
   *Example:*
   ```powershell
   curl.exe -s -I https://example.com
   ```

3. **Use basic PowerShell native commands (if `curl.exe` fails)**
   If `curl.exe` is not available, use `Invoke-WebRequest` directly with Windows-specific parameters.
   
   *Example:*
   ```powershell
   (Invoke-WebRequest -Uri "https://example.com" -UseBasicParsing).Headers
   ```
