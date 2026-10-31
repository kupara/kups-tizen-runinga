# Security

Glass Home runs a small password-protected website on the TV, on your home
network. If you find a way around its protections, please report it privately
rather than in a public issue.

## Reporting a problem

Use **[Report a vulnerability](https://github.com/victaphu/glass-home-samsung-tv/security/advisories/new)**
(the Security tab of this repository). Please include:

- what an attacker could do, and from where (the same Wi-Fi, another device
  on the home network, the internet)
- steps to reproduce, ideally against the desktop preview
  (`node dev/run.js --demo`)
- the TV model and Tizen version, if it only happens on a TV

This is a hobby project, so replies are best effort, but security reports come
first.

## In scope

- The photo website and its service (`app/service/`): sign-in, sessions,
  uploads, and the address and host checks.
- The TV app (`app/`), including how it talks to the service and opens apps,
  websites and inputs.
- The scripts in `scripts/` and `tools/`.

## Known limitations (no need to report)

- The photo website is plain HTTP on your home network, so someone who can
  intercept traffic on the same Wi-Fi could see the password and photos in
  transit. The README says so.
- The TV's own remote-control API (ports 8001 and 8002) belongs to Samsung, not
  to this project.
