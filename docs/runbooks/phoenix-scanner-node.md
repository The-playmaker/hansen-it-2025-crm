# Phoenix scanner-node: phoenix-scan01

Dette er deploy-instruks for den passive Phoenix Scanner Runner som kjører på scanner-noden.

## Node

- Host: `phoenix-scan01`
- Internal IP: `10.200.1.20`
- Runner path: `/opt/phoenix-scanner/app/scanner-runner.mjs`
- Service: `phoenix-scanner.service`
- Env file: `/opt/phoenix-scanner/.env`
- Mode: `passive`

Runneren poller `scan_jobs` med `status='queued'`, verifiserer at tilhørende `scan_authorization` er `signed`, setter jobben til `running`, kjører passive DNS/HTTP/TLS/header/e-post-kontroller og lagrer `scan_results`, `scan_findings` og `scan_reports`.

Aktiv Nmap/full vuln-scan er ikke aktivert i denne versjonen.

## Påkrevd env

`/opt/phoenix-scanner/.env`:

```bash
SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

SCANNER_MODE=passive
SCANNER_NODE_NAME=phoenix-scan01
SCANNER_INTERNAL_IP=10.200.1.20
SCANNER_EGRESS_IP=
SCANNER_POLL_INTERVAL_MS=15000
SCANNER_DNS_SERVERS=1.1.1.1,8.8.8.8
SCANNER_DKIM_SELECTORS=selector1,selector2,google,default,mail,smtp
```

`SUPABASE_SERVICE_ROLE_KEY` skal kun ligge på server/scanner-node. Den skal aldri eksponeres i frontend eller i public repo.

## Deploy

På scanner-node:

```bash
sudo mkdir -p /opt/phoenix-scanner/app
sudo chown -R phoenix-scanner:phoenix-scanner /opt/phoenix-scanner
```

Kopier runner og package-filer fra repoet:

```bash
sudo -u phoenix-scanner cp scripts/scanner-runner.mjs /opt/phoenix-scanner/app/scanner-runner.mjs
sudo -u phoenix-scanner cp package.json package-lock.json /opt/phoenix-scanner/app/
cd /opt/phoenix-scanner/app
sudo -u phoenix-scanner npm ci --omit=dev
```

Hvis noden bare skal kjøre runneren og ikke hele Next-appen, er `@supabase/supabase-js` eneste runtime dependency runneren trenger.

## Systemd service

`/etc/systemd/system/phoenix-scanner.service`:

```ini
[Unit]
Description=Project Phoenix Scanner Runner
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=phoenix-scanner
Group=phoenix-scanner
WorkingDirectory=/opt/phoenix-scanner/app
EnvironmentFile=/opt/phoenix-scanner/.env
ExecStart=/usr/bin/node /opt/phoenix-scanner/app/scanner-runner.mjs
Restart=always
RestartSec=10
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/phoenix-scanner

[Install]
WantedBy=multi-user.target
```

Aktiver service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable phoenix-scanner.service
sudo systemctl restart phoenix-scanner.service
sudo systemctl status phoenix-scanner.service
```

Se logger:

```bash
journalctl -u phoenix-scanner.service -f
```

## Manuell test

Kjør én poll og stopp:

```bash
cd /opt/phoenix-scanner/app
sudo -u phoenix-scanner env $(cat /opt/phoenix-scanner/.env | xargs) RUN_ONCE=1 node scanner-runner.mjs
```

Forventet logg uten jobb:

```text
[phoenix-scanner] no queued jobs ...
```

Forventet statusflyt med signert jobb:

```text
queued -> running -> completed
```

Ved feil:

```text
queued -> running -> failed
```

Feilmelding lagres i `scan_jobs.error` og `scan_jobs.error_message`.

## Metadata som logges

Runneren legger disse feltene i `scan_jobs.metadata`, `scan_results.raw_result.runner` og `scan_reports.report.runner`:

- scanner node name
- internal IP
- egress IP hvis konfigurert
- mode
- runner version
- runner path
- timestamps for start/completed/failed

## Scope og sikkerhet

Passiv scan gjør:

- DNS A/AAAA/NS
- HTTP/HTTPS reachability
- TLS certificate check
- security headers
- MX/SPF/DKIM/DMARC

Passiv scan gjør ikke:

- Nmap
- portscan
- full vuln scan
- IP-range scan
- credential testing
- brute force

`external_active` og `internal_agent` er kun struktur for senere. De skal ikke kjøres før scope er eksplisitt godkjent, scanner egress IP er kjent, og aktiv scan-policy er på plass.
