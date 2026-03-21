# OpenCode Server

The SDK talks to the OpenCode HTTP server. Understand the server to integrate effectively.

## Starting the Server

### Standalone

```bash
opencode serve [--port <number>] [--hostname <string>] [--cors <origin>]
```

| Flag | Description | Default |
|------|-------------|---------|
| --port | Port to listen on | 4096 |
| --hostname | Hostname to listen on | 127.0.0.1 |
| --mdns | Enable mDNS discovery | false |
| --mdns-domain | Custom mDNS domain | opencode.local |
| --cors | Additional CORS origins | [] |

### With TUI

Running `opencode` starts both TUI and server. The TUI is a client that talks to the server.

### Connect to Existing Server

When TUI runs, it assigns a random port. Pass `--hostname` and `--port` to the CLI to connect to a specific server. The IDE plugins use this pattern.

## Authentication

Set `OPENCODE_SERVER_PASSWORD` for HTTP basic auth:

```bash
OPENCODE_SERVER_PASSWORD=your-password opencode serve
```

Username defaults to `opencode`. Override with `OPENCODE_SERVER_USERNAME`.

## OpenAPI Spec

View the spec at:

```
http://<hostname>:<port>/doc
```

Example: http://localhost:4096/doc

The SDK is generated from this OpenAPI 3.1 spec. Use it to inspect request/response types or generate custom clients.

## Server Config (opencode.json)

```json
{
  "server": {
    "port": 4096,
    "hostname": "0.0.0.0",
    "mdns": true,
    "mdnsDomain": "myproject.local",
    "cors": ["http://localhost:5173"]
  }
}
```

## Key Endpoints (HTTP)

| Method | Path | Description |
|--------|------|-------------|
| GET | /global/health | Health and version |
| GET | /global/event | SSE event stream |
| GET | /session | List sessions |
| POST | /session | Create session |
| POST | /session/:id/message | Send message |
| GET | /find?pattern= | Search text |
| GET | /find/file?query= | Find files |

See [Server Docs](https://opencode.ai/docs/server) for full API.
