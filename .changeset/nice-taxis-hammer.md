---
"@novice1/controller": patch
---

- remove core.Response from return types of Controller
- change default type any to unknown for ReqBody (incoming network data as untrusted by default)
