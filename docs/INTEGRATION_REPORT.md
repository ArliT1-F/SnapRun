# Snapchat integration compatibility report

Reviewed **2026-11-07** using GitHub repository metadata, READMEs and dependency manifests. No unofficial library was installed or executed. Repository claims are not proof of current compatibility or authorization.

## Decision

**Ship the official-web handoff provider only.** None of the four requested unofficial repositories is an approved dependency. A recent commit or an MIT license does not establish permission to access Snapchat’s private services.

| Repository                                                                          | Maintenance observed                                                                                                         | Authentication / operation                                                                                                                                                                                | Dependencies inspected                                                                                                                                      | Compatibility and authorization assessment                                                                                                                                                                                                                                                                            | Decision   |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| [etrnkz/snapchat-unofficial-api](https://github.com/etrnkz/snapchat-unofficial-api) | Not archived; pushed 2026-07-24; latest observed commit `d635687`; no GitHub releases; very short commit history             | README describes bearer/cookie use, credential login through Playwright, cookie/bearer extraction through CDP, registration, messaging, friends and feed synchronization over reverse-engineered gRPC-web | `pyproject.toml`: Python ≥3.11, `curl_cffi>=0.14.0`, `pycryptodome>=3.20`, `requests>=2.31`, `playwright>=1.40`; README also asks for Chromium installation | Active-looking maintenance does not make private endpoints supported. Credential/token handling, browser-session extraction, automated signup and private data access conflict with this project’s boundaries. Current service compatibility was not tested and is not guaranteed. Authorization was not established. | **Reject** |
| [transitive-bullshit/snapchat](https://github.com/transitive-bullshit/snapchat)     | Archived; last push 2023-02-14; README explicitly says unmaintained and difficult to make work after Snapchat/Casper changes | Snapchat username/password plus Gmail credentials; unofficial API and historical Casper dependency                                                                                                        | `package.json`: old `request`, `ursa`, `bignum`, `node-rsa`, `bluebird`, `configstore`, `debug`, among others                                               | README itself reports broken compatibility. Old native/crypto/network dependencies increase build and supply-chain risk. Collecting Snapchat and email passwords is unacceptable here. Private API authorization is not established by the author’s legal opinion.                                                    | **Reject** |
| [NSExceptional/SnapchatKit](https://github.com/NSExceptional/SnapchatKit)           | Archived; last push 2022-10-30                                                                                               | Objective-C unofficial client; README describes private Casper API keys/secrets and presenting as the iOS client                                                                                          | Podspec: CocoaAsyncSocket, Mantle ~>2.0, zlib; README describes vendored archive code; deployment targets iOS 7 / macOS 10.8                                | Obsolete platform targets and private attestation/sign-in service. Client impersonation and third-party credential mediation are outside supported access. Current compatibility and authorization were not established.                                                                                              | **Reject** |
| [Rob--/SnapWrap](https://github.com/Rob--/SnapWrap)                                 | Not archived but last push 2015-03-14                                                                                        | Username/password login, automated registration, polling, friends/snaps/stories operations against undocumented endpoints                                                                                 | `setup.py`: `schedule>=0.3.1`, `requests>=2.5.1`, `Pillow>=2.7.0`                                                                                           | A decade-old private endpoint wrapper is not a credible modern integration. Automated registration and polling are excluded. No authorization or current compatibility evidence.                                                                                                                                      | **Reject** |

The specification’s `Rob–/SnapWrap` was resolved to the actual GitHub owner **`Rob--`** through repository search.

## Specific review of etrnkz

The README advertises messaging, conversation/message retrieval, friends, feeds, media, signup and bearer refresh. It also documents credential-based Playwright login and Chrome cookie/bearer extraction. These are materially different from an official login handoff:

- A bearer token or extracted browser cookie is private authentication material. SnapRun does not request, receive, proxy or store it.
- Reverse-engineered gRPC-web calls are not a documented public messaging contract. SnapRun contains no such endpoint assumptions.
- Automating signup or extracting authentication state is not made acceptable by using a real browser for part of the flow.
- The project’s dependencies and advertised features were reviewed at the manifest/README level; this was **not** a full source audit, malware clearance, legal opinion or live-service compatibility test.
- No code from the repository is vendored, imported or used as an implementation reference in SnapRun.

Primary review links: [README](https://github.com/etrnkz/snapchat-unofficial-api/blob/master/README.md), [manifest](https://github.com/etrnkz/snapchat-unofficial-api/blob/master/pyproject.toml), [commits](https://github.com/etrnkz/snapchat-unofficial-api/commits/master/).

## Official-access alternative

The implemented provider opens `https://web.snapchat.com/` in a new browser tab or the system browser. Snapchat’s official guidance describes Google-based account creation on the web when no matching Snapchat account exists, as well as its app-based Sign Up flow [2](https://help.snapchat.com/hc/en-us/articles/38493581005332-How-do-I-sign-in-to-Snapchat-with-Apple-or-Google). The registration dialog follows that guidance rather than assuming an undocumented signup endpoint. Snapchat documents web.snapchat.com as its desktop chat/call experience [1](https://help.snapchat.com/hc/en-us/articles/7012332815508-How-to-Use-Snapchat). Snapchat controls eligibility, email/phone verification, login, CAPTCHA, account locks and device support.

Snap Run records only that a handoff was opened. The user may separately mark themself as signed in; that note is always labeled **self-reported** and `verified` remains false.

Snap’s official [Login Kit sample](https://github.com/Snapchat/login-kit-sample) and other Snap Kit repositories were identified as official reference points. Login Kit identity authorization is not assumed to grant private conversation access. OAuth is not configured merely to imply a messaging integration.

## Capability matrix

| Capability                                   | Official Web provider |
| -------------------------------------------- | --------------------- |
| Official authentication/registration handoff | Yes                   |
| Open official Snapchat messaging experience  | Yes                   |
| Verify Snapchat session                      | No                    |
| Open a specific private conversation         | No                    |
| Send/receive messages inside SnapRun         | No                    |
| Conversation history                         | No                    |
| Snapchat friends access                      | No                    |
| Snapchat message notifications               | No                    |

## Restrictions and recovery

The help flow distinguishes account restrictions, device restrictions, temporary locks, authentication failures, network failures and required security checks. Because SnapRun cannot inspect Snapchat-side errors, these are **user-selected guidance categories**, not remote diagnoses. Users complete checks and recovery in Snapchat’s official interface or contact Snapchat Support.

Prohibited and absent: device identifier spoofing, fingerprint manipulation, ban evasion, CAPTCHA bypass, authentication interception, security-check circumvention and automated Snapchat account creation.

## Future provider admission criteria

Require documented authorization, a clear scope/capability contract, least-privilege credential handling, a security review, explicit user consent, rate-limit behavior, revocation/deletion behavior and compatibility tests. Do not enable a capability until its authorized implementation exists.
