# Secure Deployment

## Threat Model

Agents can take unintended actions due to prompt injection or model error. Defense in depth is recommended.

## Built-in Security

- **Sandbox mode**: Restricts filesystem and network for Bash
- **Web search summarization**: Reduces prompt injection from web content
- **Static analysis**: Flags risky bash commands before execution
- **Permissions**: Allow, block, or prompt per tool

## Security Principles

### Security Boundaries

Place credentials outside agent boundary. Use proxy to inject keys - agent never sees them.

### Least Privilege

| Resource | Options |
|----------|---------|
| Filesystem | Mount only needed dirs, read-only |
| Network | Restrict via proxy |
| Credentials | Inject via proxy |
| Capabilities | Drop in containers |

### Defense in Depth

Layer: request validation, filesystem controls, network restrictions, container isolation.

## Isolation Technologies

| Technology | Strength | Overhead | Complexity |
|------------|----------|----------|------------|
| Sandbox runtime | Good | Low | Low |
| Docker | Setup-dependent | Low | Medium |
| gVisor | Excellent | Medium | Medium |
| VMs (Firecracker) | Excellent | High | Medium/High |

## Hardened Container Example

```bash
docker run \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --read-only \
  --network none \
  -v /path/to/code:/workspace:ro \
  -v /var/run/proxy.sock:/var/run/proxy.sock:ro \
  agent-image
```

## Unix Socket Proxy

With `--network none`, agent reaches outside only via mounted Unix socket to host proxy. Proxy enforces allowlists, injects credentials.

## Sandbox Runtime

[sandbox-runtime](https://github.com/anthropic-experimental/sandbox-runtime): Lightweight isolation without Docker. JSON config for domains and paths.
