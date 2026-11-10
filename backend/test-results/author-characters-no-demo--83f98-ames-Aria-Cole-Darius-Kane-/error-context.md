# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: author.spec.js >> characters: no demo character names (Aria Cole, Darius Kane)
- Location: e2e\author.spec.js:165:1

# Error details

```
Test timeout of 90000ms exceeded.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - img "Droboard" [ref=e5]
      - generic [ref=e6]:
        - generic [ref=e7]: DROBOARD
        - text: Read · Write · Earn
    - heading "Welcome back" [level=1] [ref=e8]
    - generic [ref=e9]: Sign in to continue reading and publishing.
    - generic [ref=e10]:
      - button "Continue with Google" [ref=e11] [cursor=pointer]
      - generic [ref=e12]: or
      - generic [ref=e14]:
        - generic [ref=e15]: Email address
        - textbox "e.g. adaeze@example.com" [ref=e16]: writer.luna.vale@dev.local
      - generic [ref=e17]:
        - generic [ref=e18]: Password
        - generic [ref=e19]:
          - textbox "••••••••" [ref=e20]: Memory1234!
          - button "" [ref=e21] [cursor=pointer]
      - link "Forgot password?" [ref=e24] [cursor=pointer]:
        - /url: forgot-password.html
      - button " Please wait…" [disabled] [ref=e25]:
        - generic [ref=e26]: 
        - text: Please wait…
      - generic [ref=e27]:
        - text: No account?
        - link "Create one" [ref=e28] [cursor=pointer]:
          - /url: signup.html
      - link "Continue as guest" [ref=e30] [cursor=pointer]:
        - /url: "#"
  - generic: Done
```