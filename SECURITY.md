# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Instead, report them privately via one of the following:

- **GitHub private vulnerability reporting**: Go to the [Security](https://github.com/chiba233/yume-dsl-token-walker/security/advisories/new) tab and click "Report a vulnerability".
- **Email**: Send details to the repository maintainer (see GitHub profile).

### What to include

1. Description of the vulnerability
2. Steps to reproduce
3. Affected version
4. Impact assessment (if known)

### What to expect

- Acknowledgment within **48 hours**
- Status update within **7 days**
- A fix or mitigation plan for confirmed vulnerabilities

## Scope

This policy covers `yume-dsl-token-walker`. It does **not** cover:

- Vulnerabilities in rendering layers you build on top of the walker (that's your application code)
- Denial of service via extremely large input — use `depthLimit` and input size limits in your application

## Known security considerations

- **Handler safety**: Walker handlers are application code. If they output HTML or perform side effects, validate and escape appropriately at that layer.
- **Large token trees**: Apply size limits if you process untrusted input or third-party parser output.
